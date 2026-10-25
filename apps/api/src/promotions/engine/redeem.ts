import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { CommerceError } from '../../orders/commerce.errors';
import { releaseFlash } from '../flash/flash-core';
import type { PromoContext, PromoResult } from '../types';
import { limitReason } from './limits';
import { redemptionCounts } from './usage';

type Db = Prisma.TransactionClient;

const limitHit = (couponId: string, name: string, reason: string) =>
  new CommerceError(
    HttpStatus.CONFLICT,
    'COUPON_LIMIT',
    `The coupon "${name}" is no longer available.`,
    { couponId, reason },
  );

/**
 * Books the coupons of a placed order. Runs inside the order transaction: locks the coupon rows (sorted,
 * so concurrent orders cannot deadlock), re-checks limits against fresh counts and refuses with
 * COUPON_LIMIT when someone else used the last redemption in the meantime.
 */
export async function redeemPromotions(
  tx: Db,
  orderId: string,
  ctx: Pick<PromoContext, 'customerId' | 'phone' | 'visitorId'>,
  result: PromoResult,
) {
  if (result.applied.length === 0) return;
  const ids = [...new Set(result.applied.map((d) => d.couponId))].sort();
  await tx.$queryRaw`SELECT id FROM coupons WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
  const fresh = await tx.coupon.findMany({ where: { id: { in: ids } } });
  const counts = await redemptionCounts(tx, ids, ctx);
  const byId = new Map(fresh.map((c) => [c.id, c]));
  for (const d of result.applied) {
    const c = byId.get(d.couponId);
    const reason = c
      ? limitReason(
          c,
          counts[c.id] ?? { customer: 0, phone: 0, device: 0 },
          ctx,
          d.itemDiscountP + d.deliveryDiscountP,
        )
      : 'INACTIVE';
    if (!c || reason) throw limitHit(d.couponId, d.name, reason ?? 'INACTIVE');
    if (d.couponCodeId) {
      const n = await tx.$executeRaw`UPDATE coupon_codes SET used_at = now()
        WHERE id = ${d.couponCodeId}::uuid AND used_at IS NULL`;
      if (n === 0) throw limitHit(d.couponId, d.name, 'ALREADY_USED');
    }
    const discountP = d.itemDiscountP + d.deliveryDiscountP;
    await tx.couponRedemption.create({
      data: {
        couponId: d.couponId,
        couponCodeId: d.couponCodeId,
        orderId,
        customerId: ctx.customerId,
        phone: ctx.phone,
        visitorId: ctx.visitorId,
        discountP,
      },
    });
    await tx.coupon.update({
      where: { id: d.couponId },
      data: { usesCount: { increment: 1 }, discountGivenP: { increment: discountP } },
    });
  }
}

/**
 * Q90: a cancelled (or undeliverable) order gives its coupons and flash stock back. Safe to call twice:
 * only redemptions still `applied` are reversed, and the flash link on the order lines is cleared once
 * its stock is released.
 */
export async function reversePromotions(tx: Db, orderId: string) {
  const rows = await tx.couponRedemption.findMany({
    where: { orderId, status: 'applied' },
    orderBy: { couponId: 'asc' },
  });
  for (const r of rows) {
    // The status flip is the guard: a parallel second reversal updates 0 rows and skips the counters.
    const flipped = await tx.couponRedemption.updateMany({
      where: { id: r.id, status: 'applied' },
      data: { status: 'reversed', reversedAt: new Date() },
    });
    if (flipped.count === 0) continue;
    await tx.$executeRaw`UPDATE coupons SET uses_count = greatest(uses_count - 1, 0),
      discount_given_p = greatest(discount_given_p - ${r.discountP}, 0) WHERE id = ${r.couponId}::uuid`;
    if (r.couponCodeId) {
      await tx.couponCode.update({ where: { id: r.couponCodeId }, data: { usedAt: null } });
    }
  }
  const flashLines = await tx.orderItem.count({
    where: { orderId, flashSaleItemId: { not: null } },
  });
  if (flashLines > 0) {
    await releaseFlash(tx, orderId);
    await tx.orderItem.updateMany({ where: { orderId }, data: { flashSaleItemId: null } });
  }
}
