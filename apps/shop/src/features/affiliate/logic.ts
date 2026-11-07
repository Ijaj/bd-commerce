import { toEnDigits } from '@bdc/i18n';
import { normalizePhone } from '~/features/account/lib';
import type { AffiliatePayoutDetails } from './types';

/** Basis points as a percent with at most one decimal: 500 -> "5", 725 -> "7.2". */
export function bpToPercent(bp: number): string {
  const v = Math.round(bp / 10) / 10;
  return String(v);
}

/** Conversion rate (orders per click) in basis points, shown as "3.4". */
export const conversionText = bpToPercent;

/**
 * Tracked link for a shop page. Accepts a path ("/p/x"), or a full URL of THIS shop (same origin).
 * Returns null for anything else (other sites, junk) so a code is never attached to a foreign page.
 */
export function buildLink(input: string, origin: string, code: string): string | null {
  const raw = input.trim();
  let path: string;
  let search = '';
  let hash = '';
  if (raw === '') {
    path = '/';
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
    let u: URL;
    try {
      u = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    } catch {
      return null;
    }
    if (raw.startsWith('//') || u.origin !== origin) return null;
    path = u.pathname;
    search = u.search;
    hash = u.hash;
  } else {
    if (raw.includes('\\')) return null;
    let u: URL;
    try {
      u = new URL(raw.startsWith('/') ? raw : `/${raw}`, origin);
    } catch {
      return null;
    }
    if (u.origin !== origin) return null;
    path = u.pathname;
    search = u.search;
    hash = u.hash;
  }
  const params = new URLSearchParams(search);
  params.set('ref', code);
  return `${origin}${path}?${params.toString()}${hash}`;
}

/** Landing path + search for the click call, without `ref`. */
export function landingFrom(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('ref');
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function utmFrom(search: string): { source?: string; medium?: string; campaign?: string } {
  const p = new URLSearchParams(search);
  const out: { source?: string; medium?: string; campaign?: string } = {};
  for (const k of ['source', 'medium', 'campaign'] as const) {
    const v = p.get(`utm_${k}`);
    if (v) out[k] = v.slice(0, 100);
  }
  return out;
}

export type PayoutFormValues = {
  method: 'bkash' | 'bank';
  bkashNumber: string;
  holderName: string;
  bankName: string;
  branch: string;
  accountNo: string;
  accountName: string;
};

export type PayoutErrors = Partial<Record<keyof PayoutFormValues, true>>;

/** Client-side check mirroring the API; returns the body to send, or the invalid fields. */
export function payoutBody(
  v: PayoutFormValues,
): { ok: true; body: AffiliatePayoutDetails } | { ok: false; errors: PayoutErrors } {
  const errors: PayoutErrors = {};
  if (v.method === 'bkash') {
    const n = normalizePhone(v.bkashNumber);
    if (!n) errors.bkashNumber = true;
    if (!v.holderName.trim()) errors.holderName = true;
    if (Object.keys(errors).length) return { ok: false, errors };
    return {
      ok: true,
      body: { method: 'bkash', bkashNumber: n as string, holderName: v.holderName.trim() },
    };
  }
  const acc = toEnDigits(v.accountNo).replace(/[\s-]/g, '');
  if (!v.bankName.trim()) errors.bankName = true;
  if (!v.branch.trim()) errors.branch = true;
  if (!v.accountName.trim()) errors.accountName = true;
  if (!/^\d{6,20}$/.test(acc)) errors.accountNo = true;
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    body: {
      method: 'bank',
      bankName: v.bankName.trim(),
      branch: v.branch.trim(),
      accountNo: acc,
      accountName: v.accountName.trim(),
    },
  };
}

/** Chart scale: at least 1 so an all-zero month still draws a flat baseline. */
export function maxOf(values: number[]): number {
  return Math.max(1, ...values);
}
