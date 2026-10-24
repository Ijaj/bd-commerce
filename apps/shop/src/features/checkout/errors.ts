import type { ApiFail } from '~/features/account/lib';
import type { CheckoutDict } from './strings.en';

/** Friendly text for a failed checkout call: stable API `code` first, then the HTTP status. */
export function checkoutError(e: ApiFail, errors: CheckoutDict['errors']): string {
  if (e.code === 'NETWORK') return errors.network;
  if (e.code && e.code in errors) return errors[e.code as keyof CheckoutDict['errors']];
  if (e.status === 429) return errors.TOO_MANY_REQUESTS;
  if (e.status === 400) return errors.validation;
  return errors.generic;
}

/** Codes that mean "the cart is not what the customer saw": send them back to the cart. */
export function cartNoticeFor(code: string | null): 'changed' | 'stock' | 'empty' | null {
  if (code === 'CART_CHANGED') return 'changed';
  if (code === 'OUT_OF_STOCK') return 'stock';
  if (code === 'CART_EMPTY') return 'empty';
  return null;
}

/** What the success page shows right after placing (guests cannot load the order from the API). */
export type PlacedOrder = {
  orderNo: string;
  grandTotalP: number;
  codDueP: number;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  zoneName: string | null;
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
