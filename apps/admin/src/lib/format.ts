import { formatNumber as fmtNumber, formatPrice as fmtPrice } from '@bdc/i18n';

/** Admin UI is English-only for now: paisa -> "৳1,25,000" / "৳10.50". */
export const formatPrice = (paisa: number) => fmtPrice(paisa, 'en');

/** Lakh-grouped number with English digits. */
export const formatNumber = (value: number, maxDecimals = 2) => fmtNumber(value, 'en', maxDecimals);

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
