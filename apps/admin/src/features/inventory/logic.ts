export type StockReason =
  | 'po_receive'
  | 'order_reserve'
  | 'order_release'
  | 'ship'
  | 'return_restock'
  | 'adjust'
  | 'import'
  | 'sr_reserve'
  | 'sr_release'
  | 'sr_ship';

const REASON_LABELS: Record<StockReason, string> = {
  po_receive: 'Purchase received',
  order_reserve: 'Order reserved',
  order_release: 'Order released',
  ship: 'Shipped',
  return_restock: 'Return restocked',
  adjust: 'Manual adjustment',
  import: 'Import',
  sr_reserve: 'Showroom reserved',
  sr_release: 'Showroom released',
  sr_ship: 'Showroom sale',
};

/** Human label for a ledger reason; unknown codes are title-cased so new reasons still read OK. */
export function reasonLabel(reason: string): string {
  const known = REASON_LABELS[reason as StockReason];
  if (known) return known;
  const text = reason.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

export type AdjustMode = 'delta' | 'set';

/** On-hand after an adjustment, or null when the quantity is not a whole number yet. */
export function adjustResult(mode: AdjustMode, onHand: number, qty: number | null): number | null {
  if (qty === null || !Number.isInteger(qty)) return null;
  return mode === 'delta' ? onHand + qty : qty;
}

export type AdjustCheck = { ok: true } | { ok: false; reason: string };

/** Client-side guard before saving; the API still has the last word. */
export function checkAdjust(mode: AdjustMode, onHand: number, qty: number | null): AdjustCheck {
  const result = adjustResult(mode, onHand, qty);
  if (result === null) return { ok: false, reason: 'Enter a whole number' };
  if (mode === 'delta' && qty === 0) return { ok: false, reason: 'Change must not be zero' };
  if (result < 0) return { ok: false, reason: 'On hand cannot go below zero' };
  return { ok: true };
}

/** "Red / XL" style label for a variant, empty for simple products. */
export function optionText(labels: { en: string }[]): string {
  return labels.map((l) => l.en).join(' / ');
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
