import { HttpStatus, Injectable } from '@nestjs/common';
import { type Prisma, ShipmentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ShipmentCreateDto, ShipmentListQueryDto } from './shipments.dto';
import { ShipmentError } from './shipments.errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DHAKA_OFFSET_MS = 6 * 3600_000;

export const SHIPMENT_INCLUDE = {
  courier: { select: { code: true, name: true } },
  order: { select: { orderNo: true, shipName: true, shipPhone: true, shipPlaceText: true } },
  items: {
    orderBy: { id: 'asc' },
    include: { orderItem: { select: { titleSnapshot: true, sku: true, optionsText: true } } },
  },
} satisfies Prisma.ShipmentInclude;

export type ShipmentRow = Prisma.ShipmentGetPayload<{ include: typeof SHIPMENT_INCLUDE }>;

export function toShipmentView(s: ShipmentRow) {
  return {
    id: s.id,
    shipmentNo: s.shipmentNo,
    orderId: s.orderId,
    orderNo: s.order.orderNo,
    status: s.status,
    source: s.source,
    courier: s.courier,
    consignmentId: s.consignmentId,
    trackingUrl: s.trackingUrl,
    codAmountP: s.codAmountP,
    deliveryChargeShareP: s.deliveryChargeShareP,
    weightG: s.weightG,
    note: s.note,
    recipient: {
      name: s.order.shipName,
      phone: s.order.shipPhone,
      placeText: s.order.shipPlaceText,
    },
    items: s.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      qty: i.qty,
      titleSnapshot: i.orderItem.titleSnapshot,
      sku: i.orderItem.sku,
      optionsText: i.orderItem.optionsText,
    })),
    packedAt: s.packedAt?.toISOString() ?? null,
    handedAt: s.handedAt?.toISOString() ?? null,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Locks the shipment row so booking, handover and status updates for it run one at a time. */
export async function lockShipment(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT 1 FROM shipments WHERE id = ${id}::uuid FOR UPDATE`;
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveOrderId(idOrNo: string, db: Prisma.TransactionClient = this.prisma) {
    const order = await db.order.findFirst({
      where: UUID.test(idOrNo) ? { id: idOrNo } : { orderNo: idOrNo },
      select: { id: true },
    });
    if (!order) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found');
    }
    return order.id;
  }

  async view(id: string, db: Prisma.TransactionClient = this.prisma) {
    const s = await db.shipment.findUnique({ where: { id }, include: SHIPMENT_INCLUDE });
    if (!s) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
    }
    return toShipmentView(s);
  }

  async detail(id: string) {
    const s = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        ...SHIPMENT_INCLUDE,
        bookings: {
          orderBy: [{ attempt: 'asc' }, { createdAt: 'asc' }],
          include: {
            courier: { select: { code: true } },
            events: { orderBy: { at: 'asc' } },
          },
        },
      },
    });
    if (!s) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
    }
    return {
      ...toShipmentView(s),
      bookings: s.bookings.map((b) => ({
        id: b.id,
        attempt: b.attempt,
        courierCode: b.courier.code,
        status: b.status,
        consignmentId: b.consignmentId,
        request: (b.request as Record<string, unknown> | null) ?? null,
        response: b.response ?? null,
        createdAt: b.createdAt.toISOString(),
      })),
      events: s.bookings.flatMap((b) =>
        b.events.map((e) => ({
          id: e.id,
          bookingId: b.id,
          rawStatus: e.rawStatus,
          mappedStatus: e.mappedStatus,
          at: e.at.toISOString(),
        })),
      ),
    };
  }

  async forOrder(idOrNo: string) {
    const orderId = await this.resolveOrderId(idOrNo);
    const rows = await this.prisma.shipment.findMany({
      where: { orderId },
      include: SHIPMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return { items: rows.map(toShipmentView) };
  }

  async list(q: ShipmentListQueryDto) {
    const where: Prisma.ShipmentWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.courier ? { courier: { code: q.courier } } : {}),
      ...(q.q
        ? {
            OR: [
              { shipmentNo: { contains: q.q, mode: 'insensitive' } },
              { consignmentId: { contains: q.q, mode: 'insensitive' } },
              { order: { orderNo: { contains: q.q, mode: 'insensitive' } } },
              { order: { shipPhone: { contains: q.q } } },
              { order: { shipName: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        include: SHIPMENT_INCLUDE,
        orderBy: { createdAt: q.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { items: rows.map(toShipmentView), total, page: q.page, pageSize: q.pageSize };
  }

  /**
   * Splits part of an order into a warehouse shipment (status ready). Money rules (Q92): the
   * delivery charge the customer pays rides on the first live shipment only; the courier collects
   * the shipment's share of goods (after order discounts) plus that charge, never more than the
   * COD still owed, and the shipment that completes the order collects exactly the remainder.
   */
  async create(idOrNo: string, input: ShipmentCreateDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const orderId = await this.resolveOrderId(idOrNo, tx);
      // Serialises concurrent splits of one order so qty and COD allocation stay consistent.
      await tx.$executeRaw`SELECT 1 FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      if (!['processing', 'partially_shipped'].includes(order.status)) {
        throw new ShipmentError(
          HttpStatus.CONFLICT,
          'ORDER_NOT_SHIPPABLE',
          `An order that is ${order.status} cannot get a new shipment`,
        );
      }

      const wanted = new Map<string, number>();
      for (const it of input.items) {
        if (wanted.has(it.orderItemId)) {
          throw new ShipmentError(
            HttpStatus.BAD_REQUEST,
            'SHIPMENT_ITEM_INVALID',
            'Each order line can appear once',
          );
        }
        wanted.set(it.orderItemId, it.qty);
      }
      const byId = new Map(order.items.map((i) => [i.id, i]));
      for (const itemId of wanted.keys()) {
        if (!byId.has(itemId)) {
          throw new ShipmentError(
            HttpStatus.BAD_REQUEST,
            'SHIPMENT_ITEM_INVALID',
            'Line does not belong to this order',
            { orderItemId: itemId },
          );
        }
      }

      const live = await tx.shipment.findMany({
        where: { orderId, status: { not: ShipmentStatus.cancelled } },
        select: {
          status: true,
          codAmountP: true,
          deliveryChargeShareP: true,
          items: { select: { orderItemId: true, qty: true } },
        },
      });
      const shipped = new Map<string, number>();
      for (const s of live) {
        for (const i of s.items)
          shipped.set(i.orderItemId, (shipped.get(i.orderItemId) ?? 0) + i.qty);
      }
      let allCovered = true;
      for (const item of order.items) {
        const free = item.qty - item.qtyCancelled - (shipped.get(item.id) ?? 0);
        const take = wanted.get(item.id) ?? 0;
        if (take > free) {
          throw new ShipmentError(
            HttpStatus.CONFLICT,
            'SHIPMENT_QTY_EXCEEDED',
            'More than the unshipped quantity',
            { orderItemId: item.id, free },
          );
        }
        if (take < free) allCovered = false;
      }

      const netCharge = Math.max(0, order.deliveryChargeP - order.deliveryDiscountP);
      const chargeTaken = live.reduce((n, s) => n + s.deliveryChargeShareP, 0);
      const chargeShare = Math.max(0, netCharge - chargeTaken);

      // Budget = COD still owed + COD already collected through delivered shipments.
      const collected = live
        .filter((s) => s.status === 'delivered')
        .reduce((n, s) => n + s.codAmountP, 0);
      const consumed = live.reduce((n, s) => n + s.codAmountP, 0);
      const available = Math.max(0, order.codDueP + collected - consumed);
      const goodsNet = BigInt(order.subtotalP - order.autoDiscountP - order.couponDiscountP);
      let value = 0n;
      let weight = 0;
      for (const [itemId, n] of wanted) {
        const item = byId.get(itemId);
        if (!item) continue;
        value += BigInt(item.unitPriceP) * BigInt(n);
        weight += (item.weightG ?? 0) * n;
      }
      const goodsShare =
        order.subtotalP > 0
          ? Number(
              (goodsNet * value * 2n + BigInt(order.subtotalP)) / (BigInt(order.subtotalP) * 2n),
            )
          : 0;
      const codAmountP = allCovered
        ? available
        : Math.min(Math.max(0, goodsShare) + chargeShare, available);

      const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('shipment_no_seq') AS n`;
      const now = new Date();
      const d = new Date(now.getTime() + DHAKA_OFFSET_MS);
      const yymm = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const shipment = await tx.shipment.create({
        data: {
          orderId,
          shipmentNo: `SHP-${yymm}-${String(seq[0]?.n ?? 0n).padStart(5, '0')}`,
          sellerId: order.items[0]?.sellerId ?? (await tx.seller.findFirstOrThrow()).id,
          source: 'warehouse',
          status: 'ready',
          weightG: weight,
          codAmountP,
          deliveryChargeShareP: chargeShare,
          note: input.note ?? null,
          packedAt: now,
          items: {
            create: [...wanted].map(([orderItemId, qty]) => ({ orderItemId, qty })),
          },
        },
      });
      return shipment.id;
    });
    return this.view(id);
  }
}
