import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { reversePromotions } from '../src/promotions/engine/redeem';
import { claimFlash } from '../src/promotions/flash/flash-core';
import { addToCart, makeProduct, places, signupCustomer } from './cart-fixtures';
import { createApp, createOwner } from './helpers';
import { makeCoupon, makeFlash, placeAs, resetPromos } from './promotions-engine-fixtures';

describe('checkout with promotions', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetPromos(app));
  afterAll(() => app.close());

  const guest = () => request.agent(app.getHttpServer());

  describe('quote and place', () => {
    it('prices auto + code + free delivery and stores the snapshot', async () => {
      const p = await places(app);
      const a = guest();
      // 2 x ৳1000, 500 g each => ৳60 + 1 started kg x ৳15 delivery, below the ৳3000 free threshold.
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const auto = await makeCoupon(app, {
        kind: 'auto',
        value: 1000,
        stacksWithOtherCoupons: true,
        name: 'Auto 10%',
      });
      const fixed = await makeCoupon(app, {
        code: 'TAKE100',
        type: 'fixed',
        value: 10_000,
        stacksWithOtherCoupons: true,
      });
      const ship = await makeCoupon(app, {
        code: 'SHIPFREE',
        type: 'free_delivery',
        stacksWithOtherCoupons: true,
      });
      await addToCart(a, variant.id, 2);
      await a.post('/v1/cart/coupon').send({ code: 'TAKE100' }).expect(200);
      await a.post('/v1/cart/coupon').send({ code: 'SHIPFREE' }).expect(200);

      const q = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      // delivery: ৳60 base + ceil((1000-?)...) is zone-defined; read it off the response.
      expect(q.deliveryChargeP).toBeGreaterThan(0);
      expect(q).toMatchObject({
        subtotalP: 200_000,
        autoDiscountP: 20_000,
        couponDiscountP: 10_000,
        deliveryDiscountP: q.deliveryChargeP,
        grandTotalP: 200_000 - 20_000 - 10_000,
        rejectedCodes: [],
      });
      expect(q.appliedCoupons.map((c: { couponId: string }) => c.couponId)).toEqual([
        auto.id,
        fixed.id,
        ship.id,
      ]);

      const res = await placeAs(app, a).then((r) => r);
      expect(res.status).toBe(200);
      expect(res.body.grandTotalP).toBe(170_000);
      const order = await prisma.order.findFirstOrThrow({
        include: { items: true },
      });
      expect(order).toMatchObject({
        subtotalP: 200_000,
        autoDiscountP: 20_000,
        couponDiscountP: 10_000,
        deliveryDiscountP: q.deliveryChargeP,
        grandTotalP: 170_000,
        codDueP: 170_000,
      });
      expect(order.items[0]?.discountP).toBe(30_000);
      expect(order.items[0]?.lineTotalP).toBe(200_000);
      expect(order.discountsJson).toEqual([
        {
          couponId: auto.id,
          name: 'Auto 10%',
          kind: 'auto',
          type: 'percent',
          code: null,
          amountP: 20_000,
          deliveryP: 0,
        },
        {
          couponId: fixed.id,
          name: fixed.name,
          kind: 'code',
          type: 'fixed',
          code: 'TAKE100',
          amountP: 10_000,
          deliveryP: 0,
        },
        {
          couponId: ship.id,
          name: ship.name,
          kind: 'code',
          type: 'free_delivery',
          code: 'SHIPFREE',
          amountP: 0,
          deliveryP: q.deliveryChargeP,
        },
      ]);
      const reds = await prisma.couponRedemption.findMany({ orderBy: { discountP: 'asc' } });
      expect(reds.map((r) => r.discountP)).toEqual(
        [q.deliveryChargeP, 10_000, 20_000].sort((x, y) => x - y),
      );
      expect(reds.every((r) => r.orderId === order.id && r.phone === '01811111111')).toBe(true);
      const after = await prisma.coupon.findUniqueOrThrow({ where: { id: fixed.id } });
      expect(after).toMatchObject({ usesCount: 1, discountGivenP: 10_000 });
      // The cart is empty again and so are its codes.
      expect((await a.get('/v1/cart')).body).toMatchObject({ items: [], codes: [] });
    });

    it('shows the discounts on the customer order and the admin order', async () => {
      const a = guest();
      const me = await signupCustomer(app, a);
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const c = await makeCoupon(app, { kind: 'auto', value: 2000, name: 'Twenty' });
      await addToCart(a, variant.id, 1);
      const placed = (await placeAs(app, a, { guestPhone: null }).then((r) => r)).body;
      const detail = (await a.get(`/v1/customer/orders/${placed.orderNo}`).expect(200)).body;
      expect(detail.discounts).toEqual([
        {
          couponId: c.id,
          name: 'Twenty',
          kind: 'auto',
          type: 'percent',
          code: null,
          amountP: 20_000,
          deliveryP: 0,
        },
      ]);
      expect(detail.items[0]).toMatchObject({ lineTotalP: 100_000, discountP: 20_000 });
      expect(detail.money).toMatchObject({ autoDiscountP: 20_000, couponDiscountP: 0 });
      const owner = await createOwner(app);
      const admin = (await owner.agent.get(`/v1/admin/orders/${placed.orderNo}`).expect(200)).body;
      expect(admin.discounts).toHaveLength(1);
      expect(admin.items[0]).toMatchObject({ discountP: 20_000, priceSource: 'base' });
      expect(me.id).toBeTruthy();
    });

    it('uses the discounted total for the guest OTP threshold', async () => {
      const p = await places(app);
      const a = guest();
      await makeCoupon(app, { kind: 'auto', value: 2000 });
      const { variant } = await makeProduct(app, { priceP: 600_000, stock: 5, weightG: 100 });
      await addToCart(a, variant.id);
      // ৳6000 + delivery - 20% = ৳4800 + delivery < ৳5000 OTP line
      const q = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      expect(q.grandTotalP).toBeLessThan(500_000);
      expect(q.guestOtpRequired).toBe(false);
      expect((await placeAs(app, a)).status).toBe(200);
    });

    it('refuses an order whose typed code stopped applying', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      const c = await makeCoupon(app, { code: 'LATE' });
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'LATE' }).expect(200);
      await prisma.coupon.update({
        where: { id: c.id },
        data: { endsAt: new Date(Date.now() - 1) },
      });
      const res = await placeAs(app, a);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'COUPON_INVALID',
        couponCode: 'LATE',
        reason: 'EXPIRED',
      });
      expect(await prisma.order.count()).toBe(0);
    });

    it('rejects a zone-limited code at quote time for another area', async () => {
      const p = await places(app);
      const zones = await prisma.deliveryZone.findMany();
      const inside = zones.find((z) => z.nameEn === 'Inside Dhaka');
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, { code: 'DHAKAONLY', zoneIds: [inside?.id as string] });
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'DHAKAONLY' }).expect(200);
      const ok = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      expect(ok.couponDiscountP).toBe(10_000);
      const far = (await a.post('/v1/checkout/quote').send(p.far).expect(200)).body;
      expect(far.couponDiscountP).toBe(0);
      expect(far.rejectedCodes).toEqual([{ code: 'DHAKAONLY', reason: 'ZONE' }]);
    });
  });

  describe('limits and redemption', () => {
    it('lets only one of two parallel orders use the last redemption', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const c = await makeCoupon(app, { code: 'LASTONE', maxUsesTotal: 1 });
      const [a, b] = [guest(), guest()];
      await addToCart(a, variant.id);
      await addToCart(b, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'LASTONE' }).expect(200);
      await b.post('/v1/cart/coupon').send({ code: 'LASTONE' }).expect(200);
      const [ra, rb] = await Promise.all([
        placeAs(app, a, { guestPhone: '01811111111' }),
        placeAs(app, b, { guestPhone: '01822222222' }),
      ]);
      const codes = [ra.status, rb.status].sort();
      expect(codes).toEqual([200, 409]);
      const loser = ra.status === 409 ? ra : rb;
      expect(['COUPON_LIMIT', 'COUPON_INVALID']).toContain(loser.body.code);
      expect(await prisma.order.count()).toBe(1);
      expect(await prisma.couponRedemption.count()).toBe(1);
      expect((await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).usesCount).toBe(1);
    });

    it('enforces per-customer and per-phone limits across orders', async () => {
      await makeCoupon(app, { code: 'ONCE', maxPerPhone: 1 });
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const a = guest();
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'ONCE' }).expect(200);
      expect((await placeAs(app, a)).status).toBe(200);
      // Same phone, fresh browser: the code no longer applies.
      const b = guest();
      await addToCart(b, variant.id);
      await b.post('/v1/cart/coupon').send({ code: 'ONCE' }).expect(200); // device and phone unknown yet
      const res = await placeAs(app, b);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'COUPON_INVALID',
        couponCode: 'ONCE',
        reason: 'LIMIT_REACHED',
      });
    });

    it('uses a bulk code once', async () => {
      const bulk = await makeCoupon(app, { isBulk: true, value: 1000 });
      const code = await prisma.couponCode.create({
        data: { couponId: bulk.id, code: 'BULK-0001' },
      });
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const a = guest();
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'bulk-0001' }).expect(200);
      expect((await placeAs(app, a)).status).toBe(200);
      expect(
        (await prisma.couponCode.findUniqueOrThrow({ where: { id: code.id } })).usedAt,
      ).not.toBeNull();
      const b = guest();
      await addToCart(b, variant.id);
      const again = await b.post('/v1/cart/coupon').send({ code: 'BULK-0001' }).expect(422);
      expect(again.body.reason).toBe('ALREADY_USED');
    });

    it('cancel reverses redemptions, bulk code and flash stock, and is idempotent', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const { item } = await makeFlash(app, variant.id, { flashPriceP: 60_000, qtyLimit: 5 });
      const bulk = await makeCoupon(app, {
        isBulk: true,
        value: 1000,
        stacksWithSalePrice: true,
        maxUsesTotal: 3,
        budgetCapP: 100_000,
      });
      const code = await prisma.couponCode.create({ data: { couponId: bulk.id, code: 'REV-1' } });
      await addToCart(a, variant.id, 2);
      await a.post('/v1/cart/coupon').send({ code: 'REV-1' }).expect(200);
      const placed = (await placeAs(app, a)).body;
      expect(placed.grandTotalP).toBeGreaterThan(0);
      let coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: bulk.id } });
      expect(coupon).toMatchObject({ usesCount: 1, discountGivenP: 12_000 });
      expect(
        (await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).qtySold,
      ).toBe(2);
      const items = await prisma.orderItem.findMany();
      expect(items[0]).toMatchObject({
        priceSource: 'flash',
        flashSaleItemId: item.id,
        discountP: 12_000,
      });

      const reverse = () => prisma.$transaction((tx) => reversePromotions(tx, placed.orderId));
      await reverse();
      await reverse();
      coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: bulk.id } });
      expect(coupon).toMatchObject({ usesCount: 0, discountGivenP: 0 });
      expect(
        (await prisma.couponCode.findUniqueOrThrow({ where: { id: code.id } })).usedAt,
      ).toBeNull();
      expect((await prisma.couponRedemption.findFirstOrThrow()).status).toBe('reversed');
      expect(
        (await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).qtySold,
      ).toBe(0);
      // The code works again.
      const b = guest();
      await addToCart(b, variant.id, 1);
      await b.post('/v1/cart/coupon').send({ code: 'REV-1' }).expect(200);
    });
  });

  describe('flash sales at checkout', () => {
    it('claims flash stock, snapshots the flash price and refuses to oversell', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      const { item } = await makeFlash(app, variant.id, { flashPriceP: 60_000, qtyLimit: 1 });
      const [a, b] = [guest(), guest()];
      await addToCart(a, variant.id, 1);
      await addToCart(b, variant.id, 1);
      const results = await Promise.all([
        placeAs(app, a, { guestPhone: '01811111111' }),
        placeAs(app, b, { guestPhone: '01822222222' }),
      ]);
      for (const r of results) expect([200, 409]).toContain(r.status);
      const sold = (await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } }))
        .qtySold;
      expect(sold).toBe(1);
      const flashLines = await prisma.orderItem.findMany({ where: { priceSource: 'flash' } });
      expect(flashLines).toHaveLength(1);
      expect(flashLines[0]).toMatchObject({
        unitPriceP: 60_000,
        unitBaseP: 100_000,
        flashSaleItemId: item.id,
      });
      // The other order either failed as sold out or was repriced to the normal price, never flash.
      for (const r of results.filter((x) => x.status === 409)) {
        expect(r.body.code).toBe('FLASH_SOLD_OUT');
      }
      const normal = await prisma.orderItem.findMany({ where: { priceSource: 'base' } });
      expect(normal.length + flashLines.length).toBe(await prisma.orderItem.count());
    });

    it('claimFlash refuses past the limit', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      const { item } = await makeFlash(app, variant.id, { flashPriceP: 60_000, qtyLimit: 3 });
      await prisma.$transaction((tx) => claimFlash(tx, [{ itemId: item.id, qty: 3 }]));
      await expect(
        prisma.$transaction((tx) => claimFlash(tx, [{ itemId: item.id, qty: 1 }])),
      ).rejects.toMatchObject({ response: { code: 'FLASH_SOLD_OUT' } });
    });

    it('enforces the personal flash limit against the guest phone at place', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 10 });
      await makeFlash(app, variant.id, { flashPriceP: 60_000, qtyLimit: 10, perCustomerLimit: 2 });
      const a = guest();
      await addToCart(a, variant.id, 1);
      expect((await placeAs(app, a, { guestPhone: '01811111111' })).status).toBe(200);
      // New browser, same phone: the cart allows 2 (device unknown), the order may only get 1 at flash price.
      const b = guest();
      await addToCart(b, variant.id, 2);
      const res = await placeAs(app, b, { guestPhone: '01811111111' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('FLASH_LIMIT');
      expect(res.body.variantIds).toEqual([variant.id]);
      expect(await prisma.order.count()).toBe(1);
    });
  });
});
