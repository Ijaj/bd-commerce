'use client';
import { useSyncExternalStore } from 'react';
import { browserApi } from '~/lib/api-browser';
import { call } from './lib';
import { ensureSession } from './session';

/**
 * Wishlist product ids for hearts and the header count. Loaded once per page load, only for a
 * logged-in customer; every heart shares this set. Writes are optimistic and roll back on failure.
 */
let ids: ReadonlySet<string> = new Set();
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: ReadonlySet<string>) {
  ids = next;
  for (const l of listeners) l();
}

/** Fetches the id list once (no-op when logged out). */
export function ensureWishlistIds(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    const me = await ensureSession();
    if (me) {
      const r = await call<{ productIds: string[] }>(browserApi.GET('/v1/customer/wishlist/ids'));
      if (r.ok) set(new Set(r.data.productIds));
    }
    loaded = true;
    inflight = null;
  })();
  return inflight;
}

/** Returns true when the change was saved. Caller must have a logged-in session. */
export async function setWishlisted(productId: string, on: boolean): Promise<boolean> {
  const prev = ids;
  const next = new Set(prev);
  if (on) next.add(productId);
  else next.delete(productId);
  set(next);
  const params = { params: { path: { productId } } };
  const r = await call<unknown>(
    on
      ? browserApi.PUT('/v1/customer/wishlist/{productId}', params)
      : browserApi.DELETE('/v1/customer/wishlist/{productId}', params),
  );
  if (!r.ok) {
    // Roll back only this id; other hearts may have changed meanwhile.
    const back = new Set(ids);
    if (on) back.delete(productId);
    else back.add(productId);
    set(back);
  }
  return r.ok;
}

export function isWishlisted(productId: string): boolean {
  return ids.has(productId);
}

/** Forget everything (logout). */
export function clearWishlist() {
  loaded = true;
  set(new Set());
}

/** Seed from a server-rendered list (wishlist page) so hearts/count agree without a request. */
export function seedWishlist(productIds: string[]) {
  loaded = true;
  set(new Set(productIds));
}

const EMPTY: ReadonlySet<string> = new Set();

export function useWishlistIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ids,
    () => EMPTY,
  );
}

/** Test helper. */
export function resetWishlist() {
  ids = new Set();
  loaded = false;
  inflight = null;
  for (const l of listeners) l();
}
