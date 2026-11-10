import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct, PASSWORD, resetCommerce, signupCustomer } from './cart-fixtures';
import { createApp, createOwner, createStaffWith } from './helpers';
import { dhakaAddress, placeAs } from './promotions-engine-fixtures';

describe('admin customers (A6, C88)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Awaited<ReturnType<typeof createOwner>>;
  let variantId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  }, 90_000);
  beforeEach(async () => {
    await resetCommerce(app);
    await prisma.$executeRawUnsafe('TRUNCATE customer_notes CASCADE');
    owner = await createOwner(app);
    variantId = (await makeProduct(app, { priceP: 100_000, stock: 50 })).variant.id;
  });
  afterAll(async () => {
    await app.close();
  });

  const shopper = async (phone: string, name = 'Rahim') => {
    const agent = request.agent(app.getHttpServer());
    const c = await signupCustomer(app, agent, phone, { name });
    return { agent, id: c.id, phone };
  };
  const orderAs = async (agent: ReturnType<typeof request.agent>, qty = 1) => {
    await addToCart(agent, variantId, qty);
    return placeAs(app, agent, { guestPhone: null });
  };

  describe('list and profile', () => {
    it('lists newest first with totals that skip cancelled orders', async () => {
      const a = await shopper('01711000001', 'Alice Khan');
      await shopper('01711000002', 'Bob');
      const r1 = await orderAs(a.agent, 2);
      expect(r1.status).toBe(200);
      const r2 = await orderAs(a.agent, 1);
      expect(r2.status).toBe(200);
      await prisma.order.update({
        where: { orderNo: r2.body.orderNo },
        data: { status: 'cancelled' },
      });

      const res = await owner.agent.get('/v1/admin/customers').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Bob', 'Alice Khan']);
      const alice = res.body.items[1];
      expect(alice).toMatchObject({ blocked: false, orderCount: 1, phone: '01711000001' });
      expect(alice.spentP).toBeGreaterThanOrEqual(200_000);
      expect(alice.lastOrderAt).not.toBeNull();
      expect(res.body.items[0]).toMatchObject({ orderCount: 0, spentP: 0, lastOrderAt: null });
    });

    it('searches name, email, phone (with country code) and filters', async () => {
      const a = await shopper('01711000001', 'Alice Khan');
      const b = await shopper('01711000002', 'Bob');
      await orderAs(a.agent);
      await prisma.customer.update({ where: { id: b.id }, data: { email: 'bob@Example.com' } });
      await prisma.customer.update({
        where: { id: b.id },
        data: { disabledAt: new Date(), blockedReason: 'x' },
      });
      const get = async (qs: string) =>
        (await owner.agent.get(`/v1/admin/customers?${qs}`).expect(200)).body;
      expect((await get('q=alice')).total).toBe(1);
      expect((await get('q=BOB@example')).items[0].id).toBe(b.id);
      expect((await get('q=%2B8801711000002')).items[0].id).toBe(b.id);
      expect((await get('q=0171100000')).total).toBe(2);
      expect((await get('q=zzz')).total).toBe(0);
      expect((await get('blocked=1')).items.map((i: { id: string }) => i.id)).toEqual([b.id]);
      expect((await get('blocked=0')).items.map((i: { id: string }) => i.id)).toEqual([a.id]);
      expect((await get('hasOrders=1')).items.map((i: { id: string }) => i.id)).toEqual([a.id]);
      expect((await get('hasOrders=0')).items.map((i: { id: string }) => i.id)).toEqual([b.id]);
    });

    it('pages on the server', async () => {
      for (let i = 1; i <= 5; i++) await shopper(`0171100010${i}`, `C${i}`);
      const p1 = await owner.agent.get('/v1/admin/customers?pageSize=2&page=1').expect(200);
      const p3 = await owner.agent.get('/v1/admin/customers?pageSize=2&page=3').expect(200);
      expect(p1.body.total).toBe(5);
      expect(p1.body.items).toHaveLength(2);
      expect(p3.body.items).toHaveLength(1);
      await owner.agent.get('/v1/admin/customers?pageSize=101').expect(400);
    });

    it('shows the profile with addresses, and the order list', async () => {
      const a = await shopper('01711000001', 'Alice');
      const upazila = await prisma.upazila.findFirstOrThrow({ where: { districtId: 47 } });
      await prisma.customerAddress.create({
        data: {
          customerId: a.id,
          name: 'Alice',
          phone: '01711000001',
          districtId: 47,
          upazilaId: upazila.id,
          line: 'House 5',
          isDefault: true,
        },
      });
      const placed = await orderAs(a.agent, 3);
      const detail = await owner.agent.get(`/v1/admin/customers/${a.id}`).expect(200);
      expect(detail.body).toMatchObject({
        id: a.id,
        blockedAt: null,
        blockedBy: null,
        cancelledCount: 0,
        isFlagged: false,
      });
      expect(detail.body.phoneVerifiedAt).not.toBeNull();
      expect(detail.body.addresses).toHaveLength(1);
      expect(detail.body.addresses[0]).toMatchObject({ line: 'House 5', isDefault: true });
      expect(detail.body.addresses[0].placeText).toContain(upazila.nameEn);

      const orders = await owner.agent.get(`/v1/admin/customers/${a.id}/orders`).expect(200);
      expect(orders.body.total).toBe(1);
      expect(orders.body.items[0]).toMatchObject({
        orderNo: placed.body.orderNo,
        itemCount: 3,
        status: 'processing',
      });
    });

    it('404s on an unknown customer', async () => {
      const id = '00000000-0000-7000-8000-000000000000';
      for (const path of ['', '/orders', '/notes']) {
        const res = await owner.agent.get(`/v1/admin/customers/${id}${path}`).expect(404);
        expect(res.body.code).toBe('CUSTOMER_NOT_FOUND');
      }
      await owner.agent.post(`/v1/admin/customers/${id}/block`).send({ reason: 'x' }).expect(404);
      await owner.agent.get('/v1/admin/customers/not-a-uuid').expect(400);
    });
  });

  describe('notes', () => {
    it('appends notes, newest first, with the staff name', async () => {
      const a = await shopper('01711000001');
      const n1 = await owner.agent
        .post(`/v1/admin/customers/${a.id}/notes`)
        .send({ body: 'First call, no answer' })
        .expect(201);
      expect(n1.body.staff.name).toBe('Owner One');
      await owner.agent
        .post(`/v1/admin/customers/${a.id}/notes`)
        .send({ body: 'Second call ok' })
        .expect(201);
      const list = await owner.agent.get(`/v1/admin/customers/${a.id}/notes`).expect(200);
      expect(list.body.items.map((n: { body: string }) => n.body)).toEqual([
        'Second call ok',
        'First call, no answer',
      ]);
      await owner.agent.post(`/v1/admin/customers/${a.id}/notes`).send({ body: '  ' }).expect(400);
      await owner.agent
        .patch(`/v1/admin/customers/${a.id}/notes/${n1.body.id}`)
        .send({ body: 'x' })
        .expect(404);
    });
  });

  describe('block', () => {
    it('blocks: sessions revoked, login refused, orders refused; unblock restores', async () => {
      const a = await shopper('01711000001', 'Alice');
      await a.agent.get('/v1/customer/me').expect(200);

      const res = await owner.agent
        .post(`/v1/admin/customers/${a.id}/block`)
        .send({ reason: 'Fake orders' })
        .expect(200);
      expect(res.body).toMatchObject({
        blocked: true,
        blockedReason: 'Fake orders',
        blockedBy: { name: 'Owner One' },
      });
      expect(res.body.blockedAt).not.toBeNull();
      expect(await prisma.customerSession.count({ where: { customerId: a.id } })).toBe(0);
      await a.agent.get('/v1/customer/me').expect(401);
      const login = await request(app.getHttpServer())
        .post('/v1/customer/auth/login')
        .send({ login: a.phone, password: PASSWORD })
        .expect(403);
      expect(login.body.code).toBe('ACCOUNT_DISABLED');
      expect(login.body.message).toBe('This account is blocked.');

      const again = await owner.agent
        .post(`/v1/admin/customers/${a.id}/block`)
        .send({ reason: 'again' })
        .expect(409);
      expect(again.body.code).toBe('CUSTOMER_ALREADY_BLOCKED');
      await owner.agent.post(`/v1/admin/customers/${a.id}/block`).send({}).expect(400);

      const un = await owner.agent.post(`/v1/admin/customers/${a.id}/unblock`).expect(200);
      expect(un.body).toMatchObject({
        blocked: false,
        blockedAt: null,
        blockedReason: null,
        blockedBy: null,
      });
      const row = await prisma.customer.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.blockedByStaffId).toBeNull();
      await request(app.getHttpServer())
        .post('/v1/customer/auth/login')
        .send({ login: a.phone, password: PASSWORD })
        .expect(200);
      const notBlocked = await owner.agent.post(`/v1/admin/customers/${a.id}/unblock`).expect(409);
      expect(notBlocked.body.code).toBe('CUSTOMER_NOT_BLOCKED');
    });

    it('refuses a guest order and guest OTP from a blocked customer phone, and quotes', async () => {
      const a = await shopper('01711000001');
      await owner.agent
        .post(`/v1/admin/customers/${a.id}/block`)
        .send({ reason: 'Fake orders' })
        .expect(200);

      const guest = request.agent(app.getHttpServer());
      await addToCart(guest, variantId, 1);
      const res = await placeAs(app, guest, { guestPhone: '01711000001' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CUSTOMER_BLOCKED');
      expect(res.body.message).not.toContain('Fake');
      expect(await prisma.order.count()).toBe(0);

      // Same phone as the ship-to contact is refused too.
      const g2 = request.agent(app.getHttpServer());
      await addToCart(g2, variantId, 1);
      const other = await placeAs(app, g2, { guestPhone: '01722000009' });
      expect(other.status).toBe(200);
      const g3 = request.agent(app.getHttpServer());
      await addToCart(g3, variantId, 1);
      const viaShip = await placeAs(app, g3, {
        guestPhone: '01722000008',
        body: {
          address: {
            ...(await dhakaAddress(app)),
            phone: '01711000001',
          },
        },
      });
      expect(viaShip.status).toBe(403);

      const otp = await guest.post('/v1/checkout/otp').send({ phone: '01711000001' });
      expect(otp.status).toBe(403);
      expect(otp.body.code).toBe('CUSTOMER_BLOCKED');
    });

    it('a customer who was blocked mid-session cannot place an order', async () => {
      const a = await shopper('01711000001');
      await addToCart(a.agent, variantId, 1);
      // Direct flag (no session purge) to prove checkout itself refuses.
      await prisma.customer.update({ where: { id: a.id }, data: { disabledAt: new Date() } });
      const res = await placeAs(app, a.agent, { guestPhone: null });
      expect([400, 401, 403]).toContain(res.status);
      expect(await prisma.order.count()).toBe(0);
    });

    it('unblocking lets the phone order again', async () => {
      const a = await shopper('01711000001');
      await owner.agent.post(`/v1/admin/customers/${a.id}/block`).send({ reason: 'x' }).expect(200);
      await owner.agent.post(`/v1/admin/customers/${a.id}/unblock`).expect(200);
      const guest = request.agent(app.getHttpServer());
      await addToCart(guest, variantId, 1);
      expect((await placeAs(app, guest, { guestPhone: '01711000001' })).status).toBe(200);
    });
  });

  describe('permissions', () => {
    it('needs customers.view to read and customers.manage to write', async () => {
      const a = await shopper('01711000001');
      const viewer = await createStaffWith(app, ['customers.view']);
      const none = await createStaffWith(app, ['orders.view']);
      await viewer.agent.get('/v1/admin/customers').expect(200);
      await viewer.agent.get(`/v1/admin/customers/${a.id}`).expect(200);
      await none.agent.get('/v1/admin/customers').expect(403);
      await viewer.agent.post(`/v1/admin/customers/${a.id}/notes`).send({ body: 'x' }).expect(403);
      await viewer.agent
        .post(`/v1/admin/customers/${a.id}/block`)
        .send({ reason: 'x' })
        .expect(403);
      await viewer.agent.post(`/v1/admin/customers/${a.id}/unblock`).expect(403);
      const manager = await createStaffWith(app, ['customers.view', 'customers.manage']);
      await manager.agent
        .post(`/v1/admin/customers/${a.id}/block`)
        .send({ reason: 'x' })
        .expect(200);
      await request(app.getHttpServer()).get('/v1/admin/customers').expect(401);
    });
  });
});
