'use client';

export type CartResult = { ok: true; count: number } | { ok: false; status: number };

type CartBody = { count?: number; items?: { variantId: string; qty: number }[] };

/**
 * Add `qty` of a variant to the cart (guest or customer; the API sets the bdc_vid cookie).
 * Contract (agent A, step 4): GET /v1/cart, PUT /v1/cart/items/:variantId {qty} (qty is absolute),
 * both return the Cart. We read the current quantity first so "add" really adds.
 * TODO(lead): if the API gains an incremental add endpoint, drop the extra GET.
 */
export async function addToCart(variantId: string, qty: number, cap = 10): Promise<CartResult> {
  try {
    let current = 0;
    const cart = await fetch('/v1/cart', {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (cart.ok) {
      const body = (await cart.json()) as CartBody;
      current = body.items?.find((i) => i.variantId === variantId)?.qty ?? 0;
    }
    const res = await fetch(`/v1/cart/items/${encodeURIComponent(variantId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ qty: Math.min(current + qty, Math.max(cap, current)) }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body = (await res.json()) as CartBody;
    const count = body.count ?? current + qty;
    announceCart(count);
    return { ok: true, count };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Header badge (`#cart-count`) + a `bdc:cart` event for anything else that shows the count. */
function announceCart(count: number) {
  const el = document.getElementById('cart-count');
  if (el) {
    el.textContent = String(count);
    el.hidden = count <= 0;
  }
  window.dispatchEvent(new CustomEvent('bdc:cart', { detail: { count } }));
}
