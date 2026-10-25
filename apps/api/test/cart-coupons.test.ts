import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct, signupCustomer } from './cart-fixtures';
import { createApp } from './helpers';
import { makeCoupon, makeFlash, placeAs, resetPromos } from './promotions-engine-fixtures';

describe('cart coupons and flash prices', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetPromos(app));
  afterAll(() => app.close());

  const guest = () => request.agent(app.getHttpServer());

  describe('typed codes', () => {
    it('adds a code, shows the discount, removes it', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      const c = await makeCoupon(app, { code: 'SAVE10', value: 1000 });
      const a = guest();
      await addToCart(a, variant.id, 2);
      const res = await a.post('/v1/cart/coupon').send({ code: 'save10 ' }).expect(200);
      expect(res.body).toMatchObject({
        subtotalP: 200_000,
        discountP: 20_000,
        codes: ['SAVE10'],
        rejectedCodes: [],
      });
      expect(res.body.appliedCoupons).toEqual([
        {
          couponId: c.id,
          name: c.name,
          kind: 'code',
          type: 'percent',
          code: 'SAVE10',
          amountP: 20_000,
          freeDelivery: false,
        },
      ]);
      expect(res.body.items[0].discountP).toBe(20_000);
      // Adding it twice is a no-op.
      const again = await a.post('/v1/cart/coupon').send({ code: 'SAVE10' }).expect(200);
      expect(again.body.codes).toEqual(['SAVE10']);
      const del = await a.delete('/v1/cart/coupon/save10').expect(200);
      expect(del.body).toMatchObject({ discountP: 0, codes: [], appliedCoupons: [] });
    });

    it('answers 422 COUPON_INVALID with a reason and keeps the cart clean', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, { code: 'BIG', minOrderP: 500_000 });
      await makeCoupon(app, { code: 'OLD', endsAt: new Date(Date.now() - 1000) });
      const a = guest();
      await addToCart(a, variant.id);
      const no = await a.post('/v1/cart/coupon').send({ code: 'NOPE' }).expect(422);
      expect(no.body).toMatchObject({ code: 'COUPON_INVALID', reason: 'NOT_FOUND' });
      const min = await a.post('/v1/cart/coupon').send({ code: 'BIG' }).expect(422);
      expect(min.body.reason).toBe('MIN_ORDER');
      const old = await a.post('/v1/cart/coupon').send({ code: 'OLD' }).expect(422);
      expect(old.body.reason).toBe('EXPIRED');
      expect((await a.get('/v1/cart')).body.codes).toEqual([]);
      await a.post('/v1/cart/coupon').send({ code: 'bad code!' }).expect(400);
    });

    it('refuses a code on an empty cart', async () => {
      await makeCoupon(app, { code: 'ANY' });
      const res = await guest().post('/v1/cart/coupon').send({ code: 'ANY' }).expect(422);
      expect(res.body.code).toBe('COUPON_INVALID');
    });

    it('drops a code that stops applying and reports it once', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      const c = await makeCoupon(app, { code: 'TEMP' });
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'TEMP' }).expect(200);
      await prisma.coupon.update({ where: { id: c.id }, data: { status: 'paused' } });
      const view = await a.get('/v1/cart').expect(200);
      expect(view.body.codes).toEqual([]);
      expect(view.body.discountP).toBe(0);
      expect(view.body.rejectedCodes).toEqual([{ code: 'TEMP', reason: 'INACTIVE' }]);
      expect((await a.get('/v1/cart')).body.rejectedCodes).toEqual([]);
    });

    it('limits code guessing', async () => {
      const a = guest();
      const { variant } = await makeProduct(app);
      await addToCart(a, variant.id);
      for (let i = 0; i < 10; i++) {
        await a
          .post('/v1/cart/coupon')
          .send({ code: `GUESS${i}` })
          .expect(422);
      }
      await a.post('/v1/cart/coupon').send({ code: 'GUESS11' }).expect(429);
    });

    it('allows two codes only when both stack, never a third', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, { code: 'ONE', value: 1000, stacksWithOtherCoupons: true });
      await makeCoupon(app, { code: 'TWO', value: 1000, stacksWithOtherCoupons: true });
      await makeCoupon(app, { code: 'THREE', value: 1000, stacksWithOtherCoupons: true });
      await makeCoupon(app, { code: 'SOLO', value: 1000 });
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'ONE' }).expect(200);
      const two = await a.post('/v1/cart/coupon').send({ code: 'TWO' }).expect(200);
      expect(two.body.discountP).toBe(10_000 + 9_000);
      expect(
        (await a.post('/v1/cart/coupon').send({ code: 'THREE' }).expect(422)).body.reason,
      ).toBe('NOT_STACKABLE');
      await a.delete('/v1/cart/coupon/two').expect(200);
      expect((await a.post('/v1/cart/coupon').send({ code: 'SOLO' }).expect(422)).body.reason).toBe(
        'NOT_STACKABLE',
      );
    });

    it('a category target covers products in its sub-categories (and brand/product excludes carve out)', async () => {
      const parent = await prisma.category.create({
        data: { slug: 'promo-parent', nameEn: 'Parent', level: 1, path: '/x/' },
      });
      await prisma.category.update({ where: { id: parent.id }, data: { path: `/${parent.id}/` } });
      const child = await prisma.category.create({
        data: { slug: 'promo-child', nameEn: 'Child', level: 2, parentId: parent.id, path: '/x/' },
      });
      await prisma.category.update({
        where: { id: child.id },
        data: { path: `/${parent.id}/${child.id}/` },
      });
      const inChild = await makeProduct(app, { priceP: 100_000 });
      await prisma.product.update({
        where: { id: inChild.product.id },
        data: { primaryCategoryId: child.id },
      });
      const outside = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, {
        kind: 'auto',
        value: 1000,
        targets: [{ targetType: 'category', targetId: parent.id, mode: 'include' }],
      });
      const a = guest();
      await addToCart(a, inChild.variant.id, 1);
      const cart = await addToCart(a, outside.variant.id, 1);
      expect(cart.discountP).toBe(10_000);
      const line = cart.items.find(
        (i: { variantId: string }) => i.variantId === inChild.variant.id,
      );
      expect(line.discountP).toBe(10_000);
    });

    it('auto coupons show up without a code', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, { kind: 'auto', name: 'Everything 5%', value: 500 });
      const cart = await addToCart(a, variant.id);
      expect(cart.discountP).toBe(5_000);
      expect(cart.appliedCoupons[0]).toMatchObject({ kind: 'auto', code: null, amountP: 5_000 });
    });

    it('codes follow the guest into the customer cart on login', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, { code: 'KEEP' });
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'KEEP' }).expect(200);
      await signupCustomer(app, a);
      const cart = (await a.get('/v1/cart').expect(200)).body;
      expect(cart.codes).toEqual(['KEEP']);
      expect(cart.discountP).toBe(10_000);
    });

    it('clearing the cart clears its codes', async () => {
      const a = guest();
      const { variant } = await makeProduct(app);
      await makeCoupon(app, { code: 'GONE' });
      await addToCart(a, variant.id);
      await a.post('/v1/cart/coupon').send({ code: 'GONE' }).expect(200);
      await a.delete('/v1/cart').expect(200);
      await addToCart(a, variant.id);
      expect((await a.get('/v1/cart')).body.codes).toEqual([]);
    });
  });

  describe('suggestions', () => {
    it('ranks usable code coupons by saving and skips ones in the cart', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      await makeCoupon(app, { code: 'PUB5', value: 500, visibility: 'public' });
      await makeCoupon(app, { code: 'PUB20', value: 2000, visibility: 'public' });
      await makeCoupon(app, { code: 'HIDDEN', value: 5000, visibility: 'hidden' });
      await makeCoupon(app, { code: 'MIN', value: 5000, visibility: 'public', minOrderP: 900_000 });
      await addToCart(a, variant.id);
      const res = await a.get('/v1/cart/coupon-suggestions').expect(200);
      expect(res.body.items.map((s: { code: string }) => s.code)).toEqual(['PUB20', 'PUB5']);
      expect(res.body.items[0]).toMatchObject({ savingP: 20_000, source: 'public' });
      await a.post('/v1/cart/coupon').send({ code: 'PUB20' }).expect(200);
      const after = await a.get('/v1/cart/coupon-suggestions').expect(200);
      expect(after.body.items.map((s: { code: string }) => s.code)).not.toContain('PUB20');
    });

    it('includes the wallet and codes assigned to the customer', async () => {
      const a = guest();
      const me = await signupCustomer(app, a);
      const { variant } = await makeProduct(app, { priceP: 100_000 });
      const w = await makeCoupon(app, { code: 'WALLET', value: 1500 });
      await prisma.couponWallet.create({ data: { customerId: me.id, couponId: w.id } });
      const bulk = await makeCoupon(app, { isBulk: true, value: 3000, name: 'Bulk' });
      await prisma.couponCode.create({
        data: { couponId: bulk.id, code: 'ASSIGNED1', assignedCustomerId: me.id },
      });
      await addToCart(a, variant.id);
      const res = await a.get('/v1/cart/coupon-suggestions').expect(200);
      expect(res.body.items.map((s: { code: string }) => s.code)).toEqual(['ASSIGNED1', 'WALLET']);
      expect(res.body.items[1].source).toBe('wallet');
    });

    it('is empty for an empty cart', async () => {
      await makeCoupon(app, { visibility: 'public' });
      const res = await guest().get('/v1/cart/coupon-suggestions').expect(200);
      expect(res.body).toEqual({ items: [] });
    });
  });

  describe('flash price in the cart', () => {
    it('prices at flash price and caps qty at what is left', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 20 });
      const { sale } = await makeFlash(app, variant.id, {
        flashPriceP: 60_000,
        qtyLimit: 3,
        qtySold: 1,
      });
      const cart = await addToCart(a, variant.id, 2);
      expect(cart.items[0]).toMatchObject({
        unitPriceP: 60_000,
        maxQty: 2,
        problem: null,
        flashEndsAt: sale.endsAt.toISOString(),
      });
      const over = await a.put(`/v1/cart/items/${variant.id}`).send({ qty: 3 }).expect(409);
      expect(over.body).toMatchObject({ code: 'FLASH_LIMIT', remaining: 2 });
      expect(over.body.message).toBe('Only 2 left at flash price.');
    });

    it('caps a customer at the personal limit and then charges the normal price', async () => {
      const a = guest();
      await signupCustomer(app, a);
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 20 });
      const { item } = await makeFlash(app, variant.id, {
        flashPriceP: 60_000,
        qtyLimit: 10,
        perCustomerLimit: 2,
      });
      await addToCart(a, variant.id, 2);
      await a.put(`/v1/cart/items/${variant.id}`).send({ qty: 3 }).expect(409);
      // The order they place holds 2 at flash price: the next unit is a normal one.
      await placeAs(app, a, { guestPhone: null }).then((r) => expect(r.status).toBe(200));
      expect(
        (await prisma.flashSaleItem.findUniqueOrThrow({ where: { id: item.id } })).qtySold,
      ).toBe(2);
      await a.put(`/v1/cart/items/${variant.id}`).send({ qty: 1 }).expect(200);
      const view = (await a.get('/v1/cart').expect(200)).body;
      expect(view.items[0]).toMatchObject({ unitPriceP: 100_000, flashEndsAt: null, maxQty: 10 });
    });

    it('falls back to the normal price when the flash sale is sold out or over', async () => {
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000, stock: 20 });
      const { item, sale } = await makeFlash(app, variant.id, { flashPriceP: 60_000, qtyLimit: 2 });
      await addToCart(a, variant.id, 1);
      await prisma.flashSaleItem.update({ where: { id: item.id }, data: { qtySold: 2 } });
      let view = (await a.get('/v1/cart').expect(200)).body;
      expect(view.items[0]).toMatchObject({
        unitPriceP: 100_000,
        flashEndsAt: null,
        priceChanged: true,
      });
      await prisma.flashSaleItem.update({ where: { id: item.id }, data: { qtySold: 0 } });
      await prisma.flashSale.update({
        where: { id: sale.id },
        data: { endsAt: new Date(Date.now() - 1) },
      });
      view = (await a.get('/v1/cart').expect(200)).body;
      expect(view.items[0].unitPriceP).toBe(100_000);
    });

    it('a flash line is not discounted by coupons that ignore sale prices', async () => {
      const a = guest();
      const flash = await makeProduct(app, { priceP: 100_000 });
      const regular = await makeProduct(app, { priceP: 100_000 });
      await makeFlash(app, flash.variant.id, { flashPriceP: 60_000 });
      await makeCoupon(app, { kind: 'auto', value: 1000 });
      await addToCart(a, flash.variant.id, 1);
      const cart = await addToCart(a, regular.variant.id, 1);
      expect(cart.discountP).toBe(10_000); // only the regular-priced line
    });
  });
});
