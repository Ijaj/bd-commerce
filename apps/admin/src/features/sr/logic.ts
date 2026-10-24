import type { Sale } from './queries';

// TODO(lead): generated types after J (status 'reversed', deliveryBy, reversed* fields).
export type SaleStatusX = Sale['status'] | 'reversed';

export interface SaleExtras {
  deliveryBy?: 'sr' | 'staff';
  reversedAt?: string | null;
  reversedBy?: { id: string; name: string } | null;
  reverseReason?: string | null;
}
export const extrasOf = (s: object) => s as SaleExtras;

export const STATUS_LABEL: Record<SaleStatusX, string> = {
  submitted: 'Pending approval',
  approved: 'Approved',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  reversed: 'Reversed',
};

export const STATUS_COLOR: Record<SaleStatusX, string> = {
  submitted: 'yellow',
  approved: 'blue',
  delivered: 'teal',
  rejected: 'red',
  cancelled: 'gray',
  reversed: 'orange',
};

export type SaleAction = 'approve' | 'reject' | 'deliver' | 'reverse';

/** Which staff actions the status allows (permission is checked separately). */
export function allowedActions(status: SaleStatusX): SaleAction[] {
  switch (status) {
    case 'submitted':
      return ['approve', 'reject'];
    case 'approved':
      return ['deliver', 'reverse'];
    case 'delivered':
      return ['reverse'];
    default:
      return [];
  }
}

/** Memo exists once a sale is approved. */
export const hasMemo = (status: SaleStatusX) =>
  status === 'approved' || status === 'delivered' || status === 'reversed';

/** Current month as YYYY-MM (local time). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** MonthPickerInput works with YYYY-MM-DD strings. */
export const monthToDate = (m: string) => `${m}-01`;
export const dateToMonth = (d: string | null): string | null => (d ? d.slice(0, 7) : null);

export const bpToPercent = (bp: number | null) => (bp === null ? '' : bp / 100);
export const percentToBp = (pct: number | string): number | null =>
  pct === '' ? null : Math.round(Number(pct) * 100);

export function formatPercent(bp: number): string {
  return `${(bp / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

/** Sold vs target as a whole percent; null when no target is set. */
export function achievedPercent(soldP: number, targetP: number | null): number | null {
  return targetP ? Math.round((soldP / targetP) * 100) : null;
}

/** Only rows whose target changed; a cleared field saves as 0 (the API cannot unset). */
export function changedTargets(
  rows: { srStaffId: string; targetP: number | null }[],
  edits: Record<string, number | null>,
): { srStaffId: string; targetP: number }[] {
  const out: { srStaffId: string; targetP: number }[] = [];
  for (const r of rows) {
    if (!(r.srStaffId in edits)) continue;
    const next = edits[r.srStaffId] ?? 0;
    if (next !== (r.targetP ?? 0)) out.push({ srStaffId: r.srStaffId, targetP: next });
  }
  return out;
}
