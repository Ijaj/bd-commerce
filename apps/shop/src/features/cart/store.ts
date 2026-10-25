'use client';
import { useSyncExternalStore } from 'react';
import { type ApiResult, call } from '~/features/account/lib';
import { browserApi } from '~/lib/api-browser';
import { type Cart, EMPTY_CART } from './types';

/**
 * Client copy of the cart: the cart page, checkout summary and the header badge share it.
 * The server stays the truth; every mutation replaces the copy with the Cart the API returns.
 *
 * `bdc_ch` is a readable hint cookie ("this browser has had a cart") so first-time visitors
 * never trigger a /v1/cart call just to render the header badge.
 */
type State = { cart: Cart | null };

const HINT = 'bdc_ch';
let state: State = { cart: null };
const listeners = new Set<() => void>();
const EMPTY: State = { cart: null };

function set(cart: Cart | null) {
  state = { cart };
  for (const l of listeners) l();
}

function readCookie(name: string): boolean {
  try {
    return document.cookie.split('; ').some((c) => c.startsWith(`${name}=`));
  } catch {
    return false;
  }
}

/** True when a cart may exist for this browser (guest hint or logged-in hint). */
export function mayHaveCart(): boolean {
  return readCookie(HINT) || readCookie('bdc_in');
}

function writeHint(on: boolean) {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available on older Android WebViews
    document.cookie = on
      ? `${HINT}=1; path=/; max-age=${365 * 86400}; samesite=lax`
      : `${HINT}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // cookies blocked: only the optimisation is lost
  }
}

/** Replace the local copy (server-rendered cart, or a response from the cart API). */
export function setCart(cart: Cart | null) {
  if (cart) writeHint(cart.count > 0);
  set(cart);
}

/** Fetch the cart; resolves null (and keeps the old copy) on failure. */
export async function refreshCart(): Promise<Cart | null> {
  const r = await call<Cart>(browserApi.GET('/v1/cart'));
  if (!r.ok) return null;
  setCart(r.data);
  return r.data;
}

/** Absolute quantity (0 removes the line). Keeps the API error so callers can show FLASH_LIMIT details. */
export async function setQtyResult(variantId: string, qty: number): Promise<ApiResult<Cart>> {
  const r = await call<Cart>(
    browserApi.PUT('/v1/cart/items/{variantId}', {
      params: { path: { variantId } },
      body: { qty },
    }),
  );
  if (r.ok) setCart(r.data);
  return r;
}

/** Same, but resolves null when the call failed. */
export async function setQty(variantId: string, qty: number): Promise<Cart | null> {
  const r = await setQtyResult(variantId, qty);
  return r.ok ? r.data : null;
}

/** Add a typed coupon code to the cart. */
export async function applyCoupon(code: string): Promise<ApiResult<Cart>> {
  const r = await call<Cart>(browserApi.POST('/v1/cart/coupon', { body: { code } }));
  if (r.ok) setCart(r.data);
  return r;
}

export async function removeCoupon(code: string): Promise<Cart | null> {
  const r = await call<Cart>(
    browserApi.DELETE('/v1/cart/coupon/{code}', { params: { path: { code } } }),
  );
  if (!r.ok) return null;
  setCart(r.data);
  return r.data;
}

export async function removeLine(variantId: string): Promise<Cart | null> {
  const r = await call<Cart>(
    browserApi.DELETE('/v1/cart/items/{variantId}', { params: { path: { variantId } } }),
  );
  if (!r.ok) return null;
  setCart(r.data);
  return r.data;
}

/** After an order is placed the server cart is empty; mirror that without another request. */
export function clearLocalCart() {
  setCart(EMPTY_CART);
}

export function useCart(): Cart | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state.cart,
    () => EMPTY.cart,
  );
}

/** Test helper. */
export function resetCart() {
  state = { cart: null };
  for (const l of listeners) l();
}
