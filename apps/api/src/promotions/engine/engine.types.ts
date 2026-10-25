import type { AppliedDiscount, CodeRejectReason, PromoLine } from '../types';

/** Coupon as the pure engine needs it (loaded by PromotionsService, built by hand in unit tests). */
export interface CouponRow {
  id: string;
  name: string;
  kind: 'code' | 'auto';
  type: AppliedDiscount['type'];
  status: 'draft' | 'active' | 'paused';
  value: number;
  maxDiscountP: number | null;
  config: unknown;
  minOrderP: number | null;
  minQty: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  segment: 'all' | 'first_order' | 'specific' | 'inactive_days';
  segmentParam: number | null;
  paymentMethods: string[];
  platform: 'web' | 'app' | 'both';
  maxUsesTotal: number | null;
  maxPerCustomer: number | null;
  maxPerPhone: number | null;
  maxPerDevice: number | null;
  budgetCapP: number | null;
  usesCount: number;
  discountGivenP: number;
  stacksWithSalePrice: boolean;
  stacksWithOtherCoupons: boolean;
  priority: number;
}

export interface CouponTargetRow {
  targetType: 'product' | 'category' | 'brand';
  targetId: string;
  mode: 'include' | 'exclude';
}

export interface CouponCandidate {
  coupon: CouponRow;
  targets: CouponTargetRow[];
  zoneIds: string[];
  tiers: { minSpendP: number; discountP: number }[];
  customerIds: string[];
  /** The bulk code row this candidate was reached through, if any. */
  codeRow: { id: string; assignedCustomerId: string | null; usedAt: Date | null } | null;
  /** Upper-cased code the customer would type (coupon.code or the bulk code); null for auto coupons. */
  typedCode: string | null;
}

export interface CouponUsage {
  customer: number;
  phone: number;
  device: number;
}

export interface PromoUsage {
  /** The buyer has a non-cancelled order already (first_order segment). */
  hasPriorOrder: boolean;
  lastOrderAt: Date | null;
  byCoupon: Record<string, CouponUsage>;
}

export const NO_USAGE: PromoUsage = { hasPriorOrder: false, lastOrderAt: null, byCoupon: {} };

/** Running state while coupons are applied one after another. */
export interface EngineState {
  /** Amount left per variant line after earlier discounts. */
  remaining: Map<string, number>;
  deliveryLeftP: number;
}

export type ApplyOutcome =
  | { ok: true; discount: AppliedDiscount }
  | { ok: false; reason: CodeRejectReason };

export type { PromoLine };
