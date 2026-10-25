import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { CommerceError } from '../orders/commerce.errors';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { readDiscounts } from '../promotions/engine/order-discounts';
import { ImageService } from '../storefront/images';
import { dayEndExclusive, dayStart, orderKey } from './order-lookup';
import type { OrdersAdminListQueryDto } from './orders-admin.dto';
import { OrdersAdminError } from './orders-admin.errors';

const listInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { select: { qty: true, qtyCancelled: true } },
  shipments: { select: { status: true } },
} satisfies Prisma.OrderInclude;

type ListRow = Prisma.OrderGetPayload<{ include: typeof listInclude }>;

/** Reasons are stored as JSON; never trust the shape. */
function reasonsOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Phone typed with +880 / 880 / spaces still finds the stored 01XXXXXXXXX. */
function phoneNeedle(q: string) {
  const d = q.replace(/[\s-]/g, '');
  if (/^\+?880\d+$/.test(d)) return `0${d.replace(/^\+?880/, '')}`;
  return d;
}

export function toListItem(o: ListRow) {
  const isGuest = o.customer === null;
  return {
    id: o.id,
    orderNo: o.orderNo,
    placedAt: o.placedAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    callStatus: o.callStatus,
    riskScore: o.riskScore,
    riskReasons: reasonsOf(o.riskReasons),
    callNote: o.callNote,
    callAt: o.callAt?.toISOString() ?? null,
    customer: {
      id: o.customer?.id ?? null,
      name: o.customer?.name ?? o.guestName ?? o.shipName,
      phone: o.customer?.phone ?? o.guestPhone ?? o.shipPhone,
      isGuest,
    },
    shipPlaceText: o.shipPlaceText,
    grandTotalP: o.grandTotalP,
    codDueP: o.codDueP,
    itemCount: o.items.reduce((n, i) => n + i.qty - i.qtyCancelled, 0),
    shipmentSummary: {
      total: o.shipments.filter((s) => s.status !== 'cancelled').length,
      delivered: o.shipments.filter((s) => s.status === 'delivered').length,
    },
  };
}

export { listInclude };

@Injectable()
export class OrdersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageService,
    private readonly status: OrderStatusService,
  ) {}

  async list(q: OrdersAdminListQueryDto) {
    const where: Prisma.OrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
    if (q.call) where.callStatus = q.call;
    if (q.risk === '1') where.riskScore = { gt: 0 };
    if (q.from || q.to) {
      where.placedAt = {
        ...(q.from ? { gte: dayStart(q.from) } : {}),
        ...(q.to ? { lt: dayEndExclusive(q.to) } : {}),
      };
    }
    if (q.q) {
      const phone = phoneNeedle(q.q);
      where.OR = [
        { orderNo: { contains: q.q, mode: 'insensitive' } },
        { shipPhone: { contains: phone } },
        { guestPhone: { contains: phone } },
        { shipName: { contains: q.q, mode: 'insensitive' } },
        { guestName: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: listInclude,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { items: rows.map(toListItem), total, page: q.page, pageSize: q.pageSize };
  }

  async detail(idOrNo: string) {
    const o = await this.prisma.order.findUnique({
      where: orderKey(idOrNo),
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        zone: { select: { id: true, nameEn: true, nameBn: true } },
        items: { orderBy: { id: 'asc' } },
        history: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
        payments: { orderBy: { initiatedAt: 'asc' } },
        shipments: {
          orderBy: { createdAt: 'asc' },
          include: { courier: { select: { code: true } }, items: true },
        },
        invoices: { orderBy: { issuedAt: 'asc' } },
        returns: { orderBy: { requestedAt: 'asc' } },
        refunds: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!o) throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');

    const staffIds = [
      ...new Set(
        [o.callStaffId, ...o.history.map((h) => h.actorId)].filter((x): x is string => !!x),
      ),
    ];
    const [staff, media] = await Promise.all([
      staffIds.length
        ? this.prisma.staff.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true },
          })
        : [],
      this.imageSets(o.items.map((i) => i.imageMediaId)),
    ]);
    const staffName = new Map(staff.map((s) => [s.id, s.name]));

    const shippedBy = new Map<string, number>();
    for (const s of o.shipments) {
      if (s.status === 'cancelled') continue;
      for (const it of s.items) {
        shippedBy.set(it.orderItemId, (shippedBy.get(it.orderItemId) ?? 0) + it.qty);
      }
    }

    return {
      id: o.id,
      orderNo: o.orderNo,
      placedAt: o.placedAt.toISOString(),
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethodChosen,
      lang: o.lang,
      platform: o.platform,
      isPreorder: o.isPreorder,
      customerNote: o.customerNote,
      cancelReason: o.cancelReason,
      heldReason: o.heldReason,
      customer: {
        id: o.customer?.id ?? null,
        name: o.customer?.name ?? o.guestName ?? o.shipName,
        phone: o.customer?.phone ?? o.guestPhone ?? o.shipPhone,
        isGuest: o.customer === null,
      },
      shipTo: {
        name: o.shipName,
        phone: o.shipPhone,
        placeText: o.shipPlaceText,
        line: o.shipLine,
        landmark: o.shipLandmark,
        districtId: o.shipDistrictId,
        upazilaId: o.shipUpazilaId,
        areaId: o.shipAreaId,
      },
      zone: o.zone,
      money: {
        subtotalP: o.subtotalP,
        autoDiscountP: o.autoDiscountP,
        couponDiscountP: o.couponDiscountP,
        deliveryChargeP: o.deliveryChargeP,
        deliveryDiscountP: o.deliveryDiscountP,
        grandTotalP: o.grandTotalP,
        advanceRequiredP: o.advanceRequiredP,
        paidP: o.paidP,
        refundedP: o.refundedP,
        codDueP: o.codDueP,
      },
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        titleSnapshot: i.titleSnapshot,
        sku: i.sku,
        optionsText: i.optionsText,
        image: (i.imageMediaId && media.get(i.imageMediaId)) || null,
        qty: i.qty,
        qtyCancelled: i.qtyCancelled,
        qtyShipped: shippedBy.get(i.id) ?? 0,
        qtyReturned: i.qtyReturned,
        unitPriceP: i.unitPriceP,
        lineTotalP: i.lineTotalP,
        discountP: i.discountP,
        priceSource: i.priceSource,
      })),
      discounts: readDiscounts(o.discountsJson),
      history: o.history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorType: h.actorType,
        actorId: h.actorId,
        actorName: (h.actorId && staffName.get(h.actorId)) || null,
        note: h.note,
        at: h.at.toISOString(),
      })),
      payments: o.payments.map((p) => ({
        id: p.id,
        method: p.method,
        purpose: p.purpose,
        amountP: p.amountP,
        status: p.status,
        paidAt: p.paidAt?.toISOString() ?? null,
      })),
      shipments: o.shipments.map((s) => ({
        id: s.id,
        shipmentNo: s.shipmentNo,
        status: s.status,
        courierCode: s.courier?.code ?? null,
        consignmentId: s.consignmentId,
        trackingUrl: s.trackingUrl,
        codAmountP: s.codAmountP,
        items: s.items.map((it) => ({ orderItemId: it.orderItemId, qty: it.qty })),
      })),
      invoices: o.invoices.map((v) => ({
        id: v.id,
        invoiceNo: v.invoiceNo,
        issuedAt: v.issuedAt.toISOString(),
      })),
      returns: o.returns.map((r) => ({ id: r.id, returnNo: r.returnNo, status: r.status })),
      refunds: o.refunds.map((r) => ({
        id: r.id,
        amountP: r.amountP,
        status: r.status,
        method: r.method,
      })),
      risk: { score: o.riskScore, reasons: reasonsOf(o.riskReasons) },
      call: {
        status: o.callStatus,
        note: o.callNote,
        staffName: (o.callStaffId && staffName.get(o.callStaffId)) || null,
        at: o.callAt?.toISOString() ?? null,
      },
    };
  }

  private async imageSets(mediaIds: (string | null)[]) {
    const ids = [...new Set(mediaIds.filter((x): x is string => x !== null))];
    if (ids.length === 0) return new Map<string, ReturnType<ImageService['set']>>();
    const media = await this.prisma.media.findMany({ where: { id: { in: ids } } });
    return new Map(media.map((m) => [m.id, this.images.set(m)]));
  }

  async hold(idOrNo: string, staffId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.lock(tx, idOrNo);
      if (!['processing', 'partially_shipped'].includes(o.status)) {
        throw new OrdersAdminError(
          HttpStatus.CONFLICT,
          'ORDER_NOT_HOLDABLE',
          `An order that is ${o.status} cannot be put on hold.`,
        );
      }
      await this.status.transition(tx, o.id, 'on_hold', { type: 'staff', id: staffId }, reason, {
        heldReason: reason,
      });
      return o.orderNo;
    });
  }

  /** Hold remembers nothing about the earlier status: resume re-derives it from the shipments. */
  async resume(idOrNo: string, staffId: string) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.lock(tx, idOrNo);
      if (o.status !== 'on_hold') {
        throw new OrdersAdminError(
          HttpStatus.CONFLICT,
          'ORDER_NOT_ON_HOLD',
          'Only an order on hold can be resumed.',
        );
      }
      const actor = { type: 'staff' as const, id: staffId };
      await this.status.transition(tx, o.id, 'processing', actor, 'Resumed', { heldReason: null });
      await this.status.recompute(tx, o.id, actor);
      return o.orderNo;
    });
  }

  private async lock(tx: Prisma.TransactionClient, idOrNo: string) {
    const o = await tx.order.findUnique({
      where: orderKey(idOrNo),
      select: { id: true, orderNo: true },
    });
    if (!o) throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${o.id}::uuid FOR UPDATE`;
    const fresh = await tx.order.findUniqueOrThrow({
      where: { id: o.id },
      select: { id: true, orderNo: true, status: true },
    });
    return fresh;
  }
}
