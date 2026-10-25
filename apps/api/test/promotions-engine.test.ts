import { describe, expect, it } from 'vitest';
import { allocate } from '../src/promotions/engine/allocate';
import type { CouponCandidate, CouponRow, PromoUsage } from '../src/promotions/engine/engine.types';
import { NO_USAGE } from '../src/promotions/engine/engine.types';
import { evaluate } from '../src/promotions/engine/evaluate';
import type { PromoContext, PromoLine } from '../src/promotions/types';

const NOW = new Date('2026-10-25T10:00:00Z');
let seq = 0;
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function line(o: Partial<PromoLine> & { n?: number } = {}): PromoLine {
  const n = o.n ?? ++seq;
  return {
    variantId: uid(n),
    productId: uid(1000 + n),
    brandId: null,
    categoryIds: [],
    qty: 1,
    unitPriceP: 100_00,
    priceSource: 'base',
    ...o,
  };
}

function coupon(o: Partial<CouponRow> & Partial<Omit<CouponCandidate, 'coupon'>> = {}) {
  const { targets, zoneIds, tiers, customerIds, codeRow, typedCode, ...row } = o;
  const id = row.id ?? uid(5000 + ++seq);
  const cand: CouponCandidate = {
    coupon: {
      id,
      name: `C${id.slice(-4)}`,
      kind: 'auto',
      type: 'percent',
      status: 'active',
      value: 1000,
      maxDiscountP: null,
      config: {},
      minOrderP: null,
      minQty: null,
      startsAt: null,
      endsAt: null,
      segment: 'all',
      segmentParam: null,
      paymentMethods: [],
      platform: 'both',
      maxUsesTotal: null,
      maxPerCustomer: null,
      maxPerPhone: null,
      maxPerDevice: null,
      budgetCapP: null,
      usesCount: 0,
      discountGivenP: 0,
      stacksWithSalePrice: false,
      stacksWithOtherCoupons: false,
      priority: 0,
      ...row,
    },
    targets: targets ?? [],
    zoneIds: zoneIds ?? [],
    tiers: tiers ?? [],
    customerIds: customerIds ?? [],
    codeRow: codeRow ?? null,
    typedCode: typedCode ?? (row.kind === 'code' ? `CODE${seq}` : null),
  };
  return cand;
}

const code = (c: string, o: Partial<CouponRow> & Partial<Omit<CouponCandidate, 'coupon'>> = {}) =>
  coupon({ kind: 'code', typedCode: c, ...o });

function ctx(lines: PromoLine[], o: Partial<PromoContext> = {}): PromoContext {
  return {
    lines,
    zoneId: 'zone-1',
    deliveryChargeP: 60_00,
    customerId: uid(9001),
    phone: '+8801712345678',
    visitorId: 'v1',
    platform: 'web',
    paymentMethod: 'cod',
    codes: [],
    now: NOW,
    ...o,
  };
}

const run = (cands: CouponCandidate[], c: PromoContext, usage: PromoUsage = NO_USAGE) =>
  evaluate(cands, c, usage);

describe('allocate', () => {
  it('splits exactly with largest remainder', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [3, 3, 4])).toEqual([3, 3, 4]);
    expect(allocate(1, [5, 5])).toEqual([1, 0]);
    expect(allocate(7, [0, 3, 0, 4])).toEqual([0, 3, 0, 4]);
  });
  it('handles empty and zero', () => {
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
    expect(allocate(5, [0, 0])).toEqual([0, 0]);
    expect(allocate(5, [])).toEqual([]);
  });
  it('always sums to the total for awkward numbers', () => {
    for (const total of [1, 7, 99, 12_345, 999_999]) {
      for (const w of [[1], [1, 2, 3], [333, 333, 334], [1, 1000000, 7], [5, 0, 5, 5, 5]]) {
        const parts = allocate(total, w);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        for (const [i, p] of parts.entries()) if (w[i] === 0) expect(p).toBe(0);
      }
    }
  });
});

describe('percent / fixed / tiered', () => {
  it('percent floors and allocates to lines, sum exact', () => {
    const a = line({ unitPriceP: 33_33, qty: 1 });
    const b = line({ unitPriceP: 66_67, qty: 1 });
    const r = run([coupon({ value: 1500 })], ctx([a, b]));
    expect(r.autoDiscountP).toBe(1500); // floor(10000 * 15%)
    expect(r.applied[0]?.lineAllocations.reduce((s, x) => s + x.amountP, 0)).toBe(1500);
    expect(Object.values(r.lineDiscounts).reduce((s, x) => s + x, 0)).toBe(1500);
  });
  it('percent respects maxDiscountP', () => {
    const r = run(
      [coupon({ value: 5000, maxDiscountP: 20_00 })],
      ctx([line({ unitPriceP: 1000_00 })]),
    );
    expect(r.autoDiscountP).toBe(20_00);
  });
  it('fixed never exceeds the eligible total', () => {
    const only = line({ unitPriceP: 120_00 });
    const r = run([coupon({ type: 'fixed', value: 500_00 })], ctx([only]));
    expect(r.autoDiscountP).toBe(120_00);
    expect(r.lineDiscounts).toEqual({ [only.variantId]: 120_00 });
  });
  it('tiered picks the best reached tier', () => {
    const tiers = [
      { minSpendP: 500_00, discountP: 30_00 },
      { minSpendP: 1000_00, discountP: 100_00 },
      { minSpendP: 2000_00, discountP: 300_00 },
    ];
    const c = coupon({ type: 'tiered', tiers });
    expect(run([c], ctx([line({ unitPriceP: 1200_00 })])).autoDiscountP).toBe(100_00);
    expect(run([c], ctx([line({ unitPriceP: 2000_00 })])).autoDiscountP).toBe(300_00);
    expect(run([c], ctx([line({ unitPriceP: 400_00 })])).applied).toEqual([]);
  });
  it('tiered code below the first tier is rejected MIN_ORDER', () => {
    const c = code('T', { type: 'tiered', tiers: [{ minSpendP: 500_00, discountP: 30_00 }] });
    const r = run([c], ctx([line()], { codes: ['t'] }));
    expect(r.rejected).toEqual([{ code: 'T', reason: 'MIN_ORDER' }]);
  });
  it('a line never goes below zero across sequential discounts', () => {
    const l = line({ unitPriceP: 100_00 });
    const a = coupon({ type: 'fixed', value: 80_00, stacksWithOtherCoupons: true, priority: 5 });
    const b = coupon({ type: 'fixed', value: 80_00, stacksWithOtherCoupons: true });
    const r = run([a, b], ctx([l]));
    expect(r.autoDiscountP).toBe(100_00);
    expect(r.lineDiscounts[l.variantId]).toBe(100_00);
  });
  it('percent applies to what is left after an earlier discount', () => {
    const l = line({ unitPriceP: 1000_00 });
    const a = coupon({ type: 'fixed', value: 500_00, stacksWithOtherCoupons: true, priority: 9 });
    const b = coupon({ value: 1000, stacksWithOtherCoupons: true });
    const r = run([a, b], ctx([l]));
    expect(r.applied.map((d) => d.itemDiscountP)).toEqual([500_00, 50_00]);
  });
});

describe('scope', () => {
  const cat = uid(7001);
  const brand = uid(7002);
  const inCat = line({ n: 1, categoryIds: [cat, uid(7000)], unitPriceP: 200_00 });
  const inBrand = line({ n: 2, brandId: brand, unitPriceP: 300_00 });
  const other = line({ n: 3, unitPriceP: 500_00 });

  it('include category / brand / product', () => {
    const t = (targetType: 'category' | 'brand' | 'product', targetId: string) => [
      { targetType, targetId, mode: 'include' as const },
    ];
    const lines = [inCat, inBrand, other];
    expect(run([coupon({ targets: t('category', cat) })], ctx(lines)).autoDiscountP).toBe(20_00);
    expect(run([coupon({ targets: t('category', uid(7000)) })], ctx(lines)).autoDiscountP).toBe(
      20_00,
    );
    expect(run([coupon({ targets: t('brand', brand) })], ctx(lines)).autoDiscountP).toBe(30_00);
    expect(
      run([coupon({ targets: t('product', other.productId) })], ctx(lines)).autoDiscountP,
    ).toBe(50_00);
  });
  it('exclude carves out lines', () => {
    const c = coupon({ targets: [{ targetType: 'brand', targetId: brand, mode: 'exclude' }] });
    expect(run([c], ctx([inCat, inBrand, other])).autoDiscountP).toBe(70_00);
  });
  it('no matching lines rejects a code', () => {
    const c = code('X', { targets: [{ targetType: 'brand', targetId: brand, mode: 'include' }] });
    expect(run([c], ctx([other], { codes: ['X'] })).rejected).toEqual([
      { code: 'X', reason: 'NO_MATCHING_ITEMS' },
    ]);
  });
  it('ignores sale/flash lines unless stacksWithSalePrice', () => {
    const sale = line({ n: 4, unitPriceP: 100_00, priceSource: 'sale' });
    const flash = line({ n: 5, unitPriceP: 100_00, priceSource: 'flash' });
    const base = line({ n: 6, unitPriceP: 100_00 });
    expect(run([coupon()], ctx([sale, flash, base])).autoDiscountP).toBe(10_00);
    expect(
      run([coupon({ stacksWithSalePrice: true })], ctx([sale, flash, base])).autoDiscountP,
    ).toBe(30_00);
    const c = code('S');
    expect(run([c], ctx([sale], { codes: ['S'] })).rejected[0]?.reason).toBe('ONLY_REGULAR_PRICE');
  });
  it('minOrderP and minQty look at eligible lines only', () => {
    const sale = line({ n: 4, unitPriceP: 900_00, priceSource: 'sale' });
    const base = line({ n: 6, unitPriceP: 100_00, qty: 2 });
    const c = (o: Partial<CouponRow>) => code('M', o);
    expect(
      run([c({ minOrderP: 500_00 })], ctx([sale, base], { codes: ['M'] })).rejected[0]?.reason,
    ).toBe('MIN_ORDER');
    expect(run([c({ minOrderP: 200_00 })], ctx([sale, base], { codes: ['M'] })).rejected).toEqual(
      [],
    );
    expect(run([c({ minQty: 3 })], ctx([sale, base], { codes: ['M'] })).rejected[0]?.reason).toBe(
      'MIN_QTY',
    );
  });
  it('minOrderP is checked after earlier discounts', () => {
    const l = line({ unitPriceP: 1000_00 });
    const a = coupon({ type: 'fixed', value: 600_00, stacksWithOtherCoupons: true, priority: 9 });
    const b = code('B', { minOrderP: 500_00, stacksWithOtherCoupons: true });
    const r = run([a, b], ctx([l], { codes: ['B'] }));
    expect(r.rejected).toEqual([{ code: 'B', reason: 'MIN_ORDER' }]);
  });
});

describe('free delivery', () => {
  it('waives the charge, capped by maxDiscountP, zone aware', () => {
    const c = coupon({ type: 'free_delivery' });
    const r = run([c], ctx([line()], { deliveryChargeP: 80_00 }));
    expect(r.deliveryDiscountP).toBe(80_00);
    expect(r.autoDiscountP).toBe(0);
    expect(
      run([coupon({ type: 'free_delivery', maxDiscountP: 50_00 })], ctx([line()]))
        .deliveryDiscountP,
    ).toBe(50_00);
    const z = coupon({ type: 'free_delivery', zoneIds: ['zone-9'] });
    expect(run([z], ctx([line()])).deliveryDiscountP).toBe(0);
    expect(
      run([coupon({ type: 'free_delivery', zoneIds: ['zone-1'] })], ctx([line()]))
        .deliveryDiscountP,
    ).toBe(60_00);
  });
  it('stacks after a zone discount only for what is left', () => {
    const r = run([coupon({ type: 'free_delivery' })], ctx([line()], { deliveryChargeP: 0 }));
    expect(r.applied).toEqual([]); // auto with zero effect is dropped
  });
  it('without a zone yet (cart stage) the coupon still shows as applied', () => {
    const c = code('FD', { type: 'free_delivery', zoneIds: ['zone-1'] });
    const r = run([c], ctx([line()], { zoneId: '', deliveryChargeP: 0, codes: ['FD'] }));
    expect(r.rejected).toEqual([]);
    expect(r.applied[0]?.type).toBe('free_delivery');
  });
  it('zone mismatch rejects a typed code', () => {
    const c = code('FD', { type: 'free_delivery', zoneIds: ['zone-9'] });
    expect(run([c], ctx([line()], { codes: ['FD'] })).rejected[0]?.reason).toBe('ZONE');
  });
});

describe('bxgy', () => {
  const cfg = (o: object = {}) => ({
    buyQty: 2,
    getQty: 1,
    getPctBp: 10000,
    getSame: true,
    getProductIds: [],
    ...o,
  });
  it('buy 2 get 1 free: cheapest unit per group is free', () => {
    const a = line({ n: 1, unitPriceP: 300_00, qty: 2 });
    const b = line({ n: 2, unitPriceP: 100_00, qty: 1 });
    const r = run([coupon({ type: 'bxgy', config: cfg() })], ctx([a, b]));
    expect(r.autoDiscountP).toBe(100_00);
    expect(r.lineDiscounts).toEqual({ [b.variantId]: 100_00 });
  });
  it('two full groups', () => {
    const a = line({ n: 1, unitPriceP: 100_00, qty: 4 });
    const b = line({ n: 2, unitPriceP: 50_00, qty: 2 });
    const r = run([coupon({ type: 'bxgy', config: cfg() })], ctx([a, b]));
    expect(r.autoDiscountP).toBe(100_00); // two cheapest of 6 units (2 groups) = 2 x 50
  });
  it('not enough units: nothing', () => {
    const a = line({ n: 1, qty: 2 });
    const c = code('B', { type: 'bxgy', config: cfg() });
    expect(run([c], ctx([a], { codes: ['B'] })).rejected[0]?.reason).toBe('NO_MATCHING_ITEMS');
  });
  it('50% off the get unit, floored', () => {
    const a = line({ n: 1, unitPriceP: 99_99, qty: 3 });
    const r = run([coupon({ type: 'bxgy', config: cfg({ getPctBp: 5000 }) })], ctx([a]));
    expect(r.autoDiscountP).toBe(49_99);
  });
  it('getSame=false: get units come from getProductIds lines', () => {
    const buy = line({ n: 1, unitPriceP: 400_00, qty: 2 });
    const free = line({ n: 2, unitPriceP: 150_00, qty: 1 });
    const cfgOther = cfg({ getSame: false, getProductIds: [free.productId] });
    const r = run([coupon({ type: 'bxgy', config: cfgOther })], ctx([buy, free]));
    expect(r.autoDiscountP).toBe(150_00);
    expect(r.lineDiscounts).toEqual({ [free.variantId]: 150_00 });
    // Only one buy unit: no group.
    const one = line({ n: 3, unitPriceP: 400_00, qty: 1 });
    expect(run([coupon({ type: 'bxgy', config: cfgOther })], ctx([one, free])).applied).toEqual([]);
  });
  it('invalid config gives nothing instead of throwing', () => {
    const r = run([coupon({ type: 'bxgy', config: { nope: 1 } })], ctx([line({ qty: 5 })]));
    expect(r.applied).toEqual([]);
  });
});

describe('bundle', () => {
  const a = line({ n: 1, unitPriceP: 500_00, qty: 2 });
  const b = line({ n: 2, unitPriceP: 300_00, qty: 1 });
  const cfg = (qtyA = 1) => ({
    items: [
      { productId: a.productId, qty: qtyA },
      { productId: b.productId, qty: 1 },
    ],
    priceP: 700_00,
  });
  it('one full set', () => {
    const r = run([coupon({ type: 'bundle', config: cfg() })], ctx([a, b]));
    expect(r.autoDiscountP).toBe(100_00); // 500+300-700
  });
  it('sets = min over items', () => {
    const b2 = { ...b, qty: 2 };
    const r = run([coupon({ type: 'bundle', config: cfg() })], ctx([a, b2]));
    expect(r.autoDiscountP).toBe(200_00); // 2 sets
    const r2 = run([coupon({ type: 'bundle', config: cfg(2) })], ctx([a, b2]));
    expect(r2.autoDiscountP).toBe(600_00); // 1 set = 2 of A + 1 of B (1300) for 700
  });
  it('missing item: no bundle', () => {
    expect(run([coupon({ type: 'bundle', config: cfg() })], ctx([a])).applied).toEqual([]);
  });
  it('bundle price above the items gives 0 and is dropped', () => {
    const c = { ...cfg(), priceP: 900_00 };
    expect(run([coupon({ type: 'bundle', config: c })], ctx([a, b])).applied).toEqual([]);
  });
  it('variant-specific item', () => {
    const c = {
      items: [
        { productId: a.productId, variantId: uid(999), qty: 1 },
        { productId: b.productId, qty: 1 },
      ],
      priceP: 700_00,
    };
    expect(run([coupon({ type: 'bundle', config: c })], ctx([a, b])).applied).toEqual([]);
  });
  it('allocation sums exactly', () => {
    const r = run([coupon({ type: 'bundle', config: { ...cfg(), priceP: 333_33 } })], ctx([a, b]));
    const d = r.applied[0];
    expect(d?.lineAllocations.reduce((s, x) => s + x.amountP, 0)).toBe(d?.itemDiscountP);
    expect(d?.itemDiscountP).toBe(500_00 + 300_00 - 333_33);
  });
});

describe('eligibility', () => {
  const l = [line({ unitPriceP: 1000_00 })];
  const one = (
    o: Partial<CouponRow> & Partial<Omit<CouponCandidate, 'coupon'>>,
    c = ctx(l, { codes: ['E'] }),
    u = NO_USAGE,
  ) => run([code('E', o)], c, u).rejected[0]?.reason ?? 'OK';

  it('status, window, platform, payment method', () => {
    expect(one({ status: 'paused' })).toBe('INACTIVE');
    expect(one({ status: 'draft' })).toBe('INACTIVE');
    expect(one({ startsAt: new Date(NOW.getTime() + 1000) })).toBe('NOT_STARTED');
    expect(one({ endsAt: NOW })).toBe('EXPIRED');
    expect(one({ endsAt: new Date(NOW.getTime() + 1000) })).toBe('OK');
    expect(one({ platform: 'app' })).toBe('PLATFORM');
    expect(one({ platform: 'web' })).toBe('OK');
    expect(one({ paymentMethods: ['bkash'] })).toBe('PAYMENT_METHOD');
    expect(one({ paymentMethods: ['cod'] })).toBe('OK');
  });
  it('unknown codes', () => {
    expect(run([], ctx(l, { codes: ['nope'] })).rejected).toEqual([
      { code: 'NOPE', reason: 'NOT_FOUND' },
    ]);
  });
  it('zone', () => {
    expect(one({ zoneIds: ['z9'] })).toBe('ZONE');
    expect(one({ zoneIds: ['zone-1', 'z9'] })).toBe('OK');
  });
  it('segment first_order / inactive_days / specific', () => {
    expect(one({ segment: 'first_order' }, undefined, { ...NO_USAGE, hasPriorOrder: true })).toBe(
      'SEGMENT',
    );
    expect(one({ segment: 'first_order' })).toBe('OK');
    const old = new Date(NOW.getTime() - 40 * 86_400_000);
    const recent = new Date(NOW.getTime() - 5 * 86_400_000);
    const seg = { segment: 'inactive_days' as const, segmentParam: 30 };
    expect(one(seg, undefined, { ...NO_USAGE, lastOrderAt: recent })).toBe('SEGMENT');
    expect(one(seg, undefined, { ...NO_USAGE, lastOrderAt: old })).toBe('OK');
    expect(one(seg)).toBe('OK');
    const me = uid(9001);
    expect(one({ segment: 'specific', customerIds: [me] })).toBe('OK');
    expect(one({ segment: 'specific', customerIds: [uid(1)] })).toBe('SEGMENT');
    expect(
      one({ segment: 'specific', customerIds: [me] }, ctx(l, { codes: ['E'], customerId: null })),
    ).toBe('LOGIN_REQUIRED');
    expect(
      one({ segment: 'specific', codeRow: { id: 'cc', assignedCustomerId: me, usedAt: null } }),
    ).toBe('OK');
  });
  it('bulk codes: used and assigned to someone else', () => {
    expect(one({ codeRow: { id: 'cc', assignedCustomerId: null, usedAt: NOW } })).toBe(
      'ALREADY_USED',
    );
    expect(one({ codeRow: { id: 'cc', assignedCustomerId: uid(1), usedAt: null } })).toBe(
      'SEGMENT',
    );
    expect(
      one(
        { codeRow: { id: 'cc', assignedCustomerId: uid(1), usedAt: null } },
        ctx(l, { codes: ['E'], customerId: null }),
      ),
    ).toBe('LOGIN_REQUIRED');
  });
  it('limits: total, per customer/phone/device, budget', () => {
    const idOf = (o: Partial<CouponRow>) => {
      const cand = code('E', { id: uid(77), ...o });
      return cand;
    };
    const usage = (c: number, p: number, d: number): PromoUsage => ({
      ...NO_USAGE,
      byCoupon: { [uid(77)]: { customer: c, phone: p, device: d } },
    });
    const go = (o: Partial<CouponRow>, u: PromoUsage = NO_USAGE) =>
      run([idOf(o)], ctx(l, { codes: ['E'] }), u).rejected[0]?.reason ?? 'OK';
    expect(go({ maxUsesTotal: 5, usesCount: 5 })).toBe('LIMIT_REACHED');
    expect(go({ maxUsesTotal: 5, usesCount: 4 })).toBe('OK');
    expect(go({ maxPerCustomer: 1 }, usage(1, 0, 0))).toBe('LIMIT_REACHED');
    expect(go({ maxPerCustomer: 2 }, usage(1, 0, 0))).toBe('OK');
    expect(go({ maxPerPhone: 1 }, usage(0, 1, 0))).toBe('LIMIT_REACHED');
    expect(go({ maxPerDevice: 1 }, usage(0, 0, 1))).toBe('LIMIT_REACHED');
    // 10% of 1000 = 100: budget 150 with 60 given -> 160 > 150
    expect(go({ budgetCapP: 150_00, discountGivenP: 60_00 })).toBe('BUDGET_REACHED');
    expect(go({ budgetCapP: 150_00, discountGivenP: 50_00 })).toBe('OK');
  });
  it('auto coupons that fail eligibility are silently skipped', () => {
    const r = run([coupon({ status: 'paused' }), coupon({ platform: 'app' })], ctx(l));
    expect(r.applied).toEqual([]);
    expect(r.rejected).toEqual([]);
  });
});

describe('stacking (C57)', () => {
  const l = [line({ unitPriceP: 1000_00 })];
  it('autos: highest priority first; non-stackable first blocks the rest', () => {
    const a = coupon({ value: 500, priority: 5 });
    const b = coupon({ value: 2000, priority: 1, stacksWithOtherCoupons: true });
    const r = run([a, b], ctx(l));
    expect(r.applied.map((d) => d.couponId)).toEqual([a.coupon.id]);
  });
  it('autos that all stack combine, ordered by priority then discount', () => {
    const a = coupon({ value: 500, stacksWithOtherCoupons: true });
    const b = coupon({ value: 2000, stacksWithOtherCoupons: true });
    const r = run([a, b], ctx(l));
    expect(r.applied.map((d) => d.couponId)).toEqual([b.coupon.id, a.coupon.id]);
    expect(r.autoDiscountP).toBe(200_00 + 40_00); // 20%, then 5% of the 800 left
  });
  it('code stacks after autos when both stack', () => {
    const a = coupon({ value: 1000, stacksWithOtherCoupons: true });
    const c = code('C', { value: 1000, stacksWithOtherCoupons: true });
    const r = run([a, c], ctx(l, { codes: ['C'] }));
    expect(r.autoDiscountP).toBe(100_00);
    expect(r.couponDiscountP).toBe(90_00);
  });
  it('non-stackable code replaces autos only when it is better', () => {
    const a = coupon({ value: 500, stacksWithOtherCoupons: true });
    const better = code('BIG', { value: 3000 });
    const r = run([a, better], ctx(l, { codes: ['BIG'] }));
    expect(r.applied.map((d) => d.kind)).toEqual(['code']);
    expect(r.couponDiscountP).toBe(300_00);
    expect(r.autoDiscountP).toBe(0);
    const worse = code('SMALL', { value: 200 });
    const r2 = run([a, worse], ctx(l, { codes: ['SMALL'] }));
    expect(r2.rejected).toEqual([{ code: 'SMALL', reason: 'NOT_STACKABLE' }]);
    expect(r2.autoDiscountP).toBe(50_00);
  });
  it('code with no autos always applies', () => {
    const c = code('ONLY', { value: 100 });
    expect(run([c], ctx(l, { codes: ['only'] })).couponDiscountP).toBe(10_00);
  });
  it('two codes need both to stack; a third is refused', () => {
    const a = code('A', { value: 1000, stacksWithOtherCoupons: true });
    const b = code('B', { value: 1000, stacksWithOtherCoupons: true });
    const c = code('C', { value: 1000, stacksWithOtherCoupons: true });
    const r = run([a, b, c], ctx(l, { codes: ['A', 'B', 'C'] }));
    expect(r.applied).toHaveLength(2);
    expect(r.rejected).toEqual([{ code: 'C', reason: 'NOT_STACKABLE' }]);
    const x = code('X', { value: 1000 });
    const r2 = run([a, x], ctx(l, { codes: ['A', 'X'] }));
    expect(r2.rejected).toEqual([{ code: 'X', reason: 'NOT_STACKABLE' }]);
    expect(r2.applied).toHaveLength(1);
  });
  it('the same code twice counts once', () => {
    const a = code('A', { value: 1000, stacksWithOtherCoupons: true });
    const r = run([a], ctx(l, { codes: ['A', 'a'] }));
    expect(r.applied).toHaveLength(1);
    expect(r.rejected).toEqual([]);
  });
  it('free-delivery code stacks with a percent auto', () => {
    const a = coupon({ value: 1000, stacksWithOtherCoupons: true });
    const f = code('FD', { type: 'free_delivery', stacksWithOtherCoupons: true });
    const r = run([a, f], ctx(l, { codes: ['FD'] }));
    expect(r.autoDiscountP).toBe(100_00);
    expect(r.deliveryDiscountP).toBe(60_00);
  });
  it('totals match line discounts', () => {
    const lines = [
      line({ n: 1, unitPriceP: 333_33, qty: 3 }),
      line({ n: 2, unitPriceP: 77_77, qty: 2 }),
    ];
    const a = coupon({ value: 1234, stacksWithOtherCoupons: true });
    const c = code('C', { type: 'fixed', value: 91_01, stacksWithOtherCoupons: true });
    const r = run([a, c], ctx(lines, { codes: ['C'] }));
    const sum = Object.values(r.lineDiscounts).reduce((s, x) => s + x, 0);
    expect(sum).toBe(r.autoDiscountP + r.couponDiscountP);
    for (const ln of lines)
      expect(r.lineDiscounts[ln.variantId]).toBeLessThanOrEqual(ln.unitPriceP * ln.qty);
  });
});
