import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { PromoContext, PromoResult } from '../types';
import { EMPTY_PROMO } from '../types';
import { couponInclude, liveWindow, loadCandidates, toCandidate } from './candidates';
import type { CouponCandidate } from './engine.types';
import { evaluate } from './evaluate';
import { redeemPromotions, reversePromotions } from './redeem';
import { loadUsage } from './usage';

type Db = Prisma.TransactionClient;

export interface CouponSuggestion {
  couponId: string;
  name: string;
  code: string | null;
  savingP: number;
  source: 'wallet' | 'public';
}

const MAX_SUGGESTIONS = 5;
const totalOf = (r: PromoResult) => r.autoDiscountP + r.couponDiscountP + r.deliveryDiscountP;

@Injectable()
export class PromotionsService {
  /** Which coupons apply to this cart right now (reads only; redeem books them). */
  async evaluate(db: Db, ctx: PromoContext): Promise<PromoResult> {
    if (ctx.lines.length === 0 && ctx.codes.length === 0) return EMPTY_PROMO;
    const candidates = await loadCandidates(db, ctx.now, ctx.codes);
    const usage = await loadUsage(
      db,
      candidates.map((c) => c.coupon.id),
      ctx,
    );
    return evaluate(candidates, ctx, usage);
  }

  redeem(tx: Db, orderId: string, ctx: PromoContext, result: PromoResult) {
    return redeemPromotions(tx, orderId, ctx, result);
  }

  reverse(tx: Db, orderId: string) {
    return reversePromotions(tx, orderId);
  }

  /** Code coupons the customer could add: their wallet, public codes and codes assigned to them. */
  async suggest(db: Db, ctx: PromoContext): Promise<CouponSuggestion[]> {
    if (ctx.lines.length === 0) return [];
    const inCart = new Set(ctx.codes.map((c) => c.trim().toUpperCase()));
    const live = liveWindow(ctx.now);
    const [publicRows, wallet, assigned] = await Promise.all([
      db.coupon.findMany({
        where: { kind: 'code', visibility: 'public', code: { not: null }, ...live },
        include: couponInclude,
        take: 50,
      }),
      ctx.customerId
        ? db.couponWallet.findMany({
            where: {
              customerId: ctx.customerId,
              coupon: { kind: 'code', code: { not: null }, ...live },
            },
            include: { coupon: { include: couponInclude } },
          })
        : Promise.resolve([]),
      ctx.customerId
        ? db.couponCode.findMany({
            where: { assignedCustomerId: ctx.customerId, usedAt: null, coupon: live },
            include: { coupon: { include: couponInclude } },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    const pool = new Map<string, { cand: CouponCandidate; source: 'wallet' | 'public' }>();
    for (const c of publicRows) {
      pool.set(c.id, { cand: toCandidate(c, null, c.code), source: 'public' });
    }
    for (const w of wallet) {
      pool.set(w.couponId, { cand: toCandidate(w.coupon, null, w.coupon.code), source: 'wallet' });
    }
    for (const a of assigned) {
      const codeRow = { id: a.id, assignedCustomerId: a.assignedCustomerId, usedAt: a.usedAt };
      pool.set(`${a.couponId}:${a.id}`, {
        cand: toCandidate(a.coupon, codeRow, a.code),
        source: 'wallet',
      });
    }
    const options = [...pool.values()].filter(
      (o) => o.cand.typedCode && !inCart.has(o.cand.typedCode),
    );
    if (options.length === 0) return [];

    const current = await loadCandidates(db, ctx.now, ctx.codes);
    const all = [...current, ...options.map((o) => o.cand)];
    const usage = await loadUsage(db, [...new Set(all.map((c) => c.coupon.id))], ctx);
    const baseTotal = totalOf(evaluate(current, ctx, usage));

    const out: CouponSuggestion[] = [];
    for (const o of options) {
      const code = o.cand.typedCode as string;
      const res = evaluate(all, { ...ctx, codes: [...ctx.codes, code] }, usage);
      if (res.rejected.some((r) => r.code === code)) continue;
      const savingP = totalOf(res) - baseTotal;
      if (savingP <= 0) continue;
      out.push({
        couponId: o.cand.coupon.id,
        name: o.cand.coupon.name,
        code,
        savingP,
        source: o.source,
      });
    }
    return out.sort((a, b) => b.savingP - a.savingP).slice(0, MAX_SUGGESTIONS);
  }
}
