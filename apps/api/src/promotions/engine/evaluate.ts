import {
  type AppliedDiscount,
  type CodeRejection,
  type CodeRejectReason,
  EMPTY_PROMO,
  type PromoContext,
  type PromoResult,
} from '../types';
import { allocate } from './allocate';
import { rawDiscount } from './calc';
import type { ApplyOutcome, CouponCandidate, EngineState, PromoUsage } from './engine.types';
import { limitReason } from './limits';
import { eligibleLines } from './scope';

const MAX_CODES = 2;
const DAY_MS = 86_400_000;

function initialState(ctx: PromoContext): EngineState {
  return {
    remaining: new Map(ctx.lines.map((l) => [l.variantId, l.unitPriceP * l.qty])),
    deliveryLeftP: Math.max(ctx.deliveryChargeP, 0),
  };
}

function consume(state: EngineState, d: AppliedDiscount): EngineState {
  const remaining = new Map(state.remaining);
  for (const a of d.lineAllocations) {
    remaining.set(a.variantId, (remaining.get(a.variantId) ?? 0) - a.amountP);
  }
  return { remaining, deliveryLeftP: state.deliveryLeftP - d.deliveryDiscountP };
}

const totalOf = (d: AppliedDiscount) => d.itemDiscountP + d.deliveryDiscountP;

/** Everything about a coupon that does not depend on the cart contents. */
function staticReason(
  c: CouponCandidate,
  ctx: PromoContext,
  usage: PromoUsage,
): CodeRejectReason | null {
  const k = c.coupon;
  if (k.status !== 'active') return 'INACTIVE';
  if (k.startsAt && k.startsAt > ctx.now) return 'NOT_STARTED';
  if (k.endsAt && k.endsAt <= ctx.now) return 'EXPIRED';
  if (k.platform !== 'both' && k.platform !== ctx.platform) return 'PLATFORM';
  if (k.paymentMethods.length > 0 && !k.paymentMethods.includes(ctx.paymentMethod)) {
    return 'PAYMENT_METHOD';
  }
  // An empty zone id means the cart is priced before a delivery address exists.
  if (c.zoneIds.length > 0 && ctx.zoneId !== '' && !c.zoneIds.includes(ctx.zoneId)) return 'ZONE';

  if (c.codeRow?.usedAt) return 'ALREADY_USED';
  const assigned = c.codeRow?.assignedCustomerId ?? null;
  if (assigned && ctx.customerId !== assigned) {
    return ctx.customerId ? 'SEGMENT' : 'LOGIN_REQUIRED';
  }
  if (k.segment === 'specific' && !(assigned && assigned === ctx.customerId)) {
    if (!ctx.customerId) return 'LOGIN_REQUIRED';
    if (!c.customerIds.includes(ctx.customerId)) return 'SEGMENT';
  }
  if (k.segment === 'first_order' && usage.hasPriorOrder) return 'SEGMENT';
  if (k.segment === 'inactive_days') {
    const days = k.segmentParam ?? 0;
    if (usage.lastOrderAt && ctx.now.getTime() - usage.lastOrderAt.getTime() < days * DAY_MS) {
      return 'SEGMENT';
    }
  }
  return limitReason(k, usage.byCoupon[k.id] ?? { customer: 0, phone: 0, device: 0 }, ctx);
}

/** Applies one coupon to the running state (scope, minimums, amount, cap, allocation). */
function applyOne(c: CouponCandidate, ctx: PromoContext, state: EngineState): ApplyOutcome {
  const k = c.coupon;
  const { scoped, eligible } = eligibleLines(c, ctx.lines, state);
  const hasScopeTargets = c.targets.length > 0;
  // A delivery coupon without item targets does not care about the lines, only about the charge.
  const needsLines = k.type !== 'free_delivery' || hasScopeTargets;
  if (needsLines && eligible.length === 0) {
    return { ok: false, reason: scoped.length > 0 ? 'ONLY_REGULAR_PRICE' : 'NO_MATCHING_ITEMS' };
  }
  const base = k.type === 'free_delivery' && !hasScopeTargets ? ctx.lines : eligible;
  const baseLines = k.stacksWithSalePrice ? base : base.filter((l) => l.priceSource === 'base');
  if (k.minOrderP !== null) {
    const total = baseLines.reduce((s, l) => s + (state.remaining.get(l.variantId) ?? 0), 0);
    if (total < k.minOrderP) return { ok: false, reason: 'MIN_ORDER' };
  }
  if (k.minQty !== null && baseLines.reduce((n, l) => n + l.qty, 0) < k.minQty) {
    return { ok: false, reason: 'MIN_QTY' };
  }

  const raw = rawDiscount(c, eligible, ctx.lines, state);
  if (!raw) {
    return { ok: false, reason: k.type === 'tiered' ? 'MIN_ORDER' : 'NO_MATCHING_ITEMS' };
  }
  const weightSum = [...raw.weights.values()].reduce((a, b) => a + b, 0);
  const cap = k.maxDiscountP ?? Number.POSITIVE_INFINITY;
  const itemTotal = Math.min(raw.total, weightSum, cap);
  const deliveryTotal = Math.min(raw.deliveryP, state.deliveryLeftP, cap);
  if (k.budgetCapP !== null && k.discountGivenP + itemTotal + deliveryTotal > k.budgetCapP) {
    return { ok: false, reason: 'BUDGET_REACHED' };
  }
  const ids = [...raw.weights.keys()];
  const parts = allocate(
    itemTotal,
    ids.map((id) => raw.weights.get(id) as number),
  );
  return {
    ok: true,
    discount: {
      couponId: k.id,
      name: k.name,
      kind: k.kind,
      type: k.type,
      code: c.typedCode,
      couponCodeId: c.codeRow?.id ?? null,
      itemDiscountP: itemTotal,
      deliveryDiscountP: deliveryTotal,
      lineAllocations: ids
        .map((variantId, i) => ({ variantId, amountP: parts[i] as number }))
        .filter((a) => a.amountP > 0),
    },
  };
}

/** Pure promotion engine: which coupons apply to this cart and what each one takes off. */
export function evaluate(
  candidates: CouponCandidate[],
  ctx: PromoContext,
  usage: PromoUsage,
): PromoResult {
  const start = initialState(ctx);
  if (ctx.lines.length === 0 && ctx.codes.length === 0) return EMPTY_PROMO;

  let state = start;
  const chosen: { cand: CouponCandidate; discount: AppliedDiscount }[] = [];
  const rejected: CodeRejection[] = [];

  // Automatic coupons: best first, only stackable ones join the first.
  const autos = candidates
    .filter((c) => c.coupon.kind === 'auto' && staticReason(c, ctx, usage) === null)
    .flatMap((cand) => {
      const out = applyOne(cand, ctx, start);
      return out.ok && totalOf(out.discount) > 0
        ? [{ cand, standalone: totalOf(out.discount) }]
        : [];
    })
    .sort(
      (a, b) =>
        b.cand.coupon.priority - a.cand.coupon.priority ||
        b.standalone - a.standalone ||
        a.cand.coupon.id.localeCompare(b.cand.coupon.id),
    );
  for (const { cand } of autos) {
    const joins =
      chosen.length === 0 ||
      (cand.coupon.stacksWithOtherCoupons &&
        chosen.every((x) => x.cand.coupon.stacksWithOtherCoupons));
    if (!joins) continue;
    const out = applyOne(cand, ctx, state);
    if (!out.ok || totalOf(out.discount) === 0) continue;
    chosen.push({ cand, discount: out.discount });
    state = consume(state, out.discount);
  }

  // Typed codes in the order the customer added them.
  const seen = new Set<string>();
  for (const typed of ctx.codes) {
    const key = typed.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const reject = (reason: CodeRejectReason) => rejected.push({ code: key, reason });
    if (seen.size > MAX_CODES) {
      reject('NOT_STACKABLE');
      continue;
    }
    const cand = candidates.find((c) => c.typedCode === key);
    if (!cand) {
      reject('NOT_FOUND');
      continue;
    }
    const why = staticReason(cand, ctx, usage);
    if (why) {
      reject(why);
      continue;
    }
    if (chosen.some((x) => x.cand.coupon.id === cand.coupon.id)) {
      reject('NOT_STACKABLE');
      continue;
    }
    const stacks =
      chosen.length === 0 ||
      (cand.coupon.stacksWithOtherCoupons &&
        chosen.every((x) => x.cand.coupon.stacksWithOtherCoupons));
    if (stacks) {
      const out = applyOne(cand, ctx, state);
      if (!out.ok) reject(out.reason);
      else {
        chosen.push({ cand, discount: out.discount });
        state = consume(state, out.discount);
      }
      continue;
    }
    // Does not stack: it may take the place of the automatic coupons, never of another typed code.
    if (chosen.some((x) => x.cand.coupon.kind === 'code')) {
      reject('NOT_STACKABLE');
      continue;
    }
    const alone = applyOne(cand, ctx, start);
    if (!alone.ok) {
      reject(alone.reason);
      continue;
    }
    const autosTotal = chosen.reduce((s, x) => s + totalOf(x.discount), 0);
    if (totalOf(alone.discount) > autosTotal) {
      chosen.length = 0;
      chosen.push({ cand, discount: alone.discount });
      state = consume(start, alone.discount);
    } else {
      reject('NOT_STACKABLE');
    }
  }

  const applied = chosen.map((x) => x.discount);
  const lineDiscounts: Record<string, number> = {};
  for (const d of applied) {
    for (const a of d.lineAllocations) {
      lineDiscounts[a.variantId] = (lineDiscounts[a.variantId] ?? 0) + a.amountP;
    }
  }
  const sum = (kind: 'auto' | 'code') =>
    applied.filter((d) => d.kind === kind).reduce((s, d) => s + d.itemDiscountP, 0);
  return {
    applied,
    autoDiscountP: sum('auto'),
    couponDiscountP: sum('code'),
    deliveryDiscountP: applied.reduce((s, d) => s + d.deliveryDiscountP, 0),
    lineDiscounts,
    rejected,
  };
}
