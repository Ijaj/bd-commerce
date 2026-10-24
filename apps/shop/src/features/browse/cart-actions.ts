'use client';
import { refreshCart, setQty } from '~/features/cart/store';

export type CartResult = { ok: true; count: number } | { ok: false; status: number };

/**
 * Add `qty` of a variant to the cart (guest or customer; the API sets the bdc_vid cookie).
 * The API sets absolute quantities (PUT /v1/cart/items/:variantId), so the current quantity is
 * read first and `cap` (stock the product page knows about) bounds the result.
 * The header badge follows the cart store, so nothing else needs announcing.
 */
export async function addToCart(variantId: string, qty: number, cap = 10): Promise<CartResult> {
  const cart = await refreshCart();
  if (!cart) return { ok: false, status: 0 };
  const current = cart.items.find((i) => i.variantId === variantId)?.qty ?? 0;
  const next = await setQty(variantId, Math.min(current + qty, Math.max(cap, current)));
  return next ? { ok: true, count: next.count } : { ok: false, status: 0 };
}
