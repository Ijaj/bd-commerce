import type { LedgerRow } from './queries';

export const LEDGER_TYPE_LABEL: Record<string, string> = {
  sale_due: 'Sale due',
  collection: 'Collection',
  adjustment: 'Adjustment',
  reversal: 'Reversal',
};

export type LedgerState = 'confirmed' | 'pending' | 'rejected' | 'posted';

/** Rejected state comes from fields the generated types do not have yet (TODO(lead) after J). */
export function ledgerState(row: LedgerRow): LedgerState {
  if ((row as { rejected?: boolean }).rejected) return 'rejected';
  if (row.type !== 'collection') return 'posted';
  return row.confirmed ? 'confirmed' : 'pending';
}

export const STATE_COLOR: Record<LedgerState, string> = {
  confirmed: 'teal',
  pending: 'yellow',
  rejected: 'red',
  posted: 'gray',
};

export type AdjustDirection = 'increase' | 'reduce';

/** Form amount (paisa, positive) + direction -> signed paisa, or an error message. */
export function signedAdjustment(
  direction: AdjustDirection,
  amountP: number | null,
  note: string,
): { amountP: number; note: string } | { error: string } {
  if (!amountP || amountP <= 0) return { error: 'Enter an amount above zero' };
  if (!note.trim()) return { error: 'A note is required' };
  return { amountP: direction === 'reduce' ? -amountP : amountP, note: note.trim() };
}

export function rejectReason(row: LedgerRow): string | null {
  return (row as { rejectReason?: string | null }).rejectReason ?? null;
}
