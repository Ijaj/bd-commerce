import { bundleConfigSchema, bxgyConfigSchema } from '../types';

/** The fields that decide whether a coupon makes sense (stored values merged with a patch). */
export interface CouponShape {
  kind: 'code' | 'auto';
  code: string | null;
  isBulk: boolean;
  type: 'percent' | 'fixed' | 'free_delivery' | 'bxgy' | 'tiered' | 'bundle';
  value: number;
  config: unknown;
  visibility: 'public' | 'hidden';
  isCollectable: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  segment: 'all' | 'first_order' | 'specific' | 'inactive_days';
  segmentParam: number | null;
  tiers: { minSpendP: number; discountP: number }[];
}

export type CouponPhase = 'draft' | 'scheduled' | 'live' | 'paused' | 'expired' | 'exhausted';

/** Problems that block saving. Empty list = ok. */
export function shapeIssues(s: CouponShape): string[] {
  const out: string[] = [];
  if (s.kind === 'auto') {
    if (s.code) out.push('An automatic coupon has no code.');
    if (s.isBulk) out.push('An automatic coupon cannot use bulk codes.');
    if (s.isCollectable) out.push('An automatic coupon cannot be collectable.');
  } else if (s.isBulk) {
    if (s.code) out.push('A bulk coupon has no single code; generate codes instead.');
  } else if (!s.code) {
    out.push('A code coupon needs a code (or mark it as bulk).');
  }
  if (s.isCollectable) {
    if (s.kind === 'code' && s.isBulk) out.push('Bulk coupons cannot be collectable.');
    if (s.visibility !== 'public') out.push('A collectable coupon must be public.');
  }
  if (s.startsAt && s.endsAt && s.endsAt <= s.startsAt)
    out.push('The end must be after the start.');

  switch (s.type) {
    case 'percent':
      if (s.value < 1 || s.value > 10_000) out.push('A percent value is 1 to 10000 basis points.');
      break;
    case 'fixed':
      if (s.value < 1) out.push('A fixed discount must be above zero.');
      break;
    default:
      if (s.value !== 0) out.push(`A ${s.type} coupon has no value.`);
  }

  if (s.type === 'tiered') {
    if (s.tiers.length === 0) out.push('A tiered coupon needs at least one tier.');
    for (let i = 1; i < s.tiers.length; i++) {
      const prev = s.tiers[i - 1];
      const cur = s.tiers[i];
      if (prev && cur && cur.minSpendP <= prev.minSpendP) {
        out.push('Tiers must have strictly ascending minimum spend.');
        break;
      }
    }
  } else if (s.tiers.length > 0) {
    out.push('Tiers only apply to tiered coupons.');
  }

  if (s.type === 'bxgy') {
    const cfg = bxgyConfigSchema.safeParse(s.config);
    if (!cfg.success) out.push(...zodIssues('config', cfg.error.issues));
    else if (!cfg.data.getSame && cfg.data.getProductIds.length === 0) {
      out.push('config.getProductIds: needed when the free items are other products.');
    }
  } else if (s.type === 'bundle') {
    const cfg = bundleConfigSchema.safeParse(s.config);
    if (!cfg.success) out.push(...zodIssues('config', cfg.error.issues));
  }

  if (s.segment === 'inactive_days') {
    if (!s.segmentParam) out.push('Inactive-days segment needs the number of days.');
  } else if (s.segmentParam !== null) {
    out.push('segmentParam only applies to the inactive_days segment.');
  }
  return out;
}

/** Extra checks before a coupon may go live. */
export function activationIssues(
  s: CouponShape,
  have: { customers: number; codes: number },
): string[] {
  const out: string[] = [];
  if (s.kind === 'code' && s.isBulk && have.codes === 0) {
    out.push('Generate at least one code first.');
  }
  if (s.segment === 'specific' && have.customers === 0 && !(s.kind === 'code' && s.isBulk)) {
    out.push('A specific-customers coupon needs at least one customer.');
  }
  return out;
}

function zodIssues(root: string, issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((i) => `${[root, ...i.path.map(String)].join('.')}: ${i.message}`);
}

/** Config as stored: parsed (defaults filled, unknown keys dropped) for bxgy/bundle, `{}` otherwise. */
export function normalizeConfig(
  type: CouponShape['type'],
  config: unknown,
): Record<string, unknown> {
  if (type === 'bxgy') {
    const r = bxgyConfigSchema.safeParse(config);
    return r.success ? r.data : {};
  }
  if (type === 'bundle') {
    const r = bundleConfigSchema.safeParse(config);
    return r.success ? r.data : {};
  }
  return {};
}

export interface PhaseInput {
  status: 'draft' | 'active' | 'paused';
  startsAt: Date | null;
  endsAt: Date | null;
  usesCount: number;
  maxUsesTotal: number | null;
  discountGivenP: number;
  budgetCapP: number | null;
}

export function isExhausted(c: PhaseInput): boolean {
  return (
    (c.maxUsesTotal !== null && c.usesCount >= c.maxUsesTotal) ||
    (c.budgetCapP !== null && c.discountGivenP >= c.budgetCapP)
  );
}

export function couponPhase(c: PhaseInput, now: Date): CouponPhase {
  if (c.status !== 'active') return c.status;
  if (c.endsAt && c.endsAt <= now) return 'expired';
  if (isExhausted(c)) return 'exhausted';
  if (c.startsAt && c.startsAt > now) return 'scheduled';
  return 'live';
}
