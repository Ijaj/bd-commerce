import { cookies } from 'next/headers';
import { serverApi } from '~/lib/api';
import { type Cart, EMPTY_CART } from './types';

/** Cookie header with the customer session and the visitor id: together they identify the cart. */
export async function cartCookie(): Promise<string | undefined> {
  const jar = await cookies();
  const parts = ['bdc_cs', 'bdc_vid'].flatMap((n) => {
    const c = jar.get(n);
    return c ? [`${n}=${c.value}`] : [];
  });
  return parts.length ? parts.join('; ') : undefined;
}

/** Current cart for server components; null when the API fails (the client then retries). */
export async function getCart(cookie: string | undefined): Promise<Cart | null> {
  // No cookie = nobody has a cart yet. Skipping the call also keeps this page's fetch out of the data cache.
  if (!cookie) return EMPTY_CART;
  try {
    const r = await serverApi({ cookie }).GET('/v1/cart');
    return r.response.ok && r.data ? r.data : null;
  } catch {
    return null;
  }
}
