import type { ApiFail } from '~/features/account/lib';
import type { CartNotice } from '~/features/cart/types';
import { fmt } from '~/i18n';
import { localizeDigits } from '~/lib/format';
import type { CheckoutDict } from './strings.en';

/** Whole minutes (at least 1) for a retry-after in seconds. */
export function retryMinutes(sec: number): number {
  return Math.max(1, Math.ceil(sec / 60));
}

/** Friendly text for a failed checkout call: stable API `code` first, then the HTTP status. */
export function checkoutError(
  e: ApiFail,
  errors: CheckoutDict['errors'],
  lang: 'en' | 'bn' = 'en',
): string {
  if (e.code === 'NETWORK') return errors.network;
  if (e.code === 'TOO_MANY_ATTEMPTS' && e.retryAfterSec) {
    return fmt(errors.TOO_MANY_ATTEMPTS_IN, {
      m: localizeDigits(retryMinutes(e.retryAfterSec), lang),
    });
  }
  if (e.code === 'GUEST_LIMIT') {
    return e.reason === 'daily_cap' ? errors.GUEST_LIMIT_daily_cap : errors.GUEST_LIMIT_open_orders;
  }
  if (e.code && e.code in errors) return errors[e.code as keyof CheckoutDict['errors']];
  if (e.status === 429) return errors.TOO_MANY_REQUESTS;
  if (e.status === 400) return errors.validation;
  return errors.generic;
}

/** Codes that mean "the cart is not what the customer saw": send them back to the cart. */
export function cartNoticeFor(code: string | null): CartNotice | null {
  switch (code) {
    case 'CART_CHANGED':
      return 'changed';
    case 'OUT_OF_STOCK':
      return 'stock';
    case 'CART_EMPTY':
      return 'empty';
    case 'FLASH_LIMIT':
      return 'flash';
    case 'FLASH_SOLD_OUT':
      return 'flash_sold';
    case 'COUPON_INVALID':
      return 'coupon';
    case 'COUPON_LIMIT':
      return 'coupon_limit';
    default:
      return null;
  }
}

/** What the success page shows right after placing (guests cannot load the order from the API). */
export type PlacedOrder = {
  orderNo: string;
  grandTotalP: number;
  codDueP: number;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  zoneName: string | null;
  /** What the customer saved, per offer (older stored entries have none). */
  discounts?: PlacedDiscount[];
};

export type PlacedDiscount = {
  name: string;
  code: string | null;
  amountP: number;
  freeDelivery: boolean;
};

const KEY = 'bdc_placed';

export function rememberPlaced(o: PlacedOrder) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    // storage blocked: the success page falls back to the tracking prompt
  }
}

/** Only returns the order when it is the one in the URL. */
export function recallPlaced(orderNo: string): PlacedOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PlacedOrder;
    return o.orderNo === orderNo ? o : null;
  } catch {
    return null;
  }
}
