import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { SmsService } from '../src/sms/sms.service';
import { addToCart, makeProduct, places, resetCommerce, signupCustomer } from './cart-fixtures';
import { createApp, createOwner } from './helpers';

type Agent = ReturnType<typeof request.agent>;

describe('guest and per-IP order limits (C44)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    sms = app.get(SmsService);
  });
  beforeEach(() => resetCommerce(app));
  afterAll(() => app.close());

  const guest = () => request.agent(app.getHttpServer());
  let n = 0;

  async function place(a: Agent, o: { phone?: string; customer?: boolean } = {}) {
    const p = await places(app);
    return a.post('/v1/checkout/place').send({
      address: { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'Road 1, House 2' },
      ...(o.customer ? {} : { guest: { name: 'Karim', phone: o.phone ?? '01811111111' } }),
      lang: 'en',
      idempotencyKey: `limit-test-key-${n++}`,
    });
  }

  async function buy(a: Agent, o: { phone?: string; customer?: boolean; priceP?: number } = {}) {
    const { variant } = await makeProduct(app, { priceP: o.priceP ?? 100_000, stock: 20 });
    await addToCart(a, variant.id);
    return place(a, o);
  }

  const setLimits = async (value: object) => {
    const { agent } = await createOwner(app);
    await agent.put('/v1/admin/settings/guest_orders').send({ value }).expect(204);
  };

  it('allows 3 open orders per guest phone, then GUEST_LIMIT; delivery frees a slot', async () => {
    const a = guest();
    for (let i = 0; i < 3; i++) expect((await buy(a)).status).toBe(200);
    expect(sms.outbox).toHaveLength(3); // each confirmation was still sent

    const res = await buy(a);
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: 'GUEST_LIMIT', reason: 'open_orders' });
    expect(await prisma.order.count()).toBe(3);
    // The refused cart is untouched and nothing was reserved for it.
    expect((await a.get('/v1/cart')).body.count).toBe(1);

    expect((await buy(guest(), { phone: '01922222222' })).status).toBe(200);

    const first = await prisma.order.findFirstOrThrow({
      where: { guestPhone: '01811111111' },
      orderBy: { placedAt: 'asc' },
    });
    await prisma.order.update({ where: { id: first.id }, data: { status: 'delivered' } });
    expect((await place(a)).status).toBe(200);
  });

  it('does not limit signed-in customers by open orders', async () => {
    const a = guest();
    await signupCustomer(app, a, '01712345678');
    for (let i = 0; i < 4; i++) expect((await buy(a, { customer: true })).status).toBe(200);
  });

  it('caps the guest order value per phone per day; cancelled orders do not count', async () => {
    await setLimits({ maxOpenPerPhone: 3, dailyCapP: 150_000, perIpPerHour: 5 });
    const a = guest();
    const first = await buy(a); // ৳1060 with delivery
    expect(first.status).toBe(200);
    const second = await buy(a);
    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({ code: 'GUEST_LIMIT', reason: 'daily_cap' });

    await prisma.order.update({
      where: { orderNo: first.body.orderNo },
      data: { status: 'cancelled' },
    });
    expect((await place(a)).status).toBe(200);

    // Older than a day no longer counts.
    await prisma.order.updateMany({ data: { placedAt: new Date(Date.now() - 25 * 3600_000) } });
    await prisma.order.updateMany({ data: { status: 'cancelled' } });
    expect((await buy(a)).status).toBe(200);
  });

  it('limits placed orders per IP per hour for everyone, and gives failed attempts their slot back', async () => {
    const a = guest();
    // Empty-cart and out-of-stock attempts must not use up the hour's slots.
    for (let i = 0; i < 3; i++) expect((await place(a)).status).toBe(409);
    for (let i = 0; i < 5; i++) {
      const res = await buy(guest(), { phone: `0192222222${i}` });
      expect(res.status).toBe(200);
    }
    const sixth = await buy(guest(), { phone: '01933333333' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe('TOO_MANY_ORDERS');

    const c = guest();
    await signupCustomer(app, c, '01712345678');
    const customer = await buy(c, { customer: true });
    expect(customer.status).toBe(429);
    expect(customer.body.code).toBe('TOO_MANY_ORDERS');
    expect(await prisma.order.count()).toBe(5);
  });

  it('takes the limits from the guest_orders setting', async () => {
    await setLimits({ maxOpenPerPhone: 1, dailyCapP: 2_000_000, perIpPerHour: 2 });
    const a = guest();
    expect((await buy(a)).status).toBe(200);
    expect((await buy(a)).body.code).toBe('GUEST_LIMIT');
    expect((await buy(guest(), { phone: '01922222222' })).status).toBe(200);
    expect((await buy(guest(), { phone: '01933333333' })).body.code).toBe('TOO_MANY_ORDERS');
  });

  it('a replay of an accepted order does not use another slot', async () => {
    const a = guest();
    const { variant } = await makeProduct(app, { stock: 20 });
    await addToCart(a, variant.id);
    const p = await places(app);
    const body = {
      address: { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'Road 1, House 2' },
      guest: { name: 'Karim', phone: '01811111111' },
      lang: 'en',
      idempotencyKey: 'same-key-for-replay',
    };
    for (let i = 0; i < 8; i++) await a.post('/v1/checkout/place').send(body).expect(200);
    expect(await prisma.order.count()).toBe(1);
  });

  it('re-checks the open-order limit inside the transaction when carts race', async () => {
    await setLimits({ maxOpenPerPhone: 2, dailyCapP: 2_000_000, perIpPerHour: 10 });
    const agents = [guest(), guest(), guest(), guest()];
    const { variant } = await makeProduct(app, { stock: 20 });
    for (const a of agents) await addToCart(a, variant.id);
    const results = await Promise.all(agents.map((a) => place(a)));
    const ok = results.filter((r) => r.status === 200);
    const refused = results.filter((r) => r.status === 429);
    expect(ok).toHaveLength(2);
    expect(refused).toHaveLength(2);
    expect(refused.every((r) => r.body.code === 'GUEST_LIMIT')).toBe(true);
    expect(await prisma.order.count()).toBe(2);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).reserved,
    ).toBe(2);
  });
});
