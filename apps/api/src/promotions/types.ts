import { z } from 'zod';

/** Percent values are basis points (10000 = 100%); money is paisa. */
export const bxgyConfigSchema = z.object({
  buyQty: z.number().int().min(1).max(100),
  getQty: z.number().int().min(1).max(100),
  /** Discount on the "get" units: 10000 = free. */
  getPctBp: z.number().int().min(1).max(10000),
  /** true: the cheapest eligible units are the "get" units; false: only getProductIds count as "get". */
  getSame: z.boolean(),
  getProductIds: z.array(z.uuid()).max(50).default([]),
});
export type BxgyConfig = z.infer<typeof bxgyConfigSchema>;

export const bundleConfigSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        /** Omitted = any variant of the product. */
        variantId: z.uuid().optional(),
        qty: z.number().int().min(1).max(100),
      }),
    )
    .min(2)
    .max(10),
  /** Price for one full set. */
  priceP: z.number().int().min(0),
});
export type BundleConfig = z.infer<typeof bundleConfigSchema>;

/** Order line as the promotion engine sees it (built from CartLineDetail + catalog ids). */
export interface PromoLine {
  variantId: string;
  productId: string;
  brandId: string | null;
  /** The product's categories plus all their ancestors, so a category target matches descendants. */
  categoryIds: string[];
  qty: number;
  /** Price after sale/flash (what the cart shows). */
  unitPriceP: number;
  priceSource: 'base' | 'sale' | 'flash';
}

export interface PromoContext {
  lines: PromoLine[];
  zoneId: string;
  /** Delivery charge before any coupon (zone rules + free threshold already applied). */
  deliveryChargeP: number;
  customerId: string | null;
  phone: string | null;
  visitorId: string | null;
  platform: 'web' | 'app';
  paymentMethod: string;
  /** Codes typed by the customer (Cart.couponCodes), original case. */
  codes: string[];
  now: Date;
}

export interface AppliedDiscount {
  couponId: string;
  name: string;
  kind: 'code' | 'auto';
  type: 'percent' | 'fixed' | 'free_delivery' | 'bxgy' | 'tiered' | 'bundle';
  /** Typed or bulk code text; null for auto coupons. */
  code: string | null;
  couponCodeId: string | null;
  /** Off item prices (sum of lineAllocations). */
  itemDiscountP: number;
  /** Off the delivery charge. */
  deliveryDiscountP: number;
  /** Item discount per variant line; sums to itemDiscountP. */
  lineAllocations: { variantId: string; amountP: number }[];
}

export type CodeRejectReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'MIN_ORDER'
  | 'MIN_QTY'
  | 'NO_MATCHING_ITEMS'
  | 'SEGMENT'
  | 'LIMIT_REACHED'
  | 'BUDGET_REACHED'
  | 'PLATFORM'
  | 'PAYMENT_METHOD'
  | 'ZONE'
  | 'NOT_STACKABLE'
  | 'ONLY_REGULAR_PRICE'
  | 'ALREADY_USED'
  | 'LOGIN_REQUIRED';

export interface CodeRejection {
  code: string;
  reason: CodeRejectReason;
}

export interface PromoResult {
  applied: AppliedDiscount[];
  /** Sum of itemDiscountP of kind auto. */
  autoDiscountP: number;
  /** Sum of itemDiscountP of kind code. */
  couponDiscountP: number;
  /** Total delivery discount from coupons (add to the zone's own delivery discount). */
  deliveryDiscountP: number;
  /** Total item discount per variant line (auto + code). */
  lineDiscounts: Record<string, number>;
  /** Typed codes that did not apply; the cart drops them. */
  rejected: CodeRejection[];
}

export const EMPTY_PROMO: PromoResult = {
  applied: [],
  autoDiscountP: 0,
  couponDiscountP: 0,
  deliveryDiscountP: 0,
  lineDiscounts: {},
  rejected: [],
};

/** Per-order snapshot kept in orders.discounts_json. */
export interface OrderDiscountSnapshot {
  couponId: string;
  name: string;
  kind: 'code' | 'auto';
  type: AppliedDiscount['type'];
  code: string | null;
  amountP: number;
  deliveryP: number;
}
