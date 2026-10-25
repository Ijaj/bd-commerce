import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct, PASSWORD, resetCommerce, signupCustomer } from './cart-fixtures';
import { createApp } from './helpers';

const EMPTY = {
  items: [],
  count: 0,
  subtotalP: 0,
  discountP: 0,
  appliedCoupons: [],
  codes: [],
  rejectedCodes: [],
};

describe('cart', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetCommerce(app));
  afterAll(() => app.close());

  const guest = () => request.agent(app.getHttpServer());

  it('hands a browser a bdc_vid cookie and starts with an empty cart', async () => {
    const a = guest();
    const res = await a.get('/v1/cart').expect(200);
    expect(res.body).toEqual(EMPTY);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^bdc_vid=[0-9a-f-]{36}/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Max-Age=31536000/);
    // The same cookie is not reissued, and no cart row exists until something is added.
    const again = await a.get('/v1/cart').expect(200);
    expect(again.headers['set-cookie']).toBeUndefined();
    expect(await prisma.cart.count()).toBe(0);
  });

  it('adds, updates, and removes lines with full line data', async () => {
    const { product, variant } = await makeProduct(app, { priceP: 120_000, stock: 5 });
    const a = guest();
    const cart = await addToCart(a, variant.id, 2);
    expect(cart).toMatchObject({ count: 2, subtotalP: 240_000 });
    expect(cart.items[0]).toMatchObject({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      qty: 2,
      unitPriceP: 120_000,
      priceAtAddP: 120_000,
      priceChanged: false,
      available: 5,
      maxQty: 5,
      problem: null,
      image: null,
    });
    const upd = await a.put(`/v1/cart/items/${variant.id}`).send({ qty: 3 }).expect(200);
    expect(upd.body.items).toHaveLength(1);
    expect(upd.body.count).toBe(3);
    const del = await a.delete(`/v1/cart/items/${variant.id}`).expect(200);
    expect(del.body.items).toEqual([]);
    await addToCart(a, variant.id, 1);
    await a.put(`/v1/cart/items/${variant.id}`).send({ qty: 0 }).expect(200, EMPTY);
    await addToCart(a, variant.id, 1);
    await a.delete('/v1/cart').expect(200, EMPTY);
  });

  it('clamps qty to stock and checkout.maxQtyPerLine', async () => {
    const few = await makeProduct(app, { stock: 3 });
    const many = await makeProduct(app, { stock: 500 });
    const a = guest();
    expect((await addToCart(a, few.variant.id, 9)).items[0].qty).toBe(3);
    const cart = await addToCart(a, many.variant.id, 99);
    expect(cart.items.find((i: { variantId: string }) => i.variantId === many.variant.id).qty).toBe(
      10,
    );
  });

  it('refuses unavailable, upcoming and out-of-stock items', async () => {
    const draft = await makeProduct(app, { status: 'draft' });
    const upcoming = await makeProduct(app, { isUpcoming: true });
    const gone = await makeProduct(app, { stock: 0 });
    const a = guest();
    const r1 = await a.put(`/v1/cart/items/${draft.variant.id}`).send({ qty: 1 }).expect(404);
    expect(r1.body.code).toBe('VARIANT_NOT_FOUND');
    const r2 = await a.put(`/v1/cart/items/${upcoming.variant.id}`).send({ qty: 1 }).expect(409);
    expect(r2.body.code).toBe('UPCOMING');
    const r3 = await a.put(`/v1/cart/items/${gone.variant.id}`).send({ qty: 1 }).expect(409);
    expect(r3.body.code).toBe('OUT_OF_STOCK');
    await a.put('/v1/cart/items/not-a-uuid').send({ qty: 1 }).expect(400);
    await a.put(`/v1/cart/items/${gone.variant.id}`).send({ qty: -1 }).expect(400);
  });

  it('flags lines whose stock or availability changed after adding', async () => {
    const p1 = await makeProduct(app, { stock: 5 });
    const p2 = await makeProduct(app, { stock: 5 });
    const p3 = await makeProduct(app, { stock: 5 });
    const a = guest();
    await addToCart(a, p1.variant.id, 4);
    await addToCart(a, p2.variant.id, 2);
    await addToCart(a, p3.variant.id, 2);
    await prisma.inventory.update({ where: { variantId: p1.variant.id }, data: { onHand: 2 } });
    await prisma.inventory.update({ where: { variantId: p2.variant.id }, data: { onHand: 0 } });
    await prisma.product.update({ where: { id: p3.product.id }, data: { status: 'archived' } });
    const res = await a.get('/v1/cart').expect(200);
    const by = (id: string) =>
      res.body.items.find((i: { variantId: string }) => i.variantId === id);
    expect(by(p1.variant.id)).toMatchObject({
      problem: 'qty_reduced',
      qty: 4,
      maxQty: 2,
      available: 2,
    });
    expect(by(p2.variant.id)).toMatchObject({ problem: 'out_of_stock', maxQty: 0 });
    expect(by(p3.variant.id)).toMatchObject({ problem: 'unavailable' });
    // Problem lines are not charged.
    expect(res.body.subtotalP).toBe(0);
    expect(res.body.count).toBe(8);
  });

  it('shows price changes and uses the live sale price', async () => {
    const { variant } = await makeProduct(app, { priceP: 100_000 });
    const a = guest();
    await addToCart(a, variant.id, 1);
    await prisma.variant.update({
      where: { id: variant.id },
      data: {
        salePriceP: 80_000,
        saleStartsAt: new Date(Date.now() - 1000),
        saleEndsAt: new Date(Date.now() + 60_000),
      },
    });
    const res = await a.get('/v1/cart').expect(200);
    expect(res.body.items[0]).toMatchObject({
      unitPriceP: 80_000,
      compareAtP: 100_000,
      priceAtAddP: 100_000,
      priceChanged: true,
    });
    expect(res.body.subtotalP).toBe(80_000);
    // Touching the line resets the "changed" marker.
    const upd = await a.put(`/v1/cart/items/${variant.id}`).send({ qty: 2 }).expect(200);
    expect(upd.body.items[0].priceChanged).toBe(false);
  });

  it('keeps separate carts per visitor', async () => {
    const { variant } = await makeProduct(app);
    const a = guest();
    const b = guest();
    await addToCart(a, variant.id, 1);
    expect((await b.get('/v1/cart')).body.count).toBe(0);
  });

  it('merges the guest cart into the customer cart on login, summing and capping', async () => {
    const p1 = await makeProduct(app, { stock: 50 });
    const p2 = await makeProduct(app, { stock: 50 });
    const first = guest();
    const customer = await signupCustomer(app, first);
    await addToCart(first, p1.variant.id, 4);
    await addToCart(first, p2.variant.id, 1);
    await first.post('/v1/customer/auth/logout').expect(200);

    const browser = guest();
    await addToCart(browser, p1.variant.id, 8);
    expect((await browser.get('/v1/cart')).body.count).toBe(8);
    await browser
      .post('/v1/customer/auth/login')
      .send({ login: '01712345678', password: PASSWORD })
      .expect(200);
    const merged = (await browser.get('/v1/cart').expect(200)).body;
    const qty = (id: string) =>
      merged.items.find((i: { variantId: string }) => i.variantId === id).qty;
    expect(qty(p1.variant.id)).toBe(10); // 4 + 8 capped at maxQtyPerLine
    expect(qty(p2.variant.id)).toBe(1);

    // The guest cart is spent: another anonymous visit with the same visitor id starts empty.
    const spent = await prisma.cart.findFirst({
      where: { customerId: null, mergedIntoId: { not: null } },
    });
    expect(spent).not.toBeNull();
    expect(await prisma.cartItem.count({ where: { cartId: spent?.id } })).toBe(0);
    expect(await prisma.cart.count({ where: { customerId: customer.id } })).toBe(1);

    // A logged-in session wins over the visitor cookie.
    await browser.post('/v1/customer/auth/logout').expect(200);
    expect((await browser.get('/v1/cart')).body.count).toBe(0);
  });

  it('merges the guest cart at signup', async () => {
    const { variant } = await makeProduct(app);
    const a = guest();
    await addToCart(a, variant.id, 2);
    await signupCustomer(app, a);
    expect((await a.get('/v1/cart')).body.count).toBe(2);
  });
});
