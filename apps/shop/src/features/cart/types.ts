import type { components } from '@bdc/api-client';

export type Cart = components['schemas']['CartDto'];
export type CartLine = Cart['items'][number];

export const EMPTY_CART: Cart = {
  items: [],
  count: 0,
  subtotalP: 0,
  discountP: 0,
  appliedCoupons: [],
  codes: [],
  rejectedCodes: [],
};

/** Why the visitor was sent back to the cart (query `?notice=`). */
export type CartNotice =
  | 'changed'
  | 'stock'
  | 'empty'
  | 'flash'
  | 'flash_sold'
  | 'coupon'
  | 'coupon_limit';
