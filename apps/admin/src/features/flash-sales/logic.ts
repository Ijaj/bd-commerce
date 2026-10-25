import { errorCode } from '~/features/b2b/errors';
import { HttpError } from '~/features/categories/http';
import type { ItemBody } from './api';
import type { FlashItem, FlashPhase } from './queries';

export const PHASE_LABEL: Record<FlashPhase, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  inactive: 'Inactive',
};

export const PHASE_COLOR: Record<FlashPhase, string> = {
  scheduled: 'blue',
  live: 'green',
  ended: 'gray',
  inactive: 'orange',
};

/** One editable row of the items table. Numbers are kept as paisa / units, null while the field is empty. */
export interface ItemDraft {
  variantId: string;
  productTitleEn: string;
  sku: string;
  /** Regular price, for the "must be lower" check and the discount hint. */
  priceP: number;
  currentSalePriceP: number | null;
  qtySold: number;
  flashPriceP: number | null;
  qtyLimit: number | null;
  perCustomerLimit: number | null;
  sort: number;
}

export const draftFromItem = (i: FlashItem): ItemDraft => ({
  variantId: i.variantId,
  productTitleEn: i.productTitleEn,
  sku: i.sku,
  priceP: i.priceP,
  currentSalePriceP: i.currentSalePriceP,
  qtySold: i.qtySold,
  flashPriceP: i.flashPriceP,
  qtyLimit: i.qtyLimit,
  perCustomerLimit: i.perCustomerLimit,
  sort: i.sort,
});

/** Percent off the regular price, whole number; null when it cannot be computed. */
export function discountPercent(priceP: number, flashPriceP: number | null): number | null {
  if (flashPriceP === null || priceP <= 0) return null;
  return Math.round(((priceP - flashPriceP) / priceP) * 100);
}

/** Per-row problem text, or null when the row can be saved. Mirrors the API's FLASH_INVALID checks. */
export function itemProblem(d: ItemDraft): string | null {
  if (d.flashPriceP === null || d.flashPriceP < 1) return 'Enter a flash price';
  if (d.flashPriceP >= d.priceP) return 'Flash price must be below the regular price';
  if (d.qtyLimit === null || d.qtyLimit < 1) return 'Enter how many units to offer';
  if (d.qtyLimit < d.qtySold) return `At least ${d.qtySold} (already sold)`;
  if (d.perCustomerLimit !== null && d.perCustomerLimit < 1)
    return 'Per-customer limit must be 1 or more';
  return null;
}

export function toItemBodies(drafts: ItemDraft[]): ItemBody[] {
  return drafts.map((d, i) => ({
    variantId: d.variantId,
    flashPriceP: d.flashPriceP as number,
    qtyLimit: d.qtyLimit as number,
    perCustomerLimit: d.perCustomerLimit,
    sort: Number.isFinite(d.sort) ? d.sort : i,
  }));
}

const MESSAGES: Record<string, string> = {
  FLASH_HAS_SALES:
    'This flash sale already has sales, so those items or the sale itself cannot be removed. Deactivate the sale instead.',
};

/** Friendly text for FLASH_* codes. FLASH_OVERLAP names the clashing sale. */
export function flashErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const code = errorCode(e);
  const body = e instanceof HttpError ? (e.body as { saleName?: string } | null) : null;
  if (code === 'FLASH_OVERLAP') {
    return `${e instanceof Error ? e.message : 'A variant is already in another flash sale'}. A variant can only be in one active flash sale at a time. Change the dates or remove it from "${body?.saleName ?? 'the other sale'}".`;
  }
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}
