import { isoToLocal, localToIso } from '~/features/carousel/logic';
import type { CouponCreateBody, CouponUpdateBody } from './api';
import { bpToPercent, type CouponDetail, percentToBp } from './logic';

export interface TargetRef {
  targetType: 'product' | 'category' | 'brand';
  targetId: string;
  mode: 'include' | 'exclude';
  label: string | null;
}

export interface CustomerRef {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface TierRow {
  minSpendP: number | null;
  discountP: number | null;
}

export interface BundleRow {
  productId: string;
  qty: number;
}

/** Everything the editor edits. Money in paisa, percent as a plain number (12.5 = 12.5%). */
export interface CouponFormValues {
  name: string;
  kind: 'code' | 'auto';
  code: string;
  isBulk: boolean;
  visibility: 'public' | 'hidden';
  isCollectable: boolean;
  termsEn: string;
  termsBn: string;
  priority: number;
  type: CouponDetail['type'];
  percent: number | '';
  fixedP: number | null;
  maxDiscountP: number | null;
  tiers: TierRow[];
  zoneIds: string[];
  buyQty: number;
  getQty: number;
  getPercent: number | '';
  getSame: boolean;
  getProductIds: string[];
  bundleItems: BundleRow[];
  bundlePriceP: number | null;
  targets: TargetRef[];
  minOrderP: number | null;
  minQty: number | null;
  startsAt: string | null;
  endsAt: string | null;
  segment: CouponDetail['segment'];
  segmentParam: number | '';
  customers: CustomerRef[];
  paymentMethods: string[];
  platform: CouponDetail['platform'];
  maxUsesTotal: number | null;
  maxPerCustomer: number | null;
  maxPerPhone: number | null;
  maxPerDevice: number | null;
  budgetCapP: number | null;
  stacksWithSalePrice: boolean;
  stacksWithOtherCoupons: boolean;
  stacksWithPoints: boolean;
}

export const emptyValues: CouponFormValues = {
  name: '',
  kind: 'code',
  code: '',
  isBulk: false,
  visibility: 'public',
  isCollectable: false,
  termsEn: '',
  termsBn: '',
  priority: 0,
  type: 'percent',
  percent: '',
  fixedP: null,
  maxDiscountP: null,
  tiers: [],
  zoneIds: [],
  buyQty: 1,
  getQty: 1,
  getPercent: 100,
  getSame: true,
  getProductIds: [],
  bundleItems: [],
  bundlePriceP: null,
  targets: [],
  minOrderP: null,
  minQty: null,
  startsAt: null,
  endsAt: null,
  segment: 'all',
  segmentParam: '',
  customers: [],
  paymentMethods: [],
  platform: 'both',
  maxUsesTotal: null,
  maxPerCustomer: null,
  maxPerPhone: null,
  maxPerDevice: null,
  budgetCapP: null,
  stacksWithSalePrice: false,
  stacksWithOtherCoupons: false,
  stacksWithPoints: false,
};

const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);

export function fromDetail(c: CouponDetail): CouponFormValues {
  const cfg = c.config as {
    buyQty?: number;
    getQty?: number;
    getPctBp?: number;
    getSame?: boolean;
    getProductIds?: string[];
    items?: { productId: string; qty: number }[];
    priceP?: number;
  };
  return {
    ...emptyValues,
    name: c.name,
    kind: c.kind,
    code: c.code ?? '',
    isBulk: c.isBulk,
    visibility: c.visibility,
    isCollectable: c.isCollectable,
    termsEn: c.termsEn ?? '',
    termsBn: c.termsBn ?? '',
    priority: c.priority,
    type: c.type,
    percent: c.type === 'percent' ? bpToPercent(c.value) : '',
    fixedP: c.type === 'fixed' ? c.value : null,
    maxDiscountP: c.maxDiscountP,
    tiers: c.tiers.map((t) => ({ ...t })),
    zoneIds: c.zones.map((z) => z.id),
    buyQty: num(cfg.buyQty, 1),
    getQty: num(cfg.getQty, 1),
    getPercent: bpToPercent(num(cfg.getPctBp, 10000)),
    getSame: cfg.getSame ?? true,
    getProductIds: cfg.getProductIds ?? [],
    bundleItems: cfg.items?.length
      ? cfg.items.map((i) => ({ productId: i.productId, qty: i.qty }))
      : emptyValues.bundleItems,
    bundlePriceP: typeof cfg.priceP === 'number' ? cfg.priceP : null,
    targets: c.targets.map((t) => ({ ...t })),
    minOrderP: c.minOrderP,
    minQty: c.minQty,
    startsAt: isoToLocal(c.startsAt),
    endsAt: isoToLocal(c.endsAt),
    segment: c.segment,
    segmentParam: c.segmentParam ?? '',
    customers: c.customers.map((x) => ({ ...x })),
    paymentMethods: c.paymentMethods,
    platform: c.platform,
    maxUsesTotal: c.maxUsesTotal,
    maxPerCustomer: c.maxPerCustomer,
    maxPerPhone: c.maxPerPhone,
    maxPerDevice: c.maxPerDevice,
    budgetCapP: c.budgetCapP,
    stacksWithSalePrice: c.stacksWithSalePrice,
    stacksWithOtherCoupons: c.stacksWithOtherCoupons,
    stacksWithPoints: c.stacksWithPoints,
  };
}

function configFor(v: CouponFormValues): Record<string, unknown> | undefined {
  if (v.type === 'bxgy') {
    return {
      buyQty: v.buyQty,
      getQty: v.getQty,
      getPctBp: percentToBp(Number(v.getPercent) || 0),
      getSame: v.getSame,
      getProductIds: v.getSame ? [] : v.getProductIds,
    };
  }
  if (v.type === 'bundle') {
    return {
      items: v.bundleItems.filter((i) => i.productId),
      priceP: v.bundlePriceP ?? 0,
    };
  }
  return undefined;
}

function valueFor(v: CouponFormValues): number {
  if (v.type === 'percent') return percentToBp(Number(v.percent) || 0);
  if (v.type === 'fixed') return v.fixedP ?? 0;
  return 0;
}

/** Create body; the update body is the same minus `kind` (it never changes). */
export function toBody(v: CouponFormValues): CouponCreateBody {
  const code = v.kind === 'code' && !v.isBulk ? v.code.trim() : '';
  const segmentParam =
    v.segment === 'inactive_days' && v.segmentParam !== '' ? v.segmentParam : null;
  return {
    name: v.name.trim(),
    kind: v.kind,
    code: code || null,
    isBulk: v.kind === 'code' ? v.isBulk : false,
    visibility: v.visibility,
    isCollectable: v.kind === 'code' ? v.isCollectable : false,
    termsEn: v.termsEn.trim() || null,
    termsBn: v.termsBn.trim() || null,
    priority: v.kind === 'auto' ? v.priority : 0,
    type: v.type,
    value: valueFor(v),
    maxDiscountP: v.type === 'percent' ? v.maxDiscountP : null,
    config: configFor(v),
    minOrderP: v.minOrderP,
    minQty: v.minQty,
    startsAt: localToIso(v.startsAt),
    endsAt: localToIso(v.endsAt),
    segment: v.segment,
    segmentParam,
    paymentMethods: v.paymentMethods,
    platform: v.platform,
    maxUsesTotal: v.maxUsesTotal,
    maxPerCustomer: v.maxPerCustomer,
    maxPerPhone: v.maxPerPhone,
    maxPerDevice: v.maxPerDevice,
    budgetCapP: v.budgetCapP,
    stacksWithSalePrice: v.stacksWithSalePrice,
    stacksWithOtherCoupons: v.stacksWithOtherCoupons,
    stacksWithPoints: v.stacksWithPoints,
    targets: v.targets.map(({ targetType, targetId, mode }) => ({ targetType, targetId, mode })),
    zoneIds: v.type === 'free_delivery' ? v.zoneIds : [],
    tiers:
      v.type === 'tiered'
        ? v.tiers.map((t) => ({ minSpendP: t.minSpendP ?? 0, discountP: t.discountP ?? 0 }))
        : [],
    customerIds: v.segment === 'specific' ? v.customers.map((c) => c.id) : [],
  };
}

export function toUpdateBody(v: CouponFormValues): CouponUpdateBody {
  const { kind: _kind, ...rest } = toBody(v);
  return rest;
}

/** Cheap checks so obvious mistakes never cost a round trip; the API stays the authority. */
export function clientIssues(v: CouponFormValues): string[] {
  const out: string[] = [];
  if (!v.name.trim()) out.push('Give the coupon a name.');
  if (v.kind === 'code' && !v.isBulk) {
    if (!v.code.trim()) out.push('A code coupon needs a code (or mark it as bulk).');
    else if (!/^[A-Za-z0-9_-]{3,32}$/.test(v.code.trim())) {
      out.push('The code must be 3 to 32 letters, digits, - or _.');
    }
  }
  if (v.type === 'percent' && !(Number(v.percent) > 0 && Number(v.percent) <= 100)) {
    out.push('A percent value is between 0.01% and 100%.');
  }
  if (v.type === 'fixed' && !(v.fixedP && v.fixedP > 0)) {
    out.push('A fixed discount must be above zero.');
  }
  if (v.type === 'tiered') {
    if (v.tiers.length === 0) out.push('A tiered coupon needs at least one tier.');
    else if (v.tiers.some((t) => !t.discountP)) out.push('Every tier needs a discount amount.');
  }
  if (v.type === 'bundle') {
    const filled = v.bundleItems.filter((i) => i.productId);
    if (filled.length < 2) out.push('A bundle needs at least two products.');
    if (!v.bundlePriceP) out.push('Set the bundle price.');
  }
  if (v.type === 'bxgy' && !v.getSame && v.getProductIds.length === 0) {
    out.push('Pick the free products, or switch to "cheapest eligible units".');
  }
  const s = localToIso(v.startsAt);
  const e = localToIso(v.endsAt);
  if (s && e && Date.parse(e) <= Date.parse(s)) out.push('The end must be after the start.');
  if (v.segment === 'inactive_days' && !v.segmentParam) {
    out.push('Inactive-days segment needs the number of days.');
  }
  return out;
}
