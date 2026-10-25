import { errorCode } from '~/features/b2b/errors';
import { localToIso } from '~/features/carousel/logic';
import { HttpError } from '~/features/categories/http';
import type { BulkBody } from './queries';

export type Mode = 'percent' | 'fixed';

/** Form state. `percent` is a plain number of percent (12.5); `valueP` is paisa off for the fixed mode. */
export interface BulkForm {
  name: string;
  mode: Mode;
  percent: number | null;
  valueP: number | null;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  skipExistingSales: boolean;
}

export const emptyForm = (): BulkForm => ({
  name: '',
  mode: 'percent',
  percent: null,
  valueP: null,
  productIds: [],
  categoryIds: [],
  brandIds: [],
  startsAt: null,
  endsAt: null,
  skipExistingSales: true,
});

/** 12.5% -> 1250 basis points; floats are rounded after toPrecision to drop binary noise. */
export const percentToBp = (pct: number) => Math.round(Number((pct * 100).toPrecision(12)));

export function ruleValue(f: BulkForm): number | null {
  if (f.mode === 'percent') return f.percent === null ? null : percentToBp(f.percent);
  return f.valueP;
}

/** Problems that block the preview; null when the rule can be sent to the API. */
export function formProblem(f: BulkForm): string | null {
  const v = ruleValue(f);
  if (!f.productIds.length && !f.categoryIds.length && !f.brandIds.length) {
    return 'Pick at least one product, category or brand';
  }
  if (v === null || v < 1) return f.mode === 'percent' ? 'Enter a percentage' : 'Enter an amount';
  if (f.mode === 'percent' && v >= 10_000) return 'Percent must be below 100';
  const s = localToIso(f.startsAt);
  const e = localToIso(f.endsAt);
  if (s && e && Date.parse(e) <= Date.parse(s)) return 'The end must be after the start';
  return null;
}

export function toRule(f: BulkForm): BulkBody {
  const ids = (a: string[]) => (a.length ? a : undefined);
  return {
    mode: f.mode,
    value: ruleValue(f) as number,
    scope: {
      productIds: ids(f.productIds),
      categoryIds: ids(f.categoryIds),
      brandIds: ids(f.brandIds),
    },
    startsAt: localToIso(f.startsAt),
    endsAt: localToIso(f.endsAt),
    skipExistingSales: f.skipExistingSales,
  };
}

/** Text for a rule: "12.5% off" or "৳50 off" (formatPrice injected to keep this file pure). */
export function describeRule(
  mode: Mode,
  value: number,
  formatPrice: (paisa: number) => string,
): string {
  return mode === 'percent' ? `${value / 100}% off` : `${formatPrice(value)} off`;
}

export function bulkErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const code = errorCode(e);
  if (code === 'BULK_SALE_UNDONE') return 'This bulk sale was already undone.';
  if (e instanceof HttpError && e.status === 404) return 'This bulk sale no longer exists.';
  return e instanceof Error ? e.message : fallback;
}
