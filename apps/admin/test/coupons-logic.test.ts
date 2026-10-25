import { describe, expect, it } from 'vitest';
import {
  type CouponFormValues,
  clientIssues,
  emptyValues,
  fromDetail,
  toBody,
  toUpdateBody,
} from '~/features/coupons/form';
import {
  bpToPercent,
  type CouponDetail,
  issueSection,
  percentToBp,
  valueSummary,
  windowSummary,
} from '~/features/coupons/logic';

const base: CouponFormValues = { ...emptyValues, name: 'Welcome', code: 'welcome10', percent: 10 };

function detail(over: Partial<CouponDetail> = {}): CouponDetail {
  return {
    id: 'c1',
    name: 'Eid',
    kind: 'code',
    code: 'EID',
    isBulk: false,
    type: 'percent',
    value: 1250,
    status: 'active',
    phase: 'live',
    visibility: 'public',
    isCollectable: false,
    startsAt: null,
    endsAt: null,
    usesCount: 0,
    discountGivenP: 0,
    maxUsesTotal: null,
    budgetCapP: null,
    priority: 0,
    createdAt: '2026-10-25T00:00:00.000Z',
    termsEn: null,
    termsBn: null,
    maxDiscountP: 50000,
    config: {},
    minOrderP: null,
    minQty: null,
    segment: 'all',
    segmentParam: null,
    paymentMethods: [],
    platform: 'both',
    maxPerCustomer: null,
    maxPerPhone: null,
    maxPerDevice: null,
    stacksWithSalePrice: false,
    stacksWithOtherCoupons: false,
    stacksWithPoints: false,
    source: 'manual',
    updatedAt: '2026-10-25T00:00:00.000Z',
    targets: [],
    zones: [],
    tiers: [],
    customers: [],
    codeStats: { total: 0, used: 0, assigned: 0 },
    ...over,
  } as CouponDetail;
}

describe('percent <-> basis points', () => {
  it('converts without float noise', () => {
    expect(percentToBp(12.5)).toBe(1250);
    expect(percentToBp(0.29)).toBe(29);
    expect(percentToBp(100)).toBe(10000);
    expect(bpToPercent(1250)).toBe(12.5);
  });
});

describe('toBody', () => {
  it('builds a percent code coupon', () => {
    const b = toBody({ ...base, maxDiscountP: 50000 });
    expect(b).toMatchObject({
      kind: 'code',
      code: 'welcome10',
      type: 'percent',
      value: 1000,
      maxDiscountP: 50000,
      tiers: [],
      zoneIds: [],
    });
  });

  it('drops the code for bulk and auto coupons', () => {
    expect(toBody({ ...base, isBulk: true }).code).toBeNull();
    expect(toBody({ ...base, kind: 'auto', isCollectable: true })).toMatchObject({
      code: null,
      isCollectable: false,
      isBulk: false,
    });
  });

  it('puts fixed amounts in value and ignores the max discount', () => {
    const b = toBody({ ...base, type: 'fixed', fixedP: 20000, maxDiscountP: 999 });
    expect(b).toMatchObject({ value: 20000, maxDiscountP: null });
  });

  it('builds bxgy and bundle configs', () => {
    const bx = toBody({
      ...base,
      type: 'bxgy',
      buyQty: 2,
      getQty: 1,
      getPercent: 50,
      getSame: true,
    });
    expect(bx.value).toBe(0);
    expect(bx.config).toEqual({
      buyQty: 2,
      getQty: 1,
      getPctBp: 5000,
      getSame: true,
      getProductIds: [],
    });
    const bu = toBody({
      ...base,
      type: 'bundle',
      bundleItems: [
        { productId: 'a', qty: 1 },
        { productId: 'b', qty: 2 },
      ],
      bundlePriceP: 90000,
    });
    expect(bu.config).toEqual({
      items: [
        { productId: 'a', qty: 1 },
        { productId: 'b', qty: 2 },
      ],
      priceP: 90000,
    });
  });

  it('sends tiers, zones and customers only for their own type or segment', () => {
    const tiers = [{ minSpendP: 100000, discountP: 5000 }];
    expect(toBody({ ...base, type: 'tiered', tiers }).tiers).toEqual(tiers);
    expect(toBody({ ...base, tiers }).tiers).toEqual([]);
    expect(toBody({ ...base, type: 'free_delivery', zoneIds: ['z'] }).zoneIds).toEqual(['z']);
    const c = { id: 'u1', name: 'A', phone: null, email: null };
    expect(toBody({ ...base, segment: 'specific', customers: [c] }).customerIds).toEqual(['u1']);
    expect(toBody({ ...base, customers: [c] }).customerIds).toEqual([]);
  });

  it('update body has no kind', () => {
    expect('kind' in toUpdateBody(base)).toBe(false);
  });
});

describe('fromDetail', () => {
  it('maps a stored percent coupon back to form values', () => {
    const v = fromDetail(detail());
    expect(v).toMatchObject({ percent: 12.5, fixedP: null, maxDiscountP: 50000, code: 'EID' });
    expect(toBody(v)).toMatchObject({ value: 1250, code: 'EID' });
  });

  it('reads bxgy config', () => {
    const v = fromDetail(
      detail({
        type: 'bxgy',
        value: 0,
        config: { buyQty: 3, getQty: 1, getPctBp: 10000, getSame: false, getProductIds: ['p1'] },
      }),
    );
    expect(v).toMatchObject({
      buyQty: 3,
      getQty: 1,
      getPercent: 100,
      getSame: false,
      getProductIds: ['p1'],
    });
  });
});

describe('clientIssues', () => {
  it('accepts a valid coupon', () => {
    expect(clientIssues(base)).toEqual([]);
  });

  it('flags the obvious mistakes', () => {
    expect(clientIssues({ ...base, name: ' ' })).toContain('Give the coupon a name.');
    expect(clientIssues({ ...base, code: 'a b' }).join()).toMatch(/3 to 32/);
    expect(clientIssues({ ...base, percent: '' }).join()).toMatch(/percent/i);
    expect(clientIssues({ ...base, type: 'tiered' }).join()).toMatch(/at least one tier/);
    expect(
      clientIssues({ ...base, type: 'bundle', bundleItems: [{ productId: 'a', qty: 1 }] }).join(),
    ).toMatch(/two products/);
    expect(
      clientIssues({
        ...base,
        startsAt: '2026-10-26 10:00:00',
        endsAt: '2026-10-25 10:00:00',
      }).join(),
    ).toMatch(/after the start/);
  });

  it('does not ask for a code on bulk coupons', () => {
    expect(clientIssues({ ...base, isBulk: true, code: '' })).toEqual([]);
  });
});

describe('issueSection', () => {
  it('routes server sentences to the section they belong to', () => {
    expect(issueSection('Tiers must have strictly ascending minimum spend.')).toBe('discount');
    expect(issueSection('config.items: Too small')).toBe('discount');
    expect(issueSection('A collectable coupon must be public.')).toBe('identity');
    expect(issueSection('Inactive-days segment needs the number of days.')).toBe('conditions');
    expect(issueSection('The end must be after the start.')).toBe('conditions');
    expect(issueSection('Something unknown')).toBe('identity');
  });
});

describe('summaries', () => {
  it('describes the discount', () => {
    expect(valueSummary({ type: 'percent', value: 1250 })).toBe('12.5% off');
    expect(valueSummary({ type: 'percent', value: 1000, maxDiscountP: 50000 })).toContain('max');
    expect(valueSummary({ type: 'fixed', value: 10000 })).toContain('100');
    expect(valueSummary({ type: 'free_delivery', value: 0 })).toBe('Free delivery');
  });

  it('describes the window', () => {
    const fmt = (s: string | null) => s ?? '';
    expect(windowSummary(null, null, fmt)).toBe('Always');
    expect(windowSummary('a', null, fmt)).toBe('a to no end');
    expect(windowSummary(null, 'b', fmt)).toBe('Now to b');
  });
});
