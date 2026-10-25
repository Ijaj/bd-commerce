import type { AppliedDiscount, CodeRejectReason } from '../promotions/types';
import type { ImageSet } from '../storefront/images';

export type CartProblem = 'out_of_stock' | 'qty_reduced' | 'unavailable' | 'upcoming';

export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  titleEn: string;
  titleBn: string | null;
  optionsTextEn: string | null;
  optionsTextBn: string | null;
  image: ImageSet | null;
  qty: number;
  unitPriceP: number;
  compareAtP: number | null;
  priceAtAddP: number;
  priceChanged: boolean;
  available: number;
  maxQty: number;
  problem: CartProblem | null;
  /** Flash sale end (ISO) while the line is at flash price. */
  flashEndsAt: string | null;
  /** Item discount from coupons on this line (view only; 0 until the promotion engine ran). */
  discountP: number;
}

/** A cart line plus what checkout snapshots into the order. Not sent to clients. */
export interface CartLineDetail extends CartLine {
  sellerId: string;
  sku: string;
  weightG: number | null;
  returnWindowDays: number | null;
  unitBaseP: number;
  priceSource: 'base' | 'sale' | 'flash';
  /** Flash item the line is priced from; checkout claims its stock. */
  flashItemId: string | null;
  /** maxQty is held down by the flash allowance (stock left or the buyer's personal limit). */
  flashCapped: boolean;
  brandId: string | null;
  categoryIds: string[];
  isPreorder: boolean;
  /// Stock is reserved only for stock-fulfilled, non-preorder lines.
  reserves: boolean;
  deliveryChargeOverrideP: number | null;
  imageMediaId: string | null;
}

export interface AppliedCouponView {
  couponId: string;
  name: string;
  kind: 'code' | 'auto';
  type: AppliedDiscount['type'];
  code: string | null;
  /** Item plus delivery discount this coupon gives. */
  amountP: number;
  freeDelivery: boolean;
}

export interface CartView {
  items: CartLine[];
  count: number;
  subtotalP: number;
  /** Auto and code item discounts together. */
  discountP: number;
  appliedCoupons: AppliedCouponView[];
  /** Codes still in the cart. */
  codes: string[];
  /** Codes dropped from the cart on this read, with why. */
  rejectedCodes: { code: string; reason: CodeRejectReason }[];
}

export const EMPTY_CART_VIEW: CartView = {
  items: [],
  count: 0,
  subtotalP: 0,
  discountP: 0,
  appliedCoupons: [],
  codes: [],
  rejectedCodes: [],
};

/** A category path is `/a/b/c/` (ancestor ids, self last): a product sits in all of them. */
export function categoryIdsOf(paths: string[]) {
  return [...new Set(paths.flatMap((p) => p.split('/').filter(Boolean)))];
}

export function subtotalOf(lines: CartLine[]) {
  return lines.reduce((sum, l) => (l.problem === null ? sum + l.unitPriceP * l.qty : sum), 0);
}
