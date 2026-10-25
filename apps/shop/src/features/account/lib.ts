import { toEnDigits } from '@bdc/i18n';
import type { Dict } from '~/i18n';

/** Same rule as the API (`normalizePhone`): 01XXXXXXXXX, operator prefix 013-019. Accepts +880 and Bangla digits. */
export function normalizePhone(input: string): string | null {
  let s = toEnDigits(input.trim()).replace(/[\s\-()]/g, '');
  if (s.startsWith('+880')) s = s.slice(4);
  else if (s.startsWith('880')) s = s.slice(3);
  else if (s.startsWith('0')) s = s.slice(1);
  else return null;
  return /^1[3-9]\d{8}$/.test(s) ? `0${s}` : null;
}

/** Keeps only digits (Bangla digits converted), for the OTP field. */
export function cleanCode(input: string): string {
  return toEnDigits(input).replace(/\D/g, '').slice(0, 6);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(input: string): boolean {
  return EMAIL.test(input.trim());
}

/**
 * Post-login redirect target from `?next=`. Same-site absolute paths only: no scheme, no `//host`,
 * no backslashes (some browsers treat `/\host` as protocol-relative). Falls back to `fallback`.
 */
export function safeNext(next: string | string[] | undefined, fallback: string): string {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v?.startsWith('/') || v.startsWith('//') || v.includes('\\')) return fallback;
  for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) < 32) return fallback;
  return v;
}

export type ApiFail = {
  ok: false;
  status: number;
  code: string | null;
  message: string | null;
  /** 429 lockouts: seconds until the next try is allowed. */
  retryAfterSec?: number;
  /** Sub-reason of a code, e.g. GUEST_LIMIT: open_orders | daily_cap. */
  reason?: string;
  /** Raw error body, for codes that carry details (FLASH_LIMIT remaining, COUPON_INVALID couponCode). */
  body?: Record<string, unknown>;
};
export type ApiOk<T> = { ok: true; data: T };
export type ApiResult<T> = ApiOk<T> | ApiFail;

type Fetched<T> = { data?: T; error?: unknown; response: Response };

/** Turns an openapi-fetch promise (or a network failure) into a plain result. */
export async function call<T>(p: Promise<Fetched<T>>): Promise<ApiResult<T>> {
  try {
    const r = await p;
    if (r.response.ok) return { ok: true, data: r.data as T };
    const e = (r.error ?? {}) as {
      code?: unknown;
      message?: unknown;
      retryAfterSec?: unknown;
      reason?: unknown;
    };
    return {
      ok: false,
      status: r.response.status,
      code: typeof e.code === 'string' ? e.code : null,
      message: typeof e.message === 'string' ? e.message : null,
      ...(typeof e.retryAfterSec === 'number' ? { retryAfterSec: e.retryAfterSec } : {}),
      ...(typeof e.reason === 'string' ? { reason: e.reason } : {}),
      ...(r.error && typeof r.error === 'object'
        ? { body: r.error as Record<string, unknown> }
        : {}),
    };
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: null };
  }
}

type Errors = Dict['account']['errors'];

/** Friendly message for a failed call. `overrides` remaps codes for one form (e.g. wrong current password). */
export function errorMessage(
  e: ApiFail,
  errors: Errors,
  overrides: Partial<Record<string, keyof Errors>> = {},
): string {
  if (e.code === 'NETWORK') return errors.network;
  if (e.code && overrides[e.code]) return errors[overrides[e.code] as keyof Errors];
  if (e.code && e.code in errors) return errors[e.code as keyof Errors];
  if (e.status === 429) return errors.TOO_MANY_REQUESTS;
  if (e.status === 400) return errors.validation;
  return errors.generic;
}
