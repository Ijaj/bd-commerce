import type { Tone } from '@bdc/ui';
import type { PoDetail, PoStatus } from './queries';

export const PO_STATUS: Record<PoStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'muted' },
  sent: { label: 'Sent', tone: 'info' },
  partially_received: { label: 'Partially received', tone: 'warn' },
  received: { label: 'Received', tone: 'ok' },
  closed: { label: 'Closed short', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const STATUS_TABS: Array<'all' | PoStatus> = [
  'all',
  'draft',
  'sent',
  'partially_received',
  'received',
  'closed',
  'cancelled',
];

export const optionText = (options: Array<{ en: string }>) =>
  options.length ? ` (${options.map((o) => o.en).join(' / ')})` : '';

/** Weighted-average cost after receiving `good` at `unitP` (C64), same rule as the API. */
export function costAfterP(
  oldCostP: number | null,
  onHand: number,
  good: number,
  unitP: number,
): number | null {
  if (good <= 0) return oldCostP;
  if (oldCostP === null || onHand <= 0) return unitP;
  return Math.round((onHand * oldCostP + good * unitP) / (onHand + good));
}

/** Good + rejected may not exceed what is still outstanding. Editing one field squeezes the other. */
export function clampReceive(
  remaining: number,
  edit: 'good' | 'rejected',
  value: number,
  other: number,
): { good: number; rejected: number } {
  const v = Math.max(0, Math.min(remaining, Math.floor(Number.isFinite(value) ? value : 0)));
  if (edit === 'good') return { good: v, rejected: Math.min(other, remaining - v) };
  return { good: Math.min(other, remaining - v), rejected: v };
}

export interface LineDraft {
  /** Stable React key. */
  key: string;
  variantId: string;
  title: string;
  sku: string;
  options: Array<{ en: string }>;
  qty: number | null;
  unitCostP: number | null;
  hint: string | null;
}

export const lineTotalP = (l: Pick<LineDraft, 'qty' | 'unitCostP'>) =>
  (l.qty ?? 0) * (l.unitCostP ?? 0);

export const totalP = (lines: LineDraft[]) => lines.reduce((a, l) => a + lineTotalP(l), 0);

/** First problem with the lines, or null. */
export function lineError(lines: LineDraft[]): string | null {
  if (lines.length === 0) return 'Add at least one line.';
  for (const l of lines) {
    if (!l.qty || l.qty < 1 || !Number.isInteger(l.qty))
      return `${l.sku}: quantity must be a whole number, at least 1.`;
    if (l.unitCostP === null || l.unitCostP < 0) return `${l.sku}: enter a unit cost.`;
  }
  return null;
}

export type EditMode = 'full' | 'meta' | 'none';

/** What can still change: everything on a draft, date and notes once sent, nothing after. */
export function editMode(status: PoStatus | null, canManage: boolean): EditMode {
  if (!canManage) return 'none';
  if (status === null || status === 'draft') return 'full';
  if (status === 'sent' || status === 'partially_received') return 'meta';
  return 'none';
}

export const canReceive = (status: PoStatus) =>
  status === 'sent' || status === 'partially_received';

/** A sent PO can be cancelled only while nothing was received. */
export const canCancel = (po: Pick<PoDetail, 'status' | 'receipts'>) =>
  po.status === 'draft' || (po.status === 'sent' && po.receipts.length === 0);

export function dateLabel(d: string | null | undefined): string {
  if (!d) return '-';
  const x = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
