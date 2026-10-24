import type { LedgerRow } from './queries';

export const LEDGER_TYPE_LABEL: Record<string, string> = {
  sale_due: 'Sale due',
  collection: 'Collection',
  adjustment: 'Adjustment',
  reversal: 'Reversal',
};

export type LedgerState = 'confirmed' | 'pending' | 'rejected' | 'posted';

export function ledgerState(row: LedgerRow): LedgerState {
  if (row.rejected) return 'rejected';
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
  return row.rejectReason ?? null;
}

export interface DueRow {
  dueP: number;
  shop: { name: string };
}

/** Largest due first by default; ties by shop name. */
export function sortByDue<T extends DueRow>(rows: readonly T[], dir: 'desc' | 'asc' = 'desc'): T[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort(
    (a, b) => sign * (a.dueP - b.dueP) || a.shop.name.localeCompare(b.shop.name),
  );
}

/** Local calendar date as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
