import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct } from './cart-fixtures';
import { createApp, createOwner } from './helpers';
import { placeAs, resetPromos } from './promotions-engine-fixtures';

describe('admin orders: shipped qty, call queue, item count', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Awaited<ReturnType<typeof createOwner>>;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetPromos(app);
    owner = await createOwner(app);
  });
  afterAll(() => app.close());

  async function place(qty = 3) {
    const m = await makeProduct(app, { priceP: 50_000, stock: 20 });
    const a = request.agent(app.getHttpServer());
    await addToCart(a, m.variant.id, qty);
    const res = await placeAs(app, a);
    expect(res.status).toBe(200);
    return prisma.order.findUniqueOrThrow({
      where: { orderNo: res.body.orderNo },
      include: { items: true },
    });
  }

  it('qtyShipped counts only parcels out or delivered, never received-back ones', async () => {
    const order = await place(3);
    const item = order.items[0]?.id as string;
    const seller = await prisma.seller.findFirstOrThrow();
    const ship = (no: string, status: string, qty: number, receivedBackAt?: Date) =>
      prisma.shipment.create({
        data: {
          orderId: order.id,
          shipmentNo: no,
          sellerId: seller.id,
          status: status as never,
          receivedBackAt,
          items: { create: { orderItemId: item, qty } },
        },
      });
    const shipped = async () =>
      (await owner.agent.get(`/v1/admin/orders/${order.id}`).expect(200)).body.items[0].qtyShipped;

    await ship('S-1', 'ready', 3);
    await ship('S-2', 'booked', 3);
    expect(await shipped()).toBe(0);
    await ship('S-3', 'returned', 3, new Date());
    await ship('S-4', 'failed', 3);
    expect(await shipped()).toBe(0);
    await ship('S-5', 'handed_over', 1);
    await ship('S-6', 'delivered', 2);
    expect(await shipped()).toBe(3);
  });

  it('closed orders leave the call queue, its count and the pending badge', async () => {
    const open = await place(1);
    const cancelled = await place(1);
    const failed = await place(1);
    await prisma.order.updateMany({
      data: { callStatus: 'pending', riskScore: 10 },
    });
    await prisma.order.update({ where: { id: cancelled.id }, data: { status: 'cancelled' } });
    await prisma.order.update({ where: { id: failed.id }, data: { status: 'failed' } });

    const q = (await owner.agent.get('/v1/admin/call-queue').expect(200)).body;
    expect(q.items.map((i: { id: string }) => i.id)).toEqual([open.id]);
    expect((await owner.agent.get('/v1/admin/call-queue/count').expect(200)).body.pending).toBe(1);

    const list = (await owner.agent.get('/v1/admin/orders').expect(200)).body.items;
    const call = (id: string) => list.find((i: { id: string }) => i.id === id).callStatus;
    expect(call(open.id)).toBe('pending');
    expect(call(cancelled.id)).toBe('not_needed');
    expect(call(failed.id)).toBe('not_needed');
    const detail = (await owner.agent.get(`/v1/admin/orders/${failed.id}`).expect(200)).body;
    expect(detail.call.status).toBe('not_needed');
    const pending = (await owner.agent.get('/v1/admin/orders?call=pending').expect(200)).body;
    expect(pending.items.map((i: { id: string }) => i.id)).toEqual([open.id]);

    const r = await owner.agent
      .post(`/v1/admin/orders/${cancelled.id}/call`)
      .send({ outcome: 'confirmed' })
      .expect(409);
    expect(r.body.code).toBe('CALL_NOT_PENDING');
  });

  it('a cancelled order still shows what was ordered; a live one shows active units', async () => {
    const order = await place(3);
    const live = await place(2);
    await prisma.orderItem.update({
      where: { id: live.items[0]?.id as string },
      data: { qtyCancelled: 1 },
    });
    await owner.agent
      .post(`/v1/admin/orders/${order.id}/cancel`)
      .send({ reason: 'Customer asked' })
      .expect(200);

    const list = (await owner.agent.get('/v1/admin/orders').expect(200)).body.items;
    const count = (id: string) => list.find((i: { id: string }) => i.id === id).itemCount;
    expect(count(order.id)).toBe(3);
    expect(count(live.id)).toBe(1);

    const track = await request(app.getHttpServer())
      .post('/v1/public/track')
      .send({ orderNo: order.orderNo, phone: '01811111111' })
      .expect(200);
    expect(track.body).toMatchObject({ status: 'cancelled', itemCount: 3 });

    const cust = await prisma.customer.create({
      data: { name: 'Rahim', phone: '01712345678', passwordHash: 'x' } as never,
    });
    await prisma.order.update({ where: { id: order.id }, data: { customerId: cust.id } });
    const tab = (await owner.agent.get(`/v1/admin/customers/${cust.id}/orders`).expect(200)).body;
    expect(tab.items[0]).toMatchObject({ orderNo: order.orderNo, itemCount: 3 });
  });
});
