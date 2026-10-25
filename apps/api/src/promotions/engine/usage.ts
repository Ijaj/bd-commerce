import type { Prisma } from '../../generated/prisma/client';
import type { PromoContext } from '../types';
import type { CouponUsage, PromoUsage } from './engine.types';

type Db = Prisma.TransactionClient;

/** Same notion of "the same buyer" as flash limits: customer, phone (guest or ship-to) or device. */
function buyerOrders(ctx: Pick<PromoContext, 'customerId' | 'phone' | 'visitorId'>) {
  const ors: Prisma.OrderWhereInput[] = [];
  if (ctx.customerId) ors.push({ customerId: ctx.customerId });
  if (ctx.phone) ors.push({ guestPhone: ctx.phone }, { shipPhone: ctx.phone });
  return ors;
}

/** Redemption counts per coupon for this buyer on each identity (customer / phone / device). */
export async function redemptionCounts(
  db: Db,
  couponIds: string[],
  ctx: Pick<PromoContext, 'customerId' | 'phone' | 'visitorId'>,
) {
  const out: Record<string, CouponUsage> = {};
  for (const id of couponIds) out[id] = { customer: 0, phone: 0, device: 0 };
  if (couponIds.length === 0) return out;
  const dims = [
    ['customer', ctx.customerId ? { customerId: ctx.customerId } : null],
    ['phone', ctx.phone ? { phone: ctx.phone } : null],
    ['device', ctx.visitorId ? { visitorId: ctx.visitorId } : null],
  ] as const;
  for (const [dim, where] of dims) {
    if (!where) continue;
    const rows = await db.couponRedemption.groupBy({
      by: ['couponId'],
      where: { couponId: { in: couponIds }, status: 'applied', ...where },
      _count: { _all: true },
    });
    for (const r of rows) (out[r.couponId] as CouponUsage)[dim] = r._count._all;
  }
  return out;
}

export async function loadUsage(
  db: Db,
  couponIds: string[],
  ctx: PromoContext,
): Promise<PromoUsage> {
  const ors = buyerOrders(ctx);
  const orders = ors.length
    ? await db.order.aggregate({
        _count: { _all: true },
        _max: { placedAt: true },
        where: { status: { not: 'cancelled' }, OR: ors },
      })
    : null;
  return {
    hasPriorOrder: (orders?._count._all ?? 0) > 0,
    lastOrderAt: orders?._max.placedAt ?? null,
    byCoupon: await redemptionCounts(db, couponIds, ctx),
  };
}
