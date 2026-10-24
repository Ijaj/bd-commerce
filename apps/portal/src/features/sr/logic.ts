import { t } from '~/i18n';
import type { LedgerType, SaleStatus, SrLedgerRow, SrProduct } from './api';

export interface DraftLine {
  variantId: string;
  title: string;
  optionsText: string | null;
  listPriceP: number;
  available: number;
  qty: number | null;
  /** Unit price in paisa. */
  unitPriceP: number | null;
}

export interface SaleDraft {
  shopId: string | null;
  lines: DraftLine[];
  paidP: number | null;
  note: string;
}

export const emptyDraft = (): SaleDraft => ({ shopId: null, lines: [], paidP: null, note: '' });

export function lineFromProduct(p: SrProduct): DraftLine {
  return {
    variantId: p.variantId,
    title: p.titleEn,
    optionsText: p.optionsText || null,
    listPriceP: p.priceP,
    available: p.available,
    qty: 1,
    unitPriceP: p.priceP,
  };
}

export const lineTotalP = (l: DraftLine) => (l.qty ?? 0) * (l.unitPriceP ?? 0);

export function saleTotals(d: SaleDraft) {
  const totalP = d.lines.reduce((a, l) => a + lineTotalP(l), 0);
  const listP = d.lines.reduce((a, l) => a + (l.qty ?? 0) * l.listPriceP, 0);
  const paidP = d.paidP ?? 0;
  return { totalP, listP, paidP, dueP: Math.max(0, totalP - paidP) };
}

/** Whole percent the SR price sits below list (negative number), or null at/above list. */
export function belowListPct(l: DraftLine): number | null {
  if (l.unitPriceP === null || l.listPriceP <= 0 || l.unitPriceP >= l.listPriceP) return null;
  return Math.round((l.unitPriceP / l.listPriceP - 1) * 100);
}

export function lineError(l: DraftLine): string | null {
  if (!l.qty || l.qty < 1 || !Number.isInteger(l.qty)) return t('errQtyMin');
  if (l.qty > l.available) return t('errQtyMax', { n: l.available });
  if (l.unitPriceP === null || l.unitPriceP < 0) return t('errPriceMin');
  return null;
}

export interface SaleErrors {
  shop?: string;
  items?: string;
  paid?: string;
  /** Per variantId. */
  lines: Record<string, string>;
}

export function validateSale(d: SaleDraft): SaleErrors {
  const errors: SaleErrors = { lines: {} };
  if (!d.shopId) errors.shop = t('errShopRequired');
  if (d.lines.length === 0) errors.items = t('errItemsRequired');
  for (const l of d.lines) {
    const e = lineError(l);
    if (e) errors.lines[l.variantId] = e;
  }
  const { totalP, paidP } = saleTotals(d);
  if (paidP > totalP) errors.paid = t('errPaidMax');
  return errors;
}

export const hasErrors = (e: SaleErrors) =>
  Boolean(e.shop || e.items || e.paid || Object.keys(e.lines).length);

export const STATUS_COLOR: Record<SaleStatus, string> = {
  submitted: 'yellow',
  approved: 'blue',
  delivered: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

export const statusLabel = (s: SaleStatus) =>
  ({
    submitted: t('statusSubmitted'),
    approved: t('statusApproved'),
    delivered: t('statusDelivered'),
    rejected: t('statusRejected'),
    cancelled: t('statusCancelled'),
  })[s];

export const ledgerLabel = (type: LedgerType) =>
  ({
    sale_due: t('ledgerSale'),
    collection: t('ledgerCollection'),
    adjustment: t('ledgerAdjustment'),
  })[type];

/** Newest entry first. */
export const ledgerNewestFirst = (rows: SrLedgerRow[]) =>
  [...rows].sort((a, b) => b.at.localeCompare(a.at));

/** Shop matches a free-text query on name, owner, area, phone. */
export function shopMatches(
  s: { name: string; ownerName: string | null; area: string | null; phone: string },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${s.name} ${s.ownerName ?? ''} ${s.area ?? ''} ${s.phone}`.toLowerCase().includes(needle);
}

export const BD_PHONE = /^01\d{9}$/;
