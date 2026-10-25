import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { PromotionsService } from '../src/promotions/engine/promotions.service';
import type { AppliedDiscount, PromoContext, PromoResult } from '../src/promotions/types';
import { addToCart, makeProduct } from './cart-fixtures';
import { createApp } from './helpers';
import { makeCoupon, placeAs, resetPromos } from './promotions-engine-fixtures';

const CUSTOMER_PHONE = '01811111111';

describe('PromotionsService (database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: PromotionsService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    svc = app.get(PromotionsService);
  });
  beforeEach(() => resetPromos(app));
  afterAll(() => app.close());

  const ctx = (o: Partial<PromoContext> = {}): PromoContext => ({
    lines: [
      {
        variantId: '00000000-0000-4000-8000-0000000000a1',
        productId: '00000000-0000-4000-8000-0000000000b1',
        brandId: null,
        categoryIds: [],
        qty: 1,
        unitPriceP: 100_000,
        priceSource: 'base',
      },
    ],
    zoneId: 'z',
    deliveryChargeP: 6000,
    customerId: null,
    phone: null,
    visitorId: 'visitor-1',
    platform: 'web',
    paymentMethod: 'cod',
    codes: [],
    now: new Date(),
    ...o,
  });

  const db = () => prisma;

  it('finds a coupon code case-insensitively and a bulk code by its own text', async () => {
    const plain = await makeCoupon(app, { code: 'SPRING', value: 1000 });
    const bulk = await makeCoupon(app, { isBulk: true, value: 2000 });
    await prisma.couponCode.create({ data: { couponId: bulk.id, code: 'BULKX1' } });
    const r = await svc.evaluate(db(), ctx({ codes: ['spring'] }));
    expect(r.applied.map((d) => d.couponId)).toEqual([plain.id]);
    const r2 = await svc.evaluate(db(), ctx({ codes: ['bulkx1'] }));
    expect(r2.applied[0]).toMatchObject({
      couponId: bulk.id,
      code: 'BULKX1',
      itemDiscountP: 20_000,
    });
    expect(r2.applied[0]?.couponCodeId).not.toBeNull();
    const none = await svc.evaluate(db(), ctx({ codes: ['nope'] }));
    expect(none.rejected).toEqual([{ code: 'NOPE', reason: 'NOT_FOUND' }]);
  });

  it('loads targets, zones and tiers', async () => {
    const productId = '00000000-0000-4000-8000-0000000000b1';
    await makeCoupon(app, {
      kind: 'auto',
      value: 1000,
      targets: [{ targetType: 'product', targetId: productId, mode: 'include' }],
    });
    await makeCoupon(app, {
      kind: 'auto',
      type: 'tiered',
      tiers: [
        { minSpendP: 50_000, discountP: 5_000 },
        { minSpendP: 90_000, discountP: 9_000 },
      ],
      stacksWithOtherCoupons: true,
    });
    const r = await svc.evaluate(db(), ctx());
    expect(r.autoDiscountP).toBe(10_000);
    const other = await svc.evaluate(
      db(),
      ctx({
        lines: [{ ...ctx().lines[0], productId: '00000000-0000-4000-8000-0000000000b2' } as never],
      }),
    );
    expect(other.autoDiscountP).toBe(9_000);
  });

  it('ignores inactive autos and autos outside their window', async () => {
    await makeCoupon(app, { kind: 'auto', status: 'paused' });
    await makeCoupon(app, { kind: 'auto', endsAt: new Date(Date.now() - 1000) });
    await makeCoupon(app, { kind: 'auto', startsAt: new Date(Date.now() + 60_000) });
    const r = await svc.evaluate(db(), ctx());
    expect(r.applied).toEqual([]);
  });

  describe('usage and segments', () => {
    async function orderFor(phone: string) {
      const { variant } = await makeProduct(app, { priceP: 10_000, stock: 50 });
      const a = request.agent(app.getHttpServer());
      await addToCart(a, variant.id, 1);
      const res = await placeAs(app, a, { guestPhone: phone });
      expect(res.status).toBe(200);
      return prisma.order.findFirstOrThrow({ where: { orderNo: res.body.orderNo } });
    }

    it('counts only applied redemptions towards per-phone limits', async () => {
      const c = await makeCoupon(app, { code: 'ONEPHONE', maxPerPhone: 1 });
      const order = await orderFor(CUSTOMER_PHONE);
      const red = await prisma.couponRedemption.create({
        data: { couponId: c.id, orderId: order.id, phone: CUSTOMER_PHONE, discountP: 100 },
      });
      const blocked = await svc.evaluate(db(), ctx({ phone: CUSTOMER_PHONE, codes: ['ONEPHONE'] }));
      expect(blocked.rejected[0]?.reason).toBe('LIMIT_REACHED');
      await prisma.couponRedemption.update({
        where: { id: red.id },
        data: { status: 'reversed', reversedAt: new Date() },
      });
      const ok = await svc.evaluate(db(), ctx({ phone: CUSTOMER_PHONE, codes: ['ONEPHONE'] }));
      expect(ok.rejected).toEqual([]);
      expect(ok.applied).toHaveLength(1);
    });

    it('first_order segment looks at non-cancelled orders of that phone', async () => {
      await makeCoupon(app, { code: 'WELCOME', segment: 'first_order' });
      const fresh = await svc.evaluate(db(), ctx({ phone: CUSTOMER_PHONE, codes: ['WELCOME'] }));
      expect(fresh.applied).toHaveLength(1);
      const order = await orderFor(CUSTOMER_PHONE);
      const seen = await svc.evaluate(db(), ctx({ phone: CUSTOMER_PHONE, codes: ['WELCOME'] }));
      expect(seen.rejected[0]?.reason).toBe('SEGMENT');
      await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
      const again = await svc.evaluate(db(), ctx({ phone: CUSTOMER_PHONE, codes: ['WELCOME'] }));
      expect(again.applied).toHaveLength(1);
    });

    it('inactive_days segment', async () => {
      await makeCoupon(app, { code: 'COMEBACK', segment: 'inactive_days', segmentParam: 30 });
      await orderFor(CUSTOMER_PHONE);
      const r = await svc.evaluate(db(), ctx({ phone: CUSTOMER_PHONE, codes: ['COMEBACK'] }));
      expect(r.rejected[0]?.reason).toBe('SEGMENT');
      const later = await svc.evaluate(
        db(),
        ctx({
          phone: CUSTOMER_PHONE,
          codes: ['COMEBACK'],
          now: new Date(Date.now() + 40 * 86_400_000),
        }),
      );
      expect(later.applied).toHaveLength(1);
    });

    it('specific segment: audience list and guests asked to log in', async () => {
      const customer = await prisma.customer.create({
        data: { name: 'Vip', phone: '01899999999', passwordHash: 'x', phoneVerifiedAt: new Date() },
      });
      await makeCoupon(app, { code: 'VIPONLY', segment: 'specific', customerIds: [customer.id] });
      expect((await svc.evaluate(db(), ctx({ codes: ['VIPONLY'] }))).rejected[0]?.reason).toBe(
        'LOGIN_REQUIRED',
      );
      expect(
        (await svc.evaluate(db(), ctx({ customerId: customer.id, codes: ['VIPONLY'] }))).applied,
      ).toHaveLength(1);
    });
  });

  describe('redeem and reverse', () => {
    const applied = (
      couponId: string,
      amount: number,
      couponCodeId: string | null = null,
    ): PromoResult => {
      const d: AppliedDiscount = {
        couponId,
        name: 'x',
        kind: 'code',
        type: 'fixed',
        code: 'X',
        couponCodeId,
        itemDiscountP: amount,
        deliveryDiscountP: 0,
        lineAllocations: [],
      };
      return {
        applied: [d],
        autoDiscountP: 0,
        couponDiscountP: amount,
        deliveryDiscountP: 0,
        lineDiscounts: {},
        rejected: [],
      };
    };

    async function anOrder() {
      const { variant } = await makeProduct(app, { priceP: 10_000, stock: 50 });
      const a = request.agent(app.getHttpServer());
      await addToCart(a, variant.id, 1);
      const res = await placeAs(app, a);
      return prisma.order.findFirstOrThrow({ where: { orderNo: res.body.orderNo } });
    }

    it('books a redemption and bumps the counters', async () => {
      const c = await makeCoupon(app, { type: 'fixed', value: 500, maxUsesTotal: 5 });
      const order = await anOrder();
      await prisma.$transaction((tx) =>
        svc.redeem(tx, order.id, ctx({ phone: CUSTOMER_PHONE }), applied(c.id, 500)),
      );
      expect(await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
        usesCount: 1,
        discountGivenP: 500,
      });
      expect(await prisma.couponRedemption.findFirstOrThrow()).toMatchObject({
        couponId: c.id,
        orderId: order.id,
        phone: CUSTOMER_PHONE,
        visitorId: 'visitor-1',
        discountP: 500,
        status: 'applied',
      });
    });

    it('refuses with COUPON_LIMIT when the limit, budget or bulk code was taken meanwhile', async () => {
      const order = await anOrder();
      const total = await makeCoupon(app, { maxUsesTotal: 1, usesCount: 1 });
      const budget = await makeCoupon(app, { budgetCapP: 1000, discountGivenP: 800 });
      const bulk = await makeCoupon(app, { isBulk: true });
      const used = await prisma.couponCode.create({
        data: { couponId: bulk.id, code: 'USED1', usedAt: new Date() },
      });
      const run = (r: PromoResult) =>
        prisma.$transaction((tx) => svc.redeem(tx, order.id, ctx(), r));
      for (const r of [
        applied(total.id, 100),
        applied(budget.id, 300),
        applied(bulk.id, 100, used.id),
      ]) {
        await expect(run(r)).rejects.toMatchObject({
          status: 409,
          response: { code: 'COUPON_LIMIT' },
        });
      }
      expect(await prisma.couponRedemption.count()).toBe(0);
    });

    it('reverse restores counters once, even if called twice', async () => {
      const c = await makeCoupon(app, { type: 'fixed', value: 500 });
      const order = await anOrder();
      await prisma.$transaction((tx) => svc.redeem(tx, order.id, ctx(), applied(c.id, 500)));
      await prisma.$transaction((tx) => svc.reverse(tx, order.id));
      await prisma.$transaction((tx) => svc.reverse(tx, order.id));
      expect(await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
        usesCount: 0,
        discountGivenP: 0,
      });
      expect((await prisma.couponRedemption.findFirstOrThrow()).status).toBe('reversed');
    });
  });
});
