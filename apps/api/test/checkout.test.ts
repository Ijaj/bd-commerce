import type { INestApplication } from '@nestjs/common';
import type Redis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS } from '../src/redis/redis.module';
import { SmsService } from '../src/sms/sms.service';
import {
  addToCart,
  lastOtp,
  makeProduct,
  PASSWORD,
  places,
  resetCommerce,
  signupCustomer,
} from './cart-fixtures';
import { createApp, createOwner } from './helpers';

type Agent = ReturnType<typeof request.agent>;

describe('checkout', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;
  let mail: MailService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    sms = app.get(SmsService);
    mail = app.get(MailService);
  });
  beforeEach(async () => {
    await resetCommerce(app);
    mail.outbox.length = 0;
  });
  afterAll(() => app.close());

  const guest = () => request.agent(app.getHttpServer());
  let n = 0;
  const key = () => `idem-key-${Date.now()}-${n++}`;

  async function address(overrides: Record<string, unknown> = {}) {
    const p = await places(app);
    return {
      name: 'Karim',
      phone: '01811111111',
      ...p.dhaka,
      line: 'House 1, Road 2',
      landmark: 'Near the mosque',
      ...overrides,
    };
  }

  async function placeGuest(a: Agent, body: Record<string, unknown> = {}) {
    return a.post('/v1/checkout/place').send({
      address: await address(),
      guest: { name: 'Karim', phone: '01811111111', email: 'Karim@Example.com' },
      lang: 'en',
      idempotencyKey: key(),
      ...body,
    });
  }

  const setCheckout = async (agent: Agent, value: object) =>
    agent.put('/v1/admin/settings/checkout').send({ value }).expect(204);

  describe('quote', () => {
    it('prices by zone, weight and the free-delivery threshold', async () => {
      const p = await places(app);
      const a = guest();
      const { variant } = await makeProduct(app, { priceP: 100_000, weightG: 1500 });
      await addToCart(a, variant.id, 2); // 3 kg, ৳2000
      const inside = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      // ৳60 + 2 started kg × ৳15
      expect(inside).toMatchObject({
        subtotalP: 200_000,
        deliveryChargeP: 9000,
        deliveryDiscountP: 0,
        grandTotalP: 209_000,
        freeDeliveryRemainingP: 100_000,
        guestOtpRequired: false,
        problems: [],
        zone: { nameEn: 'Inside Dhaka', etaMinDays: 1, etaMaxDays: 2 },
      });
      await addToCart(a, variant.id, 3);
      const free = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      expect(free).toMatchObject({
        subtotalP: 300_000,
        deliveryChargeP: 12_000,
        deliveryDiscountP: 12_000,
        grandTotalP: 300_000,
      });
      expect(free.freeDeliveryRemainingP).toBeNull();
      // The free threshold is Inside Dhaka only.
      const far = (await a.post('/v1/checkout/quote').send(p.far).expect(200)).body;
      expect(far.deliveryDiscountP).toBe(0);
      expect(far.zone.nameEn).toBe('Outside Dhaka');
    });

    it('lets a product override raise the single order charge, never stack', async () => {
      const p = await places(app);
      const a = guest();
      const big = await makeProduct(app, { priceP: 10_000, weightG: 100, overrideP: 25_000 });
      const big2 = await makeProduct(app, { priceP: 10_000, weightG: 100, overrideP: 20_000 });
      await addToCart(a, big.variant.id);
      await addToCart(a, big2.variant.id);
      const q = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      expect(q.deliveryChargeP).toBe(25_000);
    });

    it('reports empty or broken carts and the OTP requirement', async () => {
      const p = await places(app);
      const a = guest();
      expect((await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body.problems).toEqual([
        'CART_EMPTY',
      ]);
      const { variant } = await makeProduct(app, { priceP: 600_000, stock: 5 });
      await addToCart(a, variant.id);
      const q = (await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body;
      expect(q.guestOtpRequired).toBe(true); // ≥ ৳5000
      await prisma.inventory.update({ where: { variantId: variant.id }, data: { onHand: 0 } });
      expect((await a.post('/v1/checkout/quote').send(p.dhaka).expect(200)).body.problems).toEqual([
        'OUT_OF_STOCK',
      ]);
    });

    it('rejects locations that do not belong together', async () => {
      const p = await places(app);
      const a = guest();
      const bad = await a
        .post('/v1/checkout/quote')
        .send({ districtId: p.far.districtId, upazilaId: p.dhaka.upazilaId })
        .expect(400);
      expect(bad.body.code).toBe('ADDRESS_INVALID');
    });
  });

  describe('place as guest', () => {
    it('creates the order, reserves stock, clears the cart and notifies', async () => {
      const { product, variant } = await makeProduct(app, {
        priceP: 100_000,
        stock: 5,
        weightG: 400,
      });
      const a = guest();
      await addToCart(a, variant.id, 2);
      const res = await placeGuest(a, { note: 'Call before coming' }).then((r) => {
        expect(r.status).toBe(200);
        return r.body;
      });
      expect(res).toMatchObject({
        orderNo: expect.stringMatching(/^\d{4}-\d{5}$/),
        grandTotalP: 206_000,
        codDueP: 206_000,
      });

      const order = await prisma.order.findUniqueOrThrow({
        where: { orderNo: res.orderNo },
        include: { items: true, history: true, payments: true },
      });
      expect(order).toMatchObject({
        status: 'processing',
        paymentStatus: 'unpaid',
        paymentMethodChosen: 'cod',
        customerId: null,
        guestName: 'Karim',
        guestPhone: '01811111111',
        guestEmail: 'karim@example.com',
        shipName: 'Karim',
        shipPlaceText: 'Gulshan, Dhaka',
        shipLine: 'House 1, Road 2',
        customerNote: 'Call before coming',
        subtotalP: 200_000,
        deliveryChargeP: 6000,
        deliveryDiscountP: 0,
        grandTotalP: 206_000,
        codDueP: 206_000,
        lang: 'en',
        isPreorder: false,
      });
      expect(order.items).toEqual([
        expect.objectContaining({
          productId: product.id,
          variantId: variant.id,
          qty: 2,
          unitPriceP: 100_000,
          unitBaseP: 100_000,
          priceSource: 'base',
          lineTotalP: 200_000,
          weightG: 400,
          titleSnapshot: product.titleEn,
        }),
      ]);
      expect(order.history).toEqual([
        expect.objectContaining({ fromStatus: null, toStatus: 'processing' }),
      ]);
      expect(order.payments).toEqual([
        expect.objectContaining({
          method: 'cod',
          purpose: 'full',
          amountP: 206_000,
          status: 'initiated',
        }),
      ]);

      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } }),
      ).toMatchObject({
        onHand: 5,
        reserved: 2,
      });
      const move = await prisma.stockMovement.findFirstOrThrow({ where: { refId: order.id } });
      expect(move).toMatchObject({
        reason: 'order_reserve',
        reservedDelta: 2,
        qtyDelta: 0,
        refType: 'order',
      });
      expect((await a.get('/v1/cart')).body.count).toBe(0);

      expect(sms.outbox).toHaveLength(1);
      expect(sms.outbox[0]).toMatchObject({ to: '01811111111' });
      expect(sms.outbox[0]?.text).toContain(res.orderNo);
      expect(sms.outbox[0]?.text).toContain('Tk 2,060');
      expect(mail.outbox[0]).toMatchObject({ to: 'karim@example.com' });
    });

    it('numbers orders YYMM-NNNNN in sequence and writes Bangla SMS for lang=bn', async () => {
      const { variant } = await makeProduct(app, { stock: 20 });
      const a = guest();
      await addToCart(a, variant.id);
      const first = (await placeGuest(a)).body.orderNo as string;
      await addToCart(a, variant.id);
      const second = (await placeGuest(a, { lang: 'bn' })).body.orderNo as string;
      expect(Number(second.slice(5))).toBe(Number(first.slice(5)) + 1);
      expect(second.slice(0, 4)).toBe(first.slice(0, 4));
      expect(sms.outbox.at(-1)?.text).toMatch(/অর্ডার/);
      const row = await prisma.order.findUniqueOrThrow({
        where: { orderNo: second },
        include: { items: true },
      });
      expect(row.shipPlaceText).toBe('গুলশান, ঢাকা');
      expect(row.items[0]?.titleSnapshot).toMatch(/^পণ্য/);
    });

    it('is idempotent: the same key never makes a second order', async () => {
      const { variant } = await makeProduct(app, { stock: 5 });
      const a = guest();
      await addToCart(a, variant.id, 1);
      const k = key();
      const [r1, r2] = await Promise.all([
        placeGuest(a, { idempotencyKey: k }),
        placeGuest(a, { idempotencyKey: k }),
      ]);
      const ok = [r1, r2].filter((r) => r.status === 200);
      expect(ok.length).toBeGreaterThanOrEqual(1);
      for (const r of [r1, r2]) expect([200, 409]).toContain(r.status);
      const again = await placeGuest(a, { idempotencyKey: k });
      expect(again.status).toBe(200);
      expect(again.body.orderNo).toBe(ok[0]?.body.orderNo);
      expect(await prisma.order.count()).toBe(1);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).reserved,
      ).toBe(1);
      expect(sms.outbox).toHaveLength(1);
    });

    it('rejects an empty cart, and a failed attempt does not burn the key', async () => {
      const a = guest();
      const k = key();
      const empty = await placeGuest(a, { idempotencyKey: k });
      expect(empty.status).toBe(409);
      expect(empty.body.code).toBe('CART_EMPTY');
      const { variant } = await makeProduct(app);
      await addToCart(a, variant.id);
      expect((await placeGuest(a, { idempotencyKey: k })).status).toBe(200);
    });

    it('answers OUT_OF_STOCK and CART_CHANGED without creating anything', async () => {
      const a = guest();
      const gone = await makeProduct(app, { stock: 3 });
      await addToCart(a, gone.variant.id, 3);
      await prisma.inventory.update({ where: { variantId: gone.variant.id }, data: { onHand: 1 } });
      const r1 = await placeGuest(a);
      expect(r1.status).toBe(409);
      expect(r1.body.code).toBe('OUT_OF_STOCK');
      expect(r1.body.variantIds).toEqual([gone.variant.id]);

      await a.delete('/v1/cart');
      const hidden = await makeProduct(app);
      await addToCart(a, hidden.variant.id);
      await prisma.product.update({
        where: { id: hidden.product.id },
        data: { status: 'archived' },
      });
      const r2 = await placeGuest(a);
      expect(r2.status).toBe(409);
      expect(r2.body.code).toBe('CART_CHANGED');
      expect(await prisma.order.count()).toBe(0);
      expect(await prisma.stockMovement.count({ where: { reason: 'order_reserve' } })).toBe(0);
    });

    it('lets only one of two buyers take the last unit', async () => {
      const { variant } = await makeProduct(app, { stock: 1 });
      const a = guest();
      const b = guest();
      await addToCart(a, variant.id);
      await addToCart(b, variant.id);
      const [ra, rb] = await Promise.all([placeGuest(a), placeGuest(b)]);
      expect([ra.status, rb.status].sort()).toEqual([200, 409]);
      const bad = ra.status === 409 ? ra : rb;
      expect(bad.body.code).toBe('OUT_OF_STOCK');
      expect(await prisma.order.count()).toBe(1);
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } }),
      ).toMatchObject({ onHand: 1, reserved: 1 });
    });

    it('re-prices from the database: a sale that ended is charged at the regular price', async () => {
      const { variant } = await makeProduct(app, { priceP: 100_000, salePriceP: 70_000 });
      const a = guest();
      const cart = await addToCart(a, variant.id);
      expect(cart.items[0].unitPriceP).toBe(70_000);
      await prisma.variant.update({
        where: { id: variant.id },
        data: {
          saleEndsAt: new Date(Date.now() - 1000),
          saleStartsAt: new Date(Date.now() - 5000),
        },
      });
      const res = (await placeGuest(a)).body;
      const item = await prisma.orderItem.findFirstOrThrow();
      expect(item.unitPriceP).toBe(100_000);
      expect(res.grandTotalP).toBe(106_000);
    });

    it('requires a valid address and guest details', async () => {
      const { variant } = await makeProduct(app);
      const a = guest();
      await addToCart(a, variant.id);
      const badPhone = await placeGuest(a, { address: await address({ phone: '12345' }) });
      expect(badPhone.status).toBe(400);
      expect(badPhone.body.code).toBe('ADDRESS_INVALID');
      const p = await places(app);
      const mismatch = await placeGuest(a, {
        address: await address({ districtId: p.far.districtId }),
      });
      expect(mismatch.body.code).toBe('ADDRESS_INVALID');
      const noGuest = await placeGuest(a, { guest: undefined });
      expect(noGuest.body.code).toBe('GUEST_REQUIRED');
      const saved = await placeGuest(a, {
        address: undefined,
        addressId: '00000000-0000-7000-8000-000000000000',
      });
      expect(saved.body.code).toBe('ADDRESS_INVALID');
      const both = await placeGuest(a, { addressId: '00000000-0000-7000-8000-000000000000' });
      expect(both.status).toBe(400);
      expect(await prisma.order.count()).toBe(0);
    });

    it('needs an SMS OTP above the threshold; the code works once', async () => {
      const { variant } = await makeProduct(app, { priceP: 600_000, stock: 5 });
      const a = guest();
      await addToCart(a, variant.id);
      const missing = await placeGuest(a);
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe('OTP_REQUIRED');

      const sent = await a.post('/v1/checkout/otp').send({ phone: '+8801811111111' }).expect(200);
      expect(sent.body).toEqual({ sentTo: '018******11', expiresInSec: 300, resendInSec: 60 });
      expect(sms.outbox.at(-1)?.to).toBe('01811111111');
      const code = lastOtp(app);
      const wrong = await placeGuest(a, { otpCode: code === '000000' ? '000001' : '000000' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.code).toBe('OTP_INVALID');
      const ok = await placeGuest(a, { otpCode: code });
      expect(ok.status).toBe(200);
      const order = await prisma.order.findFirstOrThrow();
      expect(order.guestOtpVerifiedAt).not.toBeNull();

      await addToCart(a, variant.id);
      const replay = await placeGuest(a, { otpCode: code });
      expect(replay.status).toBe(400);
    });

    it('an unrelated cart failure does not burn the OTP', async () => {
      const { variant } = await makeProduct(app, { priceP: 600_000, stock: 5 });
      const a = guest();
      await addToCart(a, variant.id);
      await a.post('/v1/checkout/otp').send({ phone: '01811111111' }).expect(200);
      const code = lastOtp(app);
      await prisma.inventory.update({ where: { variantId: variant.id }, data: { onHand: 0 } });
      expect((await placeGuest(a, { otpCode: code })).body.code).toBe('OUT_OF_STOCK');
      await prisma.inventory.update({ where: { variantId: variant.id }, data: { onHand: 5 } });
      expect((await placeGuest(a, { otpCode: code })).status).toBe(200);
    });

    it('honours the admin-set OTP threshold', async () => {
      const { agent } = await createOwner(app);
      await setCheckout(agent, { guestOtpAboveP: 10_000_000, maxQtyPerLine: 10 });
      const { variant } = await makeProduct(app, { priceP: 600_000 });
      const a = guest();
      await addToCart(a, variant.id);
      expect((await placeGuest(a)).status).toBe(200);
    });

    it('skips reservation for dropship and pre-order lines when pre-orders are on', async () => {
      const { agent } = await createOwner(app);
      await agent.put('/v1/admin/settings/preorders_enabled').send({ value: true }).expect(204);
      const drop = await makeProduct(app, { fulfillment: 'dropship', stock: 0 });
      const pre = await makeProduct(app, { isPreorder: true, stock: 0 });
      const a = guest();
      await addToCart(a, drop.variant.id, 2);
      await addToCart(a, pre.variant.id, 1);
      const res = await placeGuest(a);
      expect(res.status).toBe(200);
      expect(await prisma.stockMovement.count({ where: { reason: 'order_reserve' } })).toBe(0);
      expect((await prisma.order.findFirstOrThrow()).isPreorder).toBe(true);
    });
  });

  describe('place as customer', () => {
    it('uses a saved address, skips the OTP, and links to the account', async () => {
      const a = guest();
      const customer = await signupCustomer(app, a, '01712345678', { email: 'Rahim@Example.com' });
      const p = await places(app);
      const saved = await a
        .post('/v1/customer/addresses')
        .send({ name: 'Rahim', phone: '01712345678', ...p.suburb, line: 'Flat 4B' })
        .expect(201);
      const { variant } = await makeProduct(app, { priceP: 900_000, stock: 5 });
      await addToCart(a, variant.id);
      const quote = (await a.post('/v1/checkout/quote').send(p.suburb).expect(200)).body;
      expect(quote.guestOtpRequired).toBe(false);
      const res = await a
        .post('/v1/checkout/place')
        .send({ addressId: saved.body.id, lang: 'en', idempotencyKey: key() })
        .expect(200);
      const order = await prisma.order.findUniqueOrThrow({ where: { orderNo: res.body.orderNo } });
      expect(order).toMatchObject({
        customerId: customer.id,
        guestName: null,
        shipName: 'Rahim',
        shipPlaceText: 'Gazipur Sadar, Gazipur',
        deliveryChargeP: 10_000,
        guestOtpVerifiedAt: null,
      });
      expect(sms.outbox.at(-1)?.to).toBe('01712345678');
      expect(mail.outbox.at(-1)?.to).toBe('rahim@example.com');
    });

    it("another customer's saved address is refused", async () => {
      const a = guest();
      await signupCustomer(app, a, '01712345678');
      const p = await places(app);
      const saved = await a
        .post('/v1/customer/addresses')
        .send({ name: 'R', phone: '01712345678', ...p.dhaka, line: 'Road 5' })
        .expect(201);
      const b = guest();
      await signupCustomer(app, b, '01912345678');
      const { variant } = await makeProduct(app);
      await addToCart(b, variant.id);
      const res = await b
        .post('/v1/checkout/place')
        .send({ addressId: saved.body.id, lang: 'en', idempotencyKey: key() });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ADDRESS_INVALID');
    });

    it('links only OTP-verified guest orders when the same phone signs up (Q94, C45)', async () => {
      const { variant } = await makeProduct(app, { stock: 5 });
      const g = guest();
      await addToCart(g, variant.id);
      const unverified = await placeGuest(g, { guest: { name: 'Karim', phone: '01712345678' } });
      expect(unverified.status).toBe(200);

      // Now every guest order needs the SMS code.
      const { agent } = await createOwner(app);
      await setCheckout(agent, { guestOtpAboveP: 0, maxQtyPerLine: 10 });
      await addToCart(g, variant.id);
      await g.post('/v1/checkout/otp').send({ phone: '01712345678' }).expect(200);
      const verified = await placeGuest(g, {
        guest: { name: 'Karim', phone: '01712345678' },
        otpCode: lastOtp(app),
      });
      expect(verified.status).toBe(200);

      // Same phone, so skip the 60 s resend cooldown of the code sent above.
      await app.get<Redis>(REDIS).del('cust-otp:cooldown:01712345678');
      const other = guest();
      await signupCustomer(app, other, '01712345678');
      const linked = await prisma.order.findMany({ where: { customerId: { not: null } } });
      expect(linked.map((o) => o.orderNo)).toEqual([verified.body.orderNo]);
      const list = await other.get('/v1/customer/orders').expect(200);
      expect(list.body.items.map((o: { orderNo: string }) => o.orderNo)).toEqual([
        verified.body.orderNo,
      ]);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { orderNo: unverified.body.orderNo } }))
          .customerId,
      ).toBeNull();
      void PASSWORD;
    });
  });
});
