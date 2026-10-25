import type { PromoLine } from '../types';
import type { CouponCandidate, CouponTargetRow, EngineState } from './engine.types';

function matches(t: CouponTargetRow, l: PromoLine) {
  if (t.targetType === 'product') return l.productId === t.targetId;
  if (t.targetType === 'brand') return l.brandId === t.targetId;
  return l.categoryIds.includes(t.targetId);
}

/** Lines the coupon's include/exclude targets cover (no include targets = every line). */
export function inScope(c: CouponCandidate, lines: PromoLine[], state: EngineState) {
  const inc = c.targets.filter((t) => t.mode === 'include');
  const exc = c.targets.filter((t) => t.mode === 'exclude');
  return lines.filter(
    (l) =>
      (state.remaining.get(l.variantId) ?? 0) > 0 &&
      (inc.length === 0 || inc.some((t) => matches(t, l))) &&
      !exc.some((t) => matches(t, l)),
  );
}

/** In-scope lines minus sale/flash lines unless the coupon stacks with sale prices. */
export function eligibleLines(c: CouponCandidate, lines: PromoLine[], state: EngineState) {
  const scoped = inScope(c, lines, state);
  const eligible = c.coupon.stacksWithSalePrice
    ? scoped
    : scoped.filter((l) => l.priceSource === 'base');
  return { scoped, eligible };
}
