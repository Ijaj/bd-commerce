import { formatPrice as fmtPrice } from '@bdc/i18n';
import { getLang } from '~/i18n';

/** Paisa -> "৳1,25,000". Follows the portal language (BN digits when bn). */
export const formatPrice = (paisa: number) => fmtPrice(paisa, getLang());

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMonth(date = new Date()): string {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Days left in the month including today. */
export function daysLeftInMonth(date = new Date()): number {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return last - date.getDate() + 1;
}
