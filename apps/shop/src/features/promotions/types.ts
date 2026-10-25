import type { components } from '@bdc/api-client';

export type PublicCoupon = components['schemas']['CouponPublicListDto']['items'][number];
export type WalletCoupon = components['schemas']['CouponWalletListDto']['items'][number];
export type FlashPublic = components['schemas']['FlashPublicDto'];
export type FlashSale = FlashPublic['live'][number];
export type CouponSuggestion = components['schemas']['CartCouponSuggestionsDto']['items'][number];
export type RejectReason = components['schemas']['CartDto']['rejectedCodes'][number]['reason'];

/** The fields every coupon shape (public, wallet) shares for display. */
export type CouponLike = {
  type: PublicCoupon['type'];
  value: number;
  maxDiscountP: number | null;
  minOrderP: number | null;
  startsAt: string | null;
  endsAt: string | null;
};
