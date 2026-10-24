import type { INestApplication } from '@nestjs/common';
import type Redis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS } from '../src/redis/redis.module';
import { addToCart, makeProduct, places, resetCommerce, signupCustomer } from './cart-fixtures';
import { createApp } from './helpers';

type Agent = ReturnType<typeof request.agent>;

describe('customer orders, tracking and addresses', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS);
  });
  beforeEach(() => resetCommerce(app));
  afterAll(() => app.close());

  const guest = () => request.agent(app.getHttpServer());
  let n = 0;

  async function order(
    a: Agent,
    o: { qty?: number; addressId?: string; guestPhone?: string } = {},
  ) {
    const { variant } = await makeProduct(app, { priceP: 50_000, stock: 20 });
    await addToCart(a, variant.id, o.qty ?? 1);
    const p = await places(app);
    const res = await a
      .post('/v1/checkout/place')
      .send({
        ...(o.addressId
          ? { addressId: o.addressId }
          : {
              address: { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'Road 1, House 2' },
            }),
        ...(o.guestPhone ? { guest: { name: 'G', phone: o.guestPhone } } : {}),
        lang: 'en',
        idempotencyKey: `order-test-key-${n++}`,
      })
      .expect(200);
    return { orderNo: res.body.orderNo as string, variant };
  }

  describe('orders', () => {
    it('lists only my orders, newest first, with a paged total', async () => {
      const a = guest();
      await signupCustomer(app, a, '01712345678');
      const o1 = await order(a, { qty: 2 });
      const o2 = await order(a);
      const stranger = guest();
      await signupCustomer(app, stranger, '01912345678');
      await order(stranger);

      const list = await a.get('/v1/customer/orders').expect(200);
      expect(list.body.total).toBe(2);
      expect(list.body.items.map((o: { orderNo: string }) => o.orderNo)).toEqual([
        o2.orderNo,
        o1.orderNo,
      ]);
      expect(list.body.items[1]).toMatchObject({
        status: 'processing',
        itemCount: 2,
        grandTotalP: 106_000,
        firstImage: null,
      });
      const page2 = await a.get('/v1/customer/orders?page=2&limit=1').expect(200);
      expect(page2.body.items.map((o: { orderNo: string }) => o.orderNo)).toEqual([o1.orderNo]);
      await request(app.getHttpServer()).get('/v1/customer/orders').expect(401);
    });

    it('shows the full order, with snapshots, money and history; hides others', async () => {
      const a = guest();
      await signupCustomer(app, a, '01712345678');
      const { orderNo, variant } = await order(a, { qty: 2 });
      const d = (await a.get(`/v1/customer/orders/${orderNo}`).expect(200)).body;
      expect(d).toMatchObject({
        orderNo,
        status: 'processing',
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        lang: 'en',
        shipTo: {
          name: 'Karim',
          phone: '01811111111',
          placeText: 'Gulshan, Dhaka',
          line: 'Road 1, House 2',
          landmark: null,
        },
        zone: { nameEn: 'Inside Dhaka', etaMinDays: 1, etaMaxDays: 2 },
        money: {
          subtotalP: 100_000,
          deliveryChargeP: 6000,
          deliveryDiscountP: 0,
          grandTotalP: 106_000,
          codDueP: 106_000,
          paidP: 0,
        },
      });
      expect(d.items).toEqual([
        expect.objectContaining({
          variantId: variant.id,
          qty: 2,
          unitPriceP: 50_000,
          lineTotalP: 100_000,
        }),
      ]);
      expect(d.history).toEqual([{ status: 'processing', at: expect.any(String) }]);

      // Snapshots survive catalog edits.
      await prisma.product.update({
        where: { id: d.items[0].productId },
        data: { titleEn: 'Renamed' },
      });
      expect((await a.get(`/v1/customer/orders/${orderNo}`)).body.items[0].title).not.toBe(
        'Renamed',
      );

      const other = guest();
      await signupCustomer(app, other, '01912345678');
      const miss = await other.get(`/v1/customer/orders/${orderNo}`).expect(404);
      expect(miss.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('tracks by order number plus a phone on the order, with no personal data', async () => {
      const g = guest();
      const { orderNo } = await order(g, { guestPhone: '01712345678' });
      const track = (body: object) =>
        request(app.getHttpServer()).post('/v1/public/track').send(body);
      const ok = await track({ orderNo, phone: '+880 1811-111111' }).expect(200);
      expect(ok.headers['cache-control']).toBe('private, no-store');
      expect(ok.body).toEqual({
        orderNo,
        status: 'processing',
        placedAt: expect.any(String),
        maskedPhone: '018******11',
        itemCount: 1,
        grandTotalP: 56_000,
        etaMinDays: 1,
        etaMaxDays: 2,
        timeline: [{ status: 'processing', at: expect.any(String) }],
      });
      // The guest phone works too.
      await track({ orderNo, phone: '01712345678' }).expect(200);
      for (const q of [
        { orderNo, phone: '01999999999' },
        { orderNo: '2610-99999', phone: '01811111111' },
        { orderNo, phone: 'abc12' },
      ]) {
        const res = await track(q).expect(404);
        expect(res.body.code).toBe('ORDER_NOT_FOUND');
      }
      await track({ orderNo }).expect(400);
      // The phone no longer goes in the URL.
      await request(app.getHttpServer())
        .get('/v1/public/track')
        .query({ orderNo, phone: '01811111111' })
        .expect(404);
    });

    it('throttles wrong tracking lookups per IP and per order number', async () => {
      const post = (orderNo: string) =>
        request(app.getHttpServer())
          .post('/v1/public/track')
          .send({ orderNo, phone: '01811111111' });
      let last = 0;
      for (let i = 0; i < 11; i++) last = (await post('2610-00001')).status;
      expect(last).toBe(429);
      await redis.flushdb();
      for (let i = 0; i < 21; i++) last = (await post(`2610-1000${i}`)).status;
      expect(last).toBe(429);
    });
  });

  describe('addresses', () => {
    async function signedIn() {
      const a = guest();
      await signupCustomer(app, a, '01712345678');
      return a;
    }
    const body = async (o: Record<string, unknown> = {}) => {
      const p = await places(app);
      return {
        label: 'Home',
        name: 'Rahim',
        phone: '+8801712345678',
        ...p.dhaka,
        line: 'House 9, Road 4',
        landmark: 'Blue gate',
        ...o,
      };
    };

    it('requires login', async () => {
      await request(app.getHttpServer()).get('/v1/customer/addresses').expect(401);
    });

    it('creates with a normalized phone and place text; first becomes default', async () => {
      const a = await signedIn();
      const res = await a
        .post('/v1/customer/addresses')
        .send(await body())
        .expect(201);
      expect(res.body).toMatchObject({
        label: 'Home',
        phone: '01712345678',
        areaId: null,
        landmark: 'Blue gate',
        isDefault: true,
        placeText: 'Gulshan, Dhaka',
      });
      const second = await a
        .post('/v1/customer/addresses')
        .send(await body({ label: 'Office' }))
        .expect(201);
      expect(second.body.isDefault).toBe(false);
      const list = await a.get('/v1/customer/addresses').expect(200);
      expect(list.body.map((x: { label: string }) => x.label)).toEqual(['Home', 'Office']);
    });

    it('validates phone and location', async () => {
      const a = await signedIn();
      const p = await places(app);
      const r1 = await a
        .post('/v1/customer/addresses')
        .send(await body({ phone: '12345' }))
        .expect(400);
      expect(r1.body.code).toBe('ADDRESS_INVALID');
      const r2 = await a
        .post('/v1/customer/addresses')
        .send(await body({ districtId: p.far.districtId }))
        .expect(400);
      expect(r2.body.code).toBe('ADDRESS_INVALID');
      await a
        .post('/v1/customer/addresses')
        .send(await body({ line: '' }))
        .expect(400);
    });

    it('patches, switches the default, and promotes another on delete', async () => {
      const a = await signedIn();
      const p = await places(app);
      const first = (
        await a
          .post('/v1/customer/addresses')
          .send(await body())
          .expect(201)
      ).body;
      const second = (
        await a
          .post('/v1/customer/addresses')
          .send(await body({ label: 'Office' }))
          .expect(201)
      ).body;

      const patched = await a
        .patch(`/v1/customer/addresses/${second.id}`)
        .send({ line: 'Tower 3', ...p.suburb })
        .expect(200);
      expect(patched.body).toMatchObject({
        line: 'Tower 3',
        placeText: 'Gazipur Sadar, Gazipur',
        label: 'Office',
      });
      await a
        .patch(`/v1/customer/addresses/${second.id}`)
        .send({ upazilaId: p.dhaka.upazilaId })
        .expect(400);

      const dflt = await a.put(`/v1/customer/addresses/${second.id}/default`).expect(200);
      expect(dflt.body.isDefault).toBe(true);
      expect((await a.get('/v1/customer/addresses')).body.map((x: { id: string }) => x.id)).toEqual(
        [second.id, first.id],
      );

      await a.delete(`/v1/customer/addresses/${second.id}`).expect(204);
      const left = (await a.get('/v1/customer/addresses')).body;
      expect(left).toHaveLength(1);
      expect(left[0]).toMatchObject({ id: first.id, isDefault: true });
      await a.delete(`/v1/customer/addresses/${second.id}`).expect(404);
    });

    it("cannot touch another customer's address, and caps the list at 10", async () => {
      const a = await signedIn();
      const mine = (
        await a
          .post('/v1/customer/addresses')
          .send(await body())
          .expect(201)
      ).body;
      const b = guest();
      await signupCustomer(app, b, '01912345678');
      await b.patch(`/v1/customer/addresses/${mine.id}`).send({ line: 'hacked road' }).expect(404);
      await b.put(`/v1/customer/addresses/${mine.id}/default`).expect(404);
      await b.delete(`/v1/customer/addresses/${mine.id}`).expect(404);
      expect((await b.get('/v1/customer/addresses')).body).toEqual([]);

      for (let i = 0; i < 9; i++)
        await a
          .post('/v1/customer/addresses')
          .send(await body())
          .expect(201);
      const over = await a
        .post('/v1/customer/addresses')
        .send(await body())
        .expect(409);
      expect(over.body.code).toBe('ADDRESS_LIMIT');
    });
  });
});
