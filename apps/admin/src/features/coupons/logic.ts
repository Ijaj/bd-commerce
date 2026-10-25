import type { components } from '@bdc/api-client';
import { formatPrice } from '~/lib/format';

type S = components['schemas'];
export type CouponRow = S['CouponListDto']['items'][number];
export type CouponDetail = S['CouponDetailDto'];
export type CouponType = CouponRow['type'];
export type CouponKind = CouponRow['kind'];
export type CouponPhase = CouponRow['phase'];
export type CouponStatus = CouponRow['status'];

export const TYPE_LABEL: Record<CouponType, string> = {
  percent: 'Percent off',
  fixed: 'Fixed amount off',
  free_delivery: 'Free delivery',
  bxgy: 'Buy X get Y',
  tiered: 'Tiered by spend',
  bundle: 'Bundle price',
};

export const TYPE_HELP: Record<CouponType, string> = {
  percent: 'A percentage off the eligible items, optionally capped.',
  fixed: 'A fixed amount off the eligible items.',
  free_delivery: 'Removes the delivery charge, in all zones or only the chosen ones.',
  bxgy: 'Buy some units, get others at a discount (or free).',
  tiered: 'The more the customer spends, the bigger the fixed discount.',
  bundle: 'A set of products sold together for one price.',
};

export const KIND_LABEL: Record<CouponKind, string> = {
  code: 'Code coupon',
  auto: 'Automatic',
};

export const PHASE_LABEL: Record<CouponPhase, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  paused: 'Paused',
  expired: 'Expired',
  exhausted: 'Used up',
};

export const PHASE_COLOR: Record<CouponPhase, string> = {
  draft: 'gray',
  scheduled: 'blue',
  live: 'teal',
  paused: 'orange',
  expired: 'gray',
  exhausted: 'red',
};

export const STATUS_LABEL: Record<CouponStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
};

export const SEGMENT_LABEL: Record<CouponDetail['segment'], string> = {
  all: 'Everyone',
  first_order: 'First order only',
  specific: 'Specific customers',
  inactive_days: 'Customers inactive for N days',
};

export const PLATFORM_LABEL: Record<CouponDetail['platform'], string> = {
  both: 'Web and app',
  web: 'Web only',
  app: 'App only',
};

/** Basis points <-> percent. toPrecision absorbs float noise (0.29 * 100 = 28.999999999999996). */
export const percentToBp = (p: number) => Math.round(Number((p * 100).toPrecision(12)));
export const bpToPercent = (bp: number) => bp / 100;

export function formatPercent(bp: number): string {
  return `${bpToPercent(bp)}%`;
}

/** One-line description of the discount for the list. */
export function valueSummary(
  c: Pick<CouponRow, 'type' | 'value'> & { maxDiscountP?: number | null },
) {
  switch (c.type) {
    case 'percent':
      return c.maxDiscountP
        ? `${formatPercent(c.value)} off (max ${formatPrice(c.maxDiscountP)})`
        : `${formatPercent(c.value)} off`;
    case 'fixed':
      return `${formatPrice(c.value)} off`;
    case 'free_delivery':
      return 'Free delivery';
    case 'bxgy':
      return 'Buy X get Y';
    case 'tiered':
      return 'Tiered by spend';
    case 'bundle':
      return 'Bundle price';
  }
}

export function windowSummary(
  startsAt: string | null,
  endsAt: string | null,
  fmt: (iso: string | null) => string,
) {
  if (!startsAt && !endsAt) return 'Always';
  return `${startsAt ? fmt(startsAt) : 'Now'} to ${endsAt ? fmt(endsAt) : 'no end'}`;
}

export type SectionKey = 'identity' | 'discount' | 'scope' | 'conditions' | 'limits' | 'stacking';

/**
 * The API reports problems as plain sentences, not field paths, so route them to a section by
 * keyword. Unknown ones land in "identity" (top of the form) so they are never lost.
 */
export function issueSection(message: string): SectionKey {
  const m = message.toLowerCase();
  if (/(^|\W)(config|tier|percent|fixed|basis|value|bxgy|bundle|free item|delivery)/.test(m)) {
    return 'discount';
  }
  if (/target|categor|brand|product/.test(m)) return 'scope';
  if (/segment|customer|inactive|window|end must|start/.test(m)) return 'conditions';
  if (/limit|budget|max/.test(m)) return 'limits';
  return 'identity';
}
