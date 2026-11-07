import type { Tone } from '@bdc/ui';
import type { PayoutBody } from './api';
import type { AffiliateDetail, DueRow } from './queries';

/** Basis points -> "7.5%" (one decimal at most, no trailing ".0"). */
export function formatBp(bp: number): string {
  return `${Number((bp / 100).toFixed(1))}%`;
}

/** Percent text from the edit form -> basis points; null for empty (= use the default). */
export function percentToBp(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return 'invalid';
  const bp = Math.round(Number(t) * 100);
  return bp > 10000 ? 'invalid' : bp;
}

export const COMMISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warn' },
  approved: { label: 'Approved', tone: 'info' },
  paid: { label: 'Paid', tone: 'ok' },
  reversed: { label: 'Reversed', tone: 'muted' },
};

export const PAYOUT_METHODS = [
  { value: 'bkash', label: 'bKash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number]['value'];

export const methodLabel = (m: string | null) =>
  PAYOUT_METHODS.find((x) => x.value === m)?.label ?? (m ? m : 'Not set');

type Details = AffiliateDetail['payoutDetails'] | DueRow['payoutDetails'];

/** Full details as short lines (staff with payout permission) or the masked string. */
export function detailLines(d: Details): string[] {
  if (!d) return [];
  if (typeof d === 'string') return [d];
  if (d.method === 'bkash') return [d.bkashNumber, d.holderName];
  return [`${d.bankName}, ${d.branch}`, `A/C ${d.accountNo}`, d.accountName];
}

/** Payout form body, or the error text. Method defaults to the affiliate's own. */
export function payoutBody(f: {
  method: PayoutMethod;
  reference: string;
  note: string;
  expectedAmountP: number;
}): PayoutBody | { error: string } {
  const reference = f.reference.trim();
  if (reference.length < 2)
    return { error: 'Enter the transaction reference (at least 2 characters).' };
  const note = f.note.trim();
  return {
    method: f.method,
    reference,
    expectedAmountP: f.expectedAmountP,
    ...(note ? { note } : {}),
  };
}
