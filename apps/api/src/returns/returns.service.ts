import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type ReturnStatus } from '../generated/prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { RefundsService } from './refunds.service';
import type {
  ReturnAdminCreateDto,
  ReturnAdminDetailDto,
  ReturnAdminListDto,
  ReturnAdminListQueryDto,
  ReturnApproveDto,
  ReturnCustomerCreateDto,
  ReturnCustomerDto,
  ReturnCustomerListDto,
  ReturnCustomerListQueryDto,
  ReturnInspectDto,
} from './returns.dto';
import { ReturnError } from './returns.errors';
import { DAY_MS, HOLDING_STATUSES, lineRefundP, lockOrder, nextReturnNo } from './returns.util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestItem = ReturnCustomerCreateDto['items'][number];
interface CreateOpts {
  customerId: string | null;
  staffId: string | null;
  windowOverride: boolean;
  note: string | null;
}

const customerInclude = {
  order: { select: { orderNo: true } },
  items: { include: { orderItem: true } },
  media: true,
  refunds: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ReturnInclude;

type CustomerRow = Prisma.ReturnGetPayload<{ include: typeof customerInclude }>;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly settings: SettingsService,
    private readonly refunds: RefundsService,
  ) {}

  // ---- creation -------------------------------------------------------------------------------

  async createForCustomer(customerId: string, dto: ReturnCustomerCreateDto) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo: dto.orderNo },
      select: { id: true, customerId: true },
    });
    // Same answer for "no such order" and "someone else's order".
    if (!order || order.customerId !== customerId) {
      throw new ReturnError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    }
    const id = await this.create(order.id, dto.items, dto.mediaIds ?? [], {
      customerId,
      staffId: null,
      windowOverride: false,
      note: null,
    });
    return this.customerDetailById(id);
  }

  async createForStaff(staffId: string, orderRef: string, dto: ReturnAdminCreateDto) {
    const order = await this.prisma.order.findUnique({
      where: UUID_RE.test(orderRef) ? { id: orderRef } : { orderNo: orderRef },
      select: { id: true, customerId: true },
    });
    if (!order) throw new ReturnError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    const id = await this.create(order.id, dto.items, dto.mediaIds ?? [], {
      customerId: order.customerId,
      staffId,
      windowOverride: dto.windowOverride ?? false,
      note: dto.note ?? null,
    });
    return this.adminDetail(id);
  }

  private async create(
    orderId: string,
    items: RequestItem[],
    mediaIds: string[],
    opts: CreateOpts,
  ): Promise<string> {
    if (new Set(items.map((i) => i.orderItemId)).size !== items.length) {
      throw new ReturnError(HttpStatus.BAD_REQUEST, 'RETURN_INVALID', 'List each order line once.');
    }
    const windowDefault = (await this.settings.get('returns')).windowDays;
    return this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      if (order.status !== 'delivered' && order.status !== 'completed') {
        throw new ReturnError(
          HttpStatus.CONFLICT,
          'ORDER_NOT_DELIVERED',
          'Only delivered orders can be returned.',
        );
      }
      const byId = new Map(order.items.map((i) => [i.id, i]));
      const delivered = await this.deliveredQty(tx, orderId);
      const holding = await this.holdingQty(tx, orderId);
      const now = Date.now();
      for (const it of items) {
        const line = byId.get(it.orderItemId);
        if (!line) {
          throw new ReturnError(
            HttpStatus.BAD_REQUEST,
            'RETURN_INVALID',
            'Line does not belong to this order.',
          );
        }
        const days = line.returnWindowDays ?? windowDefault;
        const from = order.deliveredAt?.getTime() ?? now;
        if (!opts.windowOverride && now > from + days * DAY_MS) {
          throw new ReturnError(
            HttpStatus.CONFLICT,
            'RETURN_WINDOW_CLOSED',
            `The ${days}-day return window for "${line.titleSnapshot}" has closed.`,
            { orderItemId: line.id, windowDays: days },
          );
        }
        const available =
          (delivered.get(line.id) ?? 0) - line.qtyReturned - (holding.get(line.id) ?? 0);
        if (it.qty > available) {
          throw new ReturnError(
            HttpStatus.CONFLICT,
            'RETURN_QTY_EXCEEDED',
            `At most ${Math.max(0, available)} of "${line.titleSnapshot}" can still be returned.`,
            { orderItemId: line.id, available: Math.max(0, available) },
          );
        }
      }
      if (mediaIds.length) {
        const found = await tx.media.count({ where: { id: { in: mediaIds } } });
        if (found !== new Set(mediaIds).size) {
          throw new ReturnError(HttpStatus.BAD_REQUEST, 'MEDIA_NOT_FOUND', 'Unknown media file.');
        }
      }
      const created = await tx.return.create({
        data: {
          returnNo: await nextReturnNo(tx),
          orderId,
          customerId: opts.customerId,
          staffId: opts.staffId,
          note: opts.note,
          items: {
            create: items.map((i) => ({
              orderItemId: i.orderItemId,
              qty: i.qty,
              reason: i.reason,
              note: i.note ?? null,
            })),
          },
          media: { create: [...new Set(mediaIds)].map((mediaId) => ({ mediaId })) },
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  /** Units that actually arrived, per order line (qty on delivered shipments). */
  private async deliveredQty(tx: Prisma.TransactionClient, orderId: string) {
    const rows = await tx.shipmentItem.groupBy({
      by: ['orderItemId'],
      where: { shipment: { orderId, status: 'delivered' } },
      _sum: { qty: true },
    });
    return new Map(rows.map((r) => [r.orderItemId, r._sum.qty ?? 0]));
  }

  /** Units tied up in returns that are not yet counted in qtyReturned (that happens at inspection). */
  private async holdingQty(tx: Prisma.TransactionClient, orderId: string) {
    const rows = await tx.returnItem.groupBy({
      by: ['orderItemId'],
      where: { return: { orderId, status: { in: [...HOLDING_STATUSES] } } },
      _sum: { qty: true },
    });
    return new Map(rows.map((r) => [r.orderItemId, r._sum.qty ?? 0]));
  }

  // ---- customer reads -------------------------------------------------------------------------

  async customerList(
    customerId: string,
    q: ReturnCustomerListQueryDto,
  ): Promise<ReturnCustomerListDto> {
    const where = { customerId };
    const [total, rows] = await Promise.all([
      this.prisma.return.count({ where }),
      this.prisma.return.findMany({
        where,
        include: customerInclude,
        orderBy: { requestedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return { items: rows.map((r) => this.toCustomer(r)), total, page: q.page, limit: q.limit };
  }

  async customerDetail(customerId: string, returnNo: string): Promise<ReturnCustomerDto> {
    const row = await this.prisma.return.findUnique({
      where: { returnNo },
      include: customerInclude,
    });
    if (!row || row.customerId !== customerId) {
      throw new ReturnError(HttpStatus.NOT_FOUND, 'RETURN_NOT_FOUND', 'Return not found.');
    }
    return this.toCustomer(row);
  }

  private async customerDetailById(id: string) {
    const row = await this.prisma.return.findUniqueOrThrow({
      where: { id },
      include: customerInclude,
    });
    return this.toCustomer(row);
  }

  private toCustomer(r: CustomerRow): ReturnCustomerDto {
    return {
      returnNo: r.returnNo,
      orderNo: r.order.orderNo,
      status: r.status,
      fault: r.fault,
      returnShippingP: r.returnShippingP,
      rejectReason: r.rejectReason,
      requestedAt: r.requestedAt.toISOString(),
      items: r.items.map((i) => ({
        orderItemId: i.orderItemId,
        titleSnapshot: i.orderItem.titleSnapshot,
        sku: i.orderItem.sku,
        optionsText: i.orderItem.optionsText,
        qty: i.qty,
        reason: i.reason,
        note: i.note,
      })),
      mediaIds: r.media.map((m) => m.mediaId),
      refunds: r.refunds.map((f) => ({
        id: f.id,
        amountP: f.amountP,
        method: f.method,
        status: f.status,
      })),
    };
  }

  // ---- staff reads ----------------------------------------------------------------------------

  async adminList(q: ReturnAdminListQueryDto): Promise<ReturnAdminListDto> {
    const where: Prisma.ReturnWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.q) {
      const s = q.q;
      where.OR = [
        { returnNo: { contains: s, mode: 'insensitive' } },
        { order: { orderNo: { contains: s, mode: 'insensitive' } } },
        { order: { shipPhone: { contains: s } } },
        { order: { guestPhone: { contains: s } } },
        { order: { shipName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.return.count({ where }),
      this.prisma.return.findMany({
        where,
        include: {
          order: { select: { orderNo: true, shipName: true, shipPhone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        returnNo: r.returnNo,
        orderId: r.orderId,
        orderNo: r.order.orderNo,
        status: r.status,
        fault: r.fault,
        itemCount: r._count.items,
        customerName: r.order.shipName,
        customerPhone: r.order.shipPhone,
        requestedAt: r.requestedAt.toISOString(),
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async adminDetail(id: string): Promise<ReturnAdminDetailDto> {
    const r = await this.prisma.return.findUnique({
      where: { id },
      include: {
        order: true,
        items: { include: { orderItem: true }, orderBy: { id: 'asc' } },
        media: true,
      },
    });
    if (!r) throw new ReturnError(HttpStatus.NOT_FOUND, 'RETURN_NOT_FOUND', 'Return not found.');
    return {
      id: r.id,
      returnNo: r.returnNo,
      status: r.status,
      fault: r.fault,
      returnShippingP: r.returnShippingP,
      note: r.note,
      rejectReason: r.rejectReason,
      staffId: r.staffId,
      requestedAt: r.requestedAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      order: {
        id: r.order.id,
        orderNo: r.order.orderNo,
        status: r.order.status,
        paymentStatus: r.order.paymentStatus,
        deliveredAt: r.order.deliveredAt?.toISOString() ?? null,
        paidP: r.order.paidP,
        refundedP: r.order.refundedP,
        customerName: r.order.shipName,
        customerPhone: r.order.shipPhone,
      },
      items: r.items.map((i) => ({
        id: i.id,
        orderItemId: i.orderItemId,
        titleSnapshot: i.orderItem.titleSnapshot,
        sku: i.orderItem.sku,
        optionsText: i.orderItem.optionsText,
        imageMediaId: i.orderItem.imageMediaId,
        unitPriceP: i.orderItem.unitPriceP,
        qty: i.qty,
        reason: i.reason,
        note: i.note,
        condition: i.condition,
        restock: i.restock,
        refundValueP: lineRefundP(r.order, i.orderItem.unitPriceP, i.qty),
      })),
      mediaIds: r.media.map((m) => m.mediaId),
      refunds: await this.refunds.forReturn(r.id),
    };
  }

  // ---- staff workflow -------------------------------------------------------------------------

  async approve(staffId: string, id: string, dto: ReturnApproveDto) {
    await this.transit(id, ['requested'], {
      status: 'approved',
      fault: dto.fault,
      // Only the customer-fault path charges for return shipping (Q87).
      returnShippingP: dto.fault === 'customer' ? (dto.returnShippingP ?? 0) : 0,
      staffId,
      ...(dto.note ? { note: dto.note } : {}),
    });
    return this.adminDetail(id);
  }

  async reject(staffId: string, id: string, reason: string) {
    await this.transit(id, ['requested', 'approved'], {
      status: 'rejected',
      rejectReason: reason,
      staffId,
    });
    return this.adminDetail(id);
  }

  /** Courier pickup booking is out of scope for v1: staff only records that one was arranged. */
  async pickupBooked(staffId: string, id: string, note?: string) {
    await this.transit(id, ['approved'], {
      status: 'pickup_booked',
      staffId,
      ...(note ? { note } : {}),
    });
    return this.adminDetail(id);
  }

  async receive(staffId: string, id: string) {
    await this.transit(id, ['approved', 'pickup_booked'], { status: 'received', staffId });
    return this.adminDetail(id);
  }

  async close(staffId: string, id: string) {
    await this.transit(id, ['inspected'], { status: 'closed', staffId });
    return this.adminDetail(id);
  }

  async inspect(staffId: string, id: string, dto: ReturnInspectDto) {
    await this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.findUnique({
        where: { id },
        include: { items: { include: { orderItem: true } } },
      });
      if (!ret)
        throw new ReturnError(HttpStatus.NOT_FOUND, 'RETURN_NOT_FOUND', 'Return not found.');
      await lockOrder(tx, ret.orderId);
      // Re-read the status under the order lock so two inspections can't both restock.
      const current = await tx.return.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (current.status !== 'received') this.badState(current.status, ['received']);
      const given = new Map(dto.items.map((i) => [i.returnItemId, i]));
      if (given.size !== dto.items.length || given.size !== ret.items.length) {
        throw new ReturnError(
          HttpStatus.BAD_REQUEST,
          'RETURN_INVALID',
          'Inspect every line of the return exactly once.',
        );
      }
      for (const line of ret.items) {
        const g = given.get(line.id);
        if (!g) {
          throw new ReturnError(
            HttpStatus.BAD_REQUEST,
            'RETURN_INVALID',
            'Unknown return line in inspection.',
          );
        }
        if (g.restock && g.condition !== 'resellable') {
          throw new ReturnError(
            HttpStatus.BAD_REQUEST,
            'RETURN_INVALID',
            'Only resellable items can be restocked.',
          );
        }
      }
      for (const line of ret.items) {
        const g = given.get(line.id);
        if (!g) continue;
        await tx.returnItem.update({
          where: { id: line.id },
          data: { condition: g.condition, restock: g.restock },
        });
        // Every inspected unit left the customer's hands; only resellable ones go back on the shelf.
        await tx.orderItem.update({
          where: { id: line.orderItemId },
          data: { qtyReturned: { increment: line.qty } },
        });
        if (g.restock) {
          await this.inventory.move(tx, {
            variantId: line.orderItem.variantId,
            qtyDelta: line.qty,
            reservedDelta: 0,
            reason: 'return_restock',
            refType: 'return',
            refId: id,
            staffId,
          });
        }
      }
      await tx.return.update({ where: { id }, data: { status: 'inspected', staffId } });
    });
    return this.adminDetail(id);
  }

  /** Compare-and-set on status so concurrent staff clicks can't both win. */
  private async transit(
    id: string,
    from: ReturnStatus[],
    data: Prisma.ReturnUncheckedUpdateManyInput,
  ) {
    const r = await this.prisma.return.updateMany({
      where: { id, status: { in: from } },
      data,
    });
    if (r.count === 1) return;
    const row = await this.prisma.return.findUnique({ where: { id }, select: { status: true } });
    if (!row) throw new ReturnError(HttpStatus.NOT_FOUND, 'RETURN_NOT_FOUND', 'Return not found.');
    this.badState(row.status, from);
  }

  private badState(status: ReturnStatus, allowed: ReturnStatus[]): never {
    throw new ReturnError(
      HttpStatus.CONFLICT,
      'RETURN_BAD_STATE',
      `Return is ${status}; this action needs ${allowed.join(' or ')}.`,
      { status },
    );
  }
}
