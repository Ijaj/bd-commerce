import type { Tone } from '@bdc/ui';
import type { LedgerEntry, SupplierLink } from './queries';

export const SHIP_MODE_LABEL = {
  direct_to_customer: 'Ship direct to customer',
  via_warehouse: 'Via our warehouse first',
} as const;
export type ShipMode = keyof typeof SHIP_MODE_LABEL;

export const SHIP_MODE_HELP: Record<ShipMode, string> = {
  direct_to_customer:
    "Courier collects from the supplier's pickup address and delivers to the customer. Faster; we do not see the item.",
  via_warehouse:
    'Supplier delivers to us, we inspect and ship. Slower but safer for fragile or high-value items.',
};

export const LEDGER_TYPE: Record<LedgerEntry['type'], { label: string; tone: Tone }> = {
  receipt: { label: 'Goods received', tone: 'info' },
  payment: { label: 'Payment', tone: 'ok' },
  adjustment: { label: 'Adjustment', tone: 'warn' },
  reversal: { label: 'Reversal', tone: 'muted' },
  dropship: { label: 'Dropship', tone: 'muted' },
};

export const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank transfer' },
] as const;
export type PayMethod = (typeof PAY_METHODS)[number]['value'];

/** Only payments and adjustments can be reversed, and only once. */
export function canReverse(e: Pick<LedgerEntry, 'type' | 'reversedById'>): boolean {
  return (e.type === 'payment' || e.type === 'adjustment') && !e.reversedById;
}

export function paymentBody(input: {
  amountP: number | null;
  method: PayMethod;
  reference: string;
  note: string;
}): { amountP: number; method: PayMethod; reference?: string; note?: string } | { error: string } {
  if (!input.amountP || input.amountP <= 0) return { error: 'Enter an amount above zero' };
  const reference = input.reference.trim();
  if (input.method !== 'cash' && !reference) {
    return { error: 'A reference is required for bKash, Nagad and bank payments' };
  }
  const note = input.note.trim();
  return {
    amountP: input.amountP,
    method: input.method,
    ...(reference ? { reference } : {}),
    ...(note ? { note } : {}),
  };
}

export type AdjustDirection = 'owe_more' | 'owe_less';

export function adjustmentBody(
  direction: AdjustDirection,
  amountP: number | null,
  note: string,
): { amountP: number; note: string } | { error: string } {
  if (!amountP || amountP <= 0) return { error: 'Enter an amount above zero' };
  if (note.trim().length < 3) return { error: 'A reason of at least 3 characters is required' };
  return { amountP: direction === 'owe_less' ? -amountP : amountP, note: note.trim() };
}

/** Warn (do not block) when a payment is bigger than what is owed. */
export function overpays(amountP: number | null, balanceP: number): boolean {
  return !!amountP && amountP > Math.max(balanceP, 0);
}

export function optionsText(options: SupplierLink['options']): string {
  return options.map((o) => o.en).join(' / ');
}
