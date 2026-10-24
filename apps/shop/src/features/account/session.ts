'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { browserApi } from '~/lib/api-browser';
import type { Me } from '~/lib/types';
import { call } from './lib';

/**
 * Customer session for client components (header, hearts). In-memory per page load, fetched lazily,
 * so catalog pages stay static: nothing about the visitor is rendered on the server.
 *
 * The bdc_cs cookie is httpOnly, so a readable hint cookie (bdc_in) says "worth asking the API".
 * Anonymous visitors (most traffic) then never hit /v1/customer/me at all.
 */
type State = { status: 'idle' | 'loading' | 'ready'; me: Me | null };

const HINT = 'bdc_in';
let state: State = { status: 'idle', me: null };
let inflight: Promise<Me | null> | null = null;
const listeners = new Set<() => void>();
const IDLE: State = { status: 'idle', me: null };

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

function hasHint(): boolean {
  try {
    return document.cookie.split('; ').some((c) => c.startsWith(`${HINT}=`));
  } catch {
    return false;
  }
}

function setHint(on: boolean) {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available on older Android WebViews
    document.cookie = on
      ? `${HINT}=1; path=/; max-age=${60 * 86400}; samesite=lax`
      : `${HINT}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // cookies blocked: the session still works, only the optimisation is lost
  }
}

/** Resolves the current customer (null = logged out). Concurrent callers share one request. */
export function ensureSession(): Promise<Me | null> {
  if (state.status === 'ready') return Promise.resolve(state.me);
  if (inflight) return inflight;
  if (!hasHint()) {
    set({ status: 'ready', me: null });
    return Promise.resolve(null);
  }
  set({ status: 'loading', me: null });
  inflight = call<Me>(browserApi.GET('/v1/customer/me')).then((r) => {
    inflight = null;
    const me = r.ok ? r.data : null;
    // Only a definite 401 clears the hint; a network blip must not log the UI out for good.
    if (!r.ok && r.status === 401) setHint(false);
    set({ status: 'ready', me });
    return me;
  });
  return inflight;
}

/** Call after login/signup/profile edits with the fresh customer. */
export function setSessionMe(me: Me | null) {
  setHint(me !== null);
  set({ status: 'ready', me });
}

export function useSession(): { ready: boolean; me: Me | null } {
  useEffect(() => {
    void ensureSession();
  }, []);
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => IDLE,
  );
  return { ready: snap.status === 'ready', me: snap.me };
}

/** Test helper. */
export function resetSession() {
  inflight = null;
  state = { status: 'idle', me: null };
  for (const l of listeners) l();
}
