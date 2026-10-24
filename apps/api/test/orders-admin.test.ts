import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { addToCart, makeProduct, places, resetCommerce, signupCustomer } from './cart-fixtures';
import { type Agent, createApp, createOwner, createStaffWith } from './helpers';

describe('orders admin + call queue', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Awaited<ReturnType<typeof createOwner>>;
  let n = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetCommerce(app);
    owner = await createOwner(app);
    n = 0;
  });
  afterAll(() => app.close());

  const anon = () => request.agent(app.getHttpServer());
  const setCallQueue = (v: Record<string, unknown>) =>
    owner.agent
      .put('/v1/admin/settings/call_queue')
      .send({
        value: {
          codAboveP: 500_000,
          velocityCount: 3,
          velocityWindowHours: 24,
          firstGuest: true,
          ...v,
        },
      })
      .expect(204);

  async function place(
    a: Agent,
    o: {
      priceP?: number;
      qty?: number;
      guestPhone?: string;
      stock?: number;
      addrPhone?: string;
    } = {},
  ) {
    const { variant } = await makeProduct(app, {
      priceP: o.priceP ?? 50_000,
      stock: o.stock ?? 20,
    });
    await addToCart(a, variant.id, o.qty ?? 1);
    const p = await places(app);
    const res = await a
      .post('/v1/checkout/place')
      .send({
        address: {
          name: 'Karim',
          phone: o.addrPhone ?? '01811111111',
          ...p.dhaka,
          line: 'Road 1, House 2',
        },
        ...(o.guestPhone ? { guest: { name: 'Guest', phone: o.guestPhone } } : {}),
        lang: 'en',
        idempotencyKey: `oa-test-key-${n++}-${Math.random().toString(36).slice(2)}`,
      })
      .expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNo: res.body.orderNo } });
    return { order, variant };
  }

  const reasons = (o: { riskReasons: unknown }) => o.riskReasons as string[];
  const reload = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

  describe('risk assessment', () => {
    it('flags the first guest order and not a known guest phone', async () => {
      const first = await place(anon(), { guestPhone: '01712345678', addrPhone: '01712345678' });
      expect(reasons(first.order)).toEqual(['first_guest']);
      expect(first.order).toMatchObject({ riskScore: 10, callStatus: 'pending' });
      const again = await place(anon(), { guestPhone: '01712345678', addrPhone: '01712345678' });
      expect(reasons(again.order)).toEqual([]);
      expect(again.order).toMatchObject({ riskScore: 0, callStatus: 'not_needed' });
    });

    it('flags phone and IP velocity once the count is reached inside the window', async () => {
      await setCallQueue({ firstGuest: false, velocityCount: 2 });
      const guest = { guestPhone: '01712345678', addrPhone: '01712345678' };
      const a = await place(anon(), guest);
      expect(reasons(a.order)).toEqual([]);
      const b = await place(anon(), guest);
      expect(reasons(b.order).sort()).toEqual(['velocity_ip', 'velocity_phone']);
      expect(b.order.riskScore).toBe(20);

      // Outside the window the earlier orders no longer count.
      await prisma.order.updateMany({ data: { placedAt: new Date(Date.now() - 3 * 86_400_000) } });
      const c = await place(anon(), guest);
      expect(reasons(c.order)).toEqual([]);
    });

    it('flags high COD for a signed-in customer and respects the setting', async () => {
      await setCallQueue({ codAboveP: 200_000 });
      const a = anon();
      await signupCustomer(app, a, '01712345678');
      const big = await place(a, { priceP: 250_000 });
      expect(reasons(big.order)).toEqual(['cod_high']);
      expect(big.order.callStatus).toBe('pending');
      const small = await place(a, { priceP: 50_000 });
      expect(small.order).toMatchObject({ callStatus: 'not_needed', riskScore: 0 });
    });
  });

  describe('list + detail', () => {
    it('filters, searches and pages', async () => {
      await setCallQueue({ firstGuest: false, codAboveP: 10_000_000 });
      const a = anon();
      await signupCustomer(app, a, '01712345678');
      const o1 = await place(a, { qty: 2, addrPhone: '01722222222' });
      const o2 = await place(anon(), { guestPhone: '01933333333', addrPhone: '01933333333' });
      await prisma.order.update({
        where: { id: o1.order.id },
        data: { status: 'on_hold', riskScore: 10, callStatus: 'pending' },
      });
      await prisma.order.update({
        where: { id: o2.order.id },
        data: { placedAt: new Date('2026-03-10T10:00:00Z'), paymentStatus: 'paid' },
      });

      const get = (qs: string) => owner.agent.get(`/v1/admin/orders${qs}`).expect(200);
      const all = (await get('')).body;
      expect(all.total).toBe(2);
      expect(all.items.map((i: { orderNo: string }) => i.orderNo)).toEqual([
        o1.order.orderNo,
        o2.order.orderNo,
      ]);
      expect(all.items[0]).toMatchObject({
        id: o1.order.id,
        status: 'on_hold',
        callStatus: 'pending',
        riskScore: 10,
        customer: { name: 'Rahim', phone: '01712345678', isGuest: false },
        shipPlaceText: 'Gulshan, Dhaka',
        itemCount: 2,
        shipmentSummary: { total: 0, delivered: 0 },
      });
      expect(all.items[1].customer).toMatchObject({ name: 'Guest', isGuest: true });

      const ids = async (qs: string) => (await get(qs)).body.items.map((i: { id: string }) => i.id);
      expect(await ids('?status=on_hold')).toEqual([o1.order.id]);
      expect(await ids('?paymentStatus=paid')).toEqual([o2.order.id]);
      expect(await ids('?call=pending')).toEqual([o1.order.id]);
      expect(await ids('?risk=1')).toEqual([o1.order.id]);
      expect(await ids(`?q=${o2.order.orderNo.toLowerCase()}`)).toEqual([o2.order.id]);
      expect(await ids('?q=%2B8801933333333')).toEqual([o2.order.id]);
      expect(await ids('?q=0172222')).toEqual([o1.order.id]);
      expect(await ids('?q=guest')).toEqual([o2.order.id]);
      expect(await ids('?from=2026-03-10&to=2026-03-10')).toEqual([o2.order.id]);
      expect(await ids('?from=2026-03-11&to=2026-03-12')).toEqual([]);
      const p2 = (await get('?page=2&pageSize=1')).body;
      expect(p2).toMatchObject({ total: 2, page: 2, pageSize: 1 });
      expect(p2.items.map((i: { id: string }) => i.id)).toEqual([o2.order.id]);
      await owner.agent.get('/v1/admin/orders?pageSize=101').expect(400);
      await owner.agent.get('/v1/admin/orders?status=nope').expect(400);
    });

    it('shows the full order by uuid or order number', async () => {
      const a = anon();
      await signupCustomer(app, a, '01712345678');
      const { order, variant } = await place(a, { qty: 2 });
      const byId = (await owner.agent.get(`/v1/admin/orders/${order.id}`).expect(200)).body;
      const byNo = (await owner.agent.get(`/v1/admin/orders/${order.orderNo}`).expect(200)).body;
      expect(byNo).toEqual(byId);
      expect(byId).toMatchObject({
        orderNo: order.orderNo,
        status: 'processing',
        paymentMethod: 'cod',
        customer: { name: 'Rahim', isGuest: false },
        shipTo: { name: 'Karim', phone: '01811111111', line: 'Road 1, House 2' },
        money: {
          subtotalP: 100_000,
          deliveryChargeP: 6000,
          grandTotalP: 106_000,
          codDueP: 106_000,
        },
        risk: { score: 0, reasons: [] },
        call: { status: 'not_needed', note: null, staffName: null, at: null },
        shipments: [],
        invoices: [],
        returns: [],
        refunds: [],
      });
      expect(byId.items).toEqual([
        expect.objectContaining({
          variantId: variant.id,
          qty: 2,
          qtyCancelled: 0,
          qtyShipped: 0,
          qtyReturned: 0,
          image: null,
        }),
      ]);
      expect(byId.payments).toEqual([
        expect.objectContaining({ method: 'cod', amountP: 106_000, status: 'initiated' }),
      ]);
      expect(byId.history).toEqual([
        expect.objectContaining({ fromStatus: null, toStatus: 'processing', note: 'Order placed' }),
      ]);

      // A non-cancelled shipment counts toward qtyShipped; a cancelled one does not.
      const sid = await sellerId();
      const mk = (no: string, status: 'ready' | 'cancelled', qty: number) =>
        prisma.shipment.create({
          data: {
            orderId: order.id,
            shipmentNo: no,
            sellerId: sid,
            status,
            items: { create: { orderItemId: byId.items[0].id, qty } },
          },
        });
      await mk('SHP-T-1', 'ready', 1);
      await mk('SHP-T-2', 'cancelled', 1);
      const d = (await owner.agent.get(`/v1/admin/orders/${order.orderNo}`)).body;
      expect(d.items[0].qtyShipped).toBe(1);
      expect(d.shipments.map((s: { shipmentNo: string }) => s.shipmentNo)).toEqual([
        'SHP-T-1',
        'SHP-T-2',
      ]);

      await owner.agent.get('/v1/admin/orders/NOPE-0000').expect(404);
    });
  });

  async function sellerId() {
    return (await prisma.seller.findFirstOrThrow()).id;
  }

  describe('hold, resume, cancel', () => {
    it('holds and resumes, with state checks', async () => {
      const { order } = await place(anon(), { guestPhone: '01712345678' });
      const url = `/v1/admin/orders/${order.orderNo}`;
      await owner.agent.post(`${url}/resume`).expect(409);
      await owner.agent.post(`${url}/hold`).send({}).expect(400);
      const held = (
        await owner.agent.post(`${url}/hold`).send({ reason: 'Stock check' }).expect(200)
      ).body;
      expect(held.status).toBe('on_hold');
      expect(held.heldReason).toBe('Stock check');
      expect(held.history.at(-1)).toMatchObject({
        toStatus: 'on_hold',
        actorType: 'staff',
        actorName: 'Owner One',
        note: 'Stock check',
      });
      const again = await owner.agent.post(`${url}/hold`).send({ reason: 'x' }).expect(409);
      expect(again.body.code).toBe('ORDER_NOT_HOLDABLE');

      // Resume goes back through the shipments: one handed over -> partially_shipped.
      const { items } = (await owner.agent.get(url)).body;
      await prisma.orderItem.update({ where: { id: items[0].id }, data: { qty: 3 } });
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          shipmentNo: 'SHP-T-9',
          sellerId: await sellerId(),
          status: 'handed_over',
          items: { create: { orderItemId: items[0].id, qty: 1 } },
        },
      });
      const resumed = (await owner.agent.post(`${url}/resume`).expect(200)).body;
      expect(resumed.status).toBe('partially_shipped');
      expect(resumed.heldReason).toBeNull();
      const notOnHold = await owner.agent.post(`${url}/resume`).expect(409);
      expect(notOnHold.body.code).toBe('ORDER_NOT_ON_HOLD');
      await owner.agent.post('/v1/admin/orders/NOPE-1/hold').send({ reason: 'x' }).expect(404);
    });

    it('cancels: releases stock, cancels open shipments and initiated payments', async () => {
      const { order, variant } = await place(anon(), { guestPhone: '01712345678', qty: 3 });
      const inv = () => prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
      expect(await inv()).toMatchObject({ onHand: 20, reserved: 3 });
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          shipmentNo: 'SHP-T-5',
          sellerId: await sellerId(),
          status: 'ready',
          items: { create: { orderItemId: item.id, qty: 3 } },
        },
      });

      await owner.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({}).expect(400);
      const res = (
        await owner.agent
          .post(`/v1/admin/orders/${order.id}/cancel`)
          .send({ reason: 'Customer asked' })
          .expect(200)
      ).body;
      expect(res).toMatchObject({ status: 'cancelled', cancelReason: 'Customer asked' });
      expect(res.items[0]).toMatchObject({ qty: 3, qtyCancelled: 3 });
      expect(res.shipments[0].status).toBe('cancelled');
      expect(res.payments[0].status).toBe('cancelled');
      expect(res.history.at(-1)).toMatchObject({ toStatus: 'cancelled', note: 'Customer asked' });
      expect(await inv()).toMatchObject({ onHand: 20, reserved: 0 });
      const mv = await prisma.stockMovement.findMany({
        where: { variantId: variant.id, reason: 'order_release' },
      });
      expect(mv).toHaveLength(1);
      expect(mv[0]).toMatchObject({ reservedDelta: -3, refType: 'order', refId: order.id });

      const twice = await owner.agent
        .post(`/v1/admin/orders/${order.id}/cancel`)
        .send({ reason: 'again' })
        .expect(409);
      expect(twice.body.code).toBe('ORDER_NOT_CANCELLABLE');
      expect(await inv()).toMatchObject({ reserved: 0 });
    });

    it('cannot cancel once a shipment left, or while a courier booking is live', async () => {
      const a = await place(anon(), { guestPhone: '01712345678' });
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: a.order.id } });
      const sid = await sellerId();
      await prisma.shipment.create({
        data: {
          orderId: a.order.id,
          shipmentNo: 'SHP-T-6',
          sellerId: sid,
          status: 'handed_over',
          items: { create: { orderItemId: item.id, qty: 1 } },
        },
      });
      const r = await owner.agent
        .post(`/v1/admin/orders/${a.order.id}/cancel`)
        .send({ reason: 'late' })
        .expect(409);
      expect(r.body.code).toBe('SHIPMENT_SENT');
      expect((await reload(a.order.id)).status).toBe('processing');

      const b = await place(anon(), { guestPhone: '01712345679' });
      const itemB = await prisma.orderItem.findFirstOrThrow({ where: { orderId: b.order.id } });
      await prisma.shipment.create({
        data: {
          orderId: b.order.id,
          shipmentNo: 'SHP-T-7',
          sellerId: sid,
          status: 'booked',
          items: { create: { orderItemId: itemB.id, qty: 1 } },
        },
      });
      const r2 = await owner.agent
        .post(`/v1/admin/orders/${b.order.id}/cancel`)
        .send({ reason: 'x' })
        .expect(409);
      expect(r2.body.code).toBe('SHIPMENT_BOOKED');
      const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: b.variant.id } });
      expect(inv.reserved).toBe(1);
    });
  });

  describe('call queue', () => {
    it('lists pending oldest first, counts, and records outcomes', async () => {
      const o1 = await place(anon(), { guestPhone: '01711111111', addrPhone: '01711111111' });
      const o2 = await place(anon(), { guestPhone: '01722222222', addrPhone: '01722222222' });
      const o3 = await place(anon(), { guestPhone: '01733333333', addrPhone: '01733333333' });
      await prisma.order.update({
        where: { id: o1.order.id },
        data: { placedAt: new Date(Date.now() - 60_000) },
      });
      const q = (qs = '') => owner.agent.get(`/v1/admin/call-queue${qs}`).expect(200);
      const pending = (await q('?status=pending')).body;
      expect(pending.total).toBe(3);
      expect(pending.items[0]).toMatchObject({ id: o1.order.id, riskReasons: ['first_guest'] });
      expect((await owner.agent.get('/v1/admin/call-queue/count').expect(200)).body).toEqual({
        pending: 3,
      });

      const ok = (
        await owner.agent
          .post(`/v1/admin/orders/${o1.order.orderNo}/call`)
          .send({ outcome: 'confirmed', note: 'Spoke to him' })
          .expect(200)
      ).body;
      expect(ok.call).toMatchObject({
        status: 'confirmed',
        note: 'Spoke to him',
        staffName: 'Owner One',
      });
      expect(ok.call.at).toEqual(expect.any(String));
      expect(ok.status).toBe('processing');

      const again = await owner.agent
        .post(`/v1/admin/orders/${o1.order.id}/call`)
        .send({ outcome: 'unreachable' })
        .expect(409);
      expect(again.body.code).toBe('CALL_NOT_PENDING');

      const un = (
        await owner.agent
          .post(`/v1/admin/orders/${o2.order.id}/call`)
          .send({ outcome: 'unreachable' })
          .expect(200)
      ).body;
      expect(un.status).toBe('processing');
      expect(un.call.status).toBe('unreachable');

      // Cancelling by call cancels the order and releases stock.
      const cx = (
        await owner.agent
          .post(`/v1/admin/orders/${o3.order.id}/call`)
          .send({ outcome: 'cancelled', note: 'Did not order' })
          .expect(200)
      ).body;
      expect(cx).toMatchObject({ status: 'cancelled', cancelReason: 'Did not order' });
      expect(cx.call.status).toBe('cancelled');
      const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: o3.variant.id } });
      expect(inv.reserved).toBe(0);

      expect((await q('?status=pending')).body.total).toBe(0);
      expect((await owner.agent.get('/v1/admin/call-queue/count')).body).toEqual({ pending: 0 });
      const done = (await q('?status=done')).body;
      expect(done.total).toBe(3);
      expect(done.items.map((i: { callStatus: string }) => i.callStatus).sort()).toEqual([
        'cancelled',
        'confirmed',
        'unreachable',
      ]);
      // Most recent call first.
      expect(done.items[0].id).toBe(o3.order.id);
    });

    it('rolls the call outcome back when the order cannot be cancelled', async () => {
      const a = await place(anon(), { guestPhone: '01711111111' });
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: a.order.id } });
      await prisma.shipment.create({
        data: {
          orderId: a.order.id,
          shipmentNo: 'SHP-T-8',
          sellerId: await sellerId(),
          status: 'handed_over',
          items: { create: { orderItemId: item.id, qty: 1 } },
        },
      });
      const r = await owner.agent
        .post(`/v1/admin/orders/${a.order.id}/call`)
        .send({ outcome: 'cancelled' })
        .expect(409);
      expect(r.body.code).toBe('SHIPMENT_SENT');
      expect((await reload(a.order.id)).callStatus).toBe('pending');
    });

    it('hides cancelled orders from the pending queue', async () => {
      const a = await place(anon(), { guestPhone: '01711111111' });
      await owner.agent
        .post(`/v1/admin/orders/${a.order.id}/cancel`)
        .send({ reason: 'x' })
        .expect(200);
      expect((await owner.agent.get('/v1/admin/call-queue/count')).body).toEqual({ pending: 0 });
    });
  });

  describe('permissions', () => {
    it('guards every route', async () => {
      const { order } = await place(anon(), { guestPhone: '01712345678' });
      const url = `/v1/admin/orders/${order.id}`;
      await request(app.getHttpServer()).get('/v1/admin/orders').expect(401);
      await request(app.getHttpServer()).get('/v1/admin/call-queue/count').expect(401);

      const viewer = await createStaffWith(app, ['orders.view']);
      await viewer.agent.get('/v1/admin/orders').expect(200);
      await viewer.agent.get(url).expect(200);
      await viewer.agent.post(`${url}/hold`).send({ reason: 'x' }).expect(403);
      await viewer.agent.post(`${url}/resume`).expect(403);
      await viewer.agent.post(`${url}/cancel`).send({ reason: 'x' }).expect(403);
      await viewer.agent.post(`${url}/call`).send({ outcome: 'confirmed' }).expect(403);
      await viewer.agent.get('/v1/admin/call-queue').expect(403);
      await viewer.agent.get('/v1/admin/call-queue/count').expect(403);

      const caller = await createStaffWith(app, ['orders.call']);
      await caller.agent.get('/v1/admin/call-queue').expect(200);
      await caller.agent.get('/v1/admin/orders').expect(403);
      // Cancelling by call also needs orders.manage.
      await caller.agent.post(`${url}/call`).send({ outcome: 'cancelled' }).expect(403);
      expect((await reload(order.id)).callStatus).toBe('pending');
      await caller.agent.post(`${url}/call`).send({ outcome: 'confirmed' }).expect(200);

      const mgr = await createStaffWith(app, ['orders.manage', 'orders.view']);
      await mgr.agent.post(`${url}/hold`).send({ reason: 'x' }).expect(200);
    });
  });
});
