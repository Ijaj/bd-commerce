import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { fakeCourierHooks } from '../src/shipments/couriers/fake.courier';
import { mapPathaoStatus } from '../src/shipments/couriers/pathao.courier';
import { mapSteadfastStatus } from '../src/shipments/couriers/steadfast.courier';
import { addToCart, makeProduct, places, resetCommerce } from './cart-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

const SF_TOKEN = 'sf-hook-token';
const PATHAO_SECRET = 'pathao-hook-secret';

describe('shipments + couriers', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let n = 0;

  beforeAll(async () => {
    process.env.STEADFAST_API_KEY = 'sf-key';
    process.env.STEADFAST_SECRET_KEY = 'sf-secret';
    process.env.STEADFAST_WEBHOOK_TOKEN = SF_TOKEN;
    process.env.PATHAO_WEBHOOK_SECRET = PATHAO_SECRET;
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
    for (const k of [
      'STEADFAST_API_KEY',
      'STEADFAST_SECRET_KEY',
      'STEADFAST_WEBHOOK_TOKEN',
      'PATHAO_WEBHOOK_SECRET',
      'PATHAO_CLIENT_ID',
    ]) {
      delete process.env[k];
    }
  });
  beforeEach(async () => {
    await resetCommerce(app);
    fakeCourierHooks.reset();
    await prisma.courier.update({ where: { code: 'fake' }, data: { isActive: true } });
    admin = (await createStaffWith(app, ['shipments.manage', 'orders.view'])).agent;
  });
  afterEach(() => vi.restoreAllMocks());

  /** Guest COD order through the real checkout. `lines` = [qty, priceP] per product. */
  async function order(lines: [number, number][] = [[2, 50_000]]) {
    const guest = request.agent(app.getHttpServer());
    const variants = [];
    for (const [qty, priceP] of lines) {
      const { variant } = await makeProduct(app, { priceP, stock: 20, weightG: 300 });
      await addToCart(guest, variant.id, qty);
      variants.push(variant);
    }
    const p = await places(app);
    const res = await guest
      .post('/v1/checkout/place')
      .send({
        address: { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'Road 1, House 2' },
        guest: { name: 'G', phone: '01711111111' },
        lang: 'en',
        idempotencyKey: `shipments-test-key-${n++}`,
      })
      .expect(200);
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: res.body.orderId },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    // items come back by id order; map to the variants we added
    type Line = (typeof o.items)[number];
    const items = variants.map((v) => o.items.find((i) => i.variantId === v.id)) as [
      Line,
      Line,
      Line,
    ];
    const vs = variants as [(typeof variants)[number], (typeof variants)[number]];
    return { o, items, variants: vs };
  }

  const ship = (orderId: string, items: { orderItemId: string; qty: number }[], note?: string) =>
    admin.post(`/v1/admin/orders/${orderId}/shipments`).send({ items, note });
  const fullShipment = async (orderId: string, itemId: string, qty: number) =>
    (await ship(orderId, [{ orderItemId: itemId, qty }]).expect(201)).body;
  const book = (id: string, courierCode = 'fake') =>
    admin.post(`/v1/admin/shipments/${id}/book`).send({ courierCode });

  describe('creating shipments', () => {
    it('creates a ready shipment carrying the whole delivery charge and COD', async () => {
      const { o, items } = await order([[2, 50_000]]);
      const res = await ship(o.id, [{ orderItemId: items[0].id, qty: 2 }], 'fragile').expect(201);
      expect(res.body).toMatchObject({
        status: 'ready',
        orderNo: o.orderNo,
        codAmountP: o.codDueP,
        deliveryChargeShareP: o.deliveryChargeP - o.deliveryDiscountP,
        weightG: 600,
        note: 'fragile',
        source: 'warehouse',
        courier: null,
      });
      expect(res.body.shipmentNo).toMatch(/^SHP-\d{4}-\d{5}$/);
      expect(res.body.items).toHaveLength(1);
      // by order number too
      const list = await admin.get(`/v1/admin/orders/${o.orderNo}/shipments`).expect(200);
      expect(list.body.items).toHaveLength(1);
    });

    it('splits: charge on the first shipment, COD adds up to what is owed', async () => {
      const { o, items } = await order([
        [1, 40_000],
        [3, 30_000],
      ]);
      const a = await fullShipment(o.id, items[0].id, 1);
      const b = await fullShipment(o.id, items[1].id, 2);
      const c = await fullShipment(o.id, items[1].id, 1);
      const charge = o.deliveryChargeP - o.deliveryDiscountP;
      expect(a.deliveryChargeShareP).toBe(charge);
      expect(a.codAmountP).toBe(40_000 + charge);
      expect(b.deliveryChargeShareP).toBe(0);
      expect(b.codAmountP).toBe(60_000);
      expect(c.codAmountP).toBe(30_000);
      expect(a.codAmountP + b.codAmountP + c.codAmountP).toBe(o.codDueP);
    });

    it('shares order discounts pro rata and the last shipment takes the rounding', async () => {
      const { o, items } = await order([
        [1, 33_333],
        [1, 33_334],
      ]);
      await prisma.order.update({
        where: { id: o.id },
        data: {
          autoDiscountP: 10_001,
          grandTotalP: o.grandTotalP - 10_001,
          codDueP: o.codDueP - 10_001,
        },
      });
      const a = await fullShipment(o.id, items[0].id, 1);
      const b = await fullShipment(o.id, items[1].id, 1);
      const charge = o.deliveryChargeP - o.deliveryDiscountP;
      // 33333 of 66667 of (66667 - 10001) = 28332.9 -> 28333
      expect(a.codAmountP).toBe(28_333 + charge);
      expect(a.codAmountP + b.codAmountP).toBe(o.codDueP - 10_001);
    });

    it('rejects over-shipping, foreign lines, duplicates and bad order states', async () => {
      const { o, items } = await order([[2, 50_000]]);
      const other = await order([[1, 10_000]]);
      await ship(o.id, [{ orderItemId: items[0].id, qty: 3 }])
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('SHIPMENT_QTY_EXCEEDED'));
      await ship(o.id, [{ orderItemId: other.items[0].id, qty: 1 }])
        .expect(400)
        .expect((r) => expect(r.body.code).toBe('SHIPMENT_ITEM_INVALID'));
      await ship(o.id, [
        { orderItemId: items[0].id, qty: 1 },
        { orderItemId: items[0].id, qty: 1 },
      ]).expect(400);
      await ship(o.id, []).expect(400);
      await fullShipment(o.id, items[0].id, 2);
      await ship(o.id, [{ orderItemId: items[0].id, qty: 1 }]).expect(409);
      await prisma.order.update({ where: { id: other.o.id }, data: { status: 'on_hold' } });
      await ship(other.o.id, [{ orderItemId: other.items[0].id, qty: 1 }])
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('ORDER_NOT_SHIPPABLE'));
      await ship('00000000-0000-7000-8000-000000000000', [
        { orderItemId: items[0].id, qty: 1 },
      ]).expect(404);
    });

    it('cancelling a shipment frees its qty and hands the charge to the next one', async () => {
      const { o, items } = await order([[2, 50_000]]);
      const a = await fullShipment(o.id, items[0].id, 1);
      await admin.post(`/v1/admin/shipments/${a.id}/cancel`).send({}).expect(200);
      const b = await fullShipment(o.id, items[0].id, 2);
      expect(b.deliveryChargeShareP).toBe(o.deliveryChargeP - o.deliveryDiscountP);
      expect(b.codAmountP).toBe(o.codDueP);
      // cancelled shipment cannot be cancelled again
      await admin.post(`/v1/admin/shipments/${a.id}/cancel`).send({}).expect(409);
    });

    it('lists, filters and shows detail', async () => {
      const x = await order([[1, 50_000]]);
      const y = await order([[1, 20_000]]);
      const a = await fullShipment(x.o.id, x.items[0].id, 1);
      await fullShipment(y.o.id, y.items[0].id, 1);
      await book(a.id).expect(200);
      const all = await admin.get('/v1/admin/shipments').expect(200);
      expect(all.body.total).toBe(2);
      const booked = await admin.get('/v1/admin/shipments?status=booked').expect(200);
      expect(booked.body.items.map((s: { id: string }) => s.id)).toEqual([a.id]);
      const byCourier = await admin.get('/v1/admin/shipments?courier=fake').expect(200);
      expect(byCourier.body.total).toBe(1);
      const byQ = await admin.get(`/v1/admin/shipments?q=${y.o.orderNo}`).expect(200);
      expect(byQ.body.total).toBe(1);
      const oldest = await admin.get('/v1/admin/shipments?sort=oldest').expect(200);
      expect(oldest.body.items[0].id).toBe(a.id);
      const detail = await admin.get(`/v1/admin/shipments/${a.id}`).expect(200);
      expect(detail.body.bookings).toHaveLength(1);
      expect(detail.body.bookings[0]).toMatchObject({ courierCode: 'fake', status: 'booked' });
    });
  });

  describe('booking', () => {
    it('books with the fake courier, issues the invoice and records the booking', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      const res = await book(s.id).expect(200);
      expect(res.body).toMatchObject({
        status: 'booked',
        consignmentId: `FAKE-${s.shipmentNo}`,
        courier: { code: 'fake' },
      });
      expect(res.body.trackingUrl).toContain(`FAKE-${s.shipmentNo}`);
      const bookings = await prisma.courierBooking.findMany({ where: { shipmentId: s.id } });
      expect(bookings).toMatchObject([{ attempt: 1, status: 'booked', direction: 'delivery' }]);
      expect(await prisma.invoice.count({ where: { orderId: o.id } })).toBe(1);
      expect(fakeCourierHooks.booked[0]).toMatchObject({ codAmountP: o.codDueP });
      // only ready shipments can be booked
      await book(s.id).expect(409);
    });

    it('refuses inactive, unknown and unconfigured couriers', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      await prisma.courier.update({ where: { code: 'fake' }, data: { isActive: false } });
      await book(s.id)
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('COURIER_INACTIVE'));
      await book(s.id, 'nope')
        .expect(404)
        .expect((r) => expect(r.body.code).toBe('COURIER_NOT_FOUND'));
      // Pathao keys are not set in this suite
      await book(s.id, 'pathao')
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('COURIER_NOT_CONFIGURED'));
      expect(await prisma.courierBooking.count({ where: { shipmentId: s.id } })).toBe(0);
    });

    it('a failed booking keeps the shipment ready and the next attempt is numbered 2', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      fakeCourierHooks.failNextBook('courier down');
      const bad = await book(s.id).expect(502);
      expect(bad.body.code).toBe('COURIER_BOOK_FAILED');
      expect((await prisma.shipment.findUniqueOrThrow({ where: { id: s.id } })).status).toBe(
        'ready',
      );
      const failed = await prisma.courierBooking.findFirstOrThrow({ where: { shipmentId: s.id } });
      expect(failed).toMatchObject({ status: 'failed', attempt: 1 });
      expect(failed.response).toMatchObject({ error: 'courier down' });
      await book(s.id).expect(200);
      const all = await prisma.courierBooking.findMany({
        where: { shipmentId: s.id },
        orderBy: { attempt: 'asc' },
      });
      expect(all.map((b) => [b.attempt, b.status])).toEqual([
        [1, 'failed'],
        [2, 'booked'],
      ]);
    });

    it('does not book twice at once', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      const [r1, r2] = await Promise.all([book(s.id), book(s.id)]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      expect(
        await prisma.courierBooking.count({ where: { shipmentId: s.id, status: 'booked' } }),
      ).toBe(1);
    });

    it('rebook cancels the live booking, keeps history and may switch courier', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      await book(s.id).expect(200);
      const res = await admin.post(`/v1/admin/shipments/${s.id}/rebook`).send({}).expect(200);
      expect(res.body.consignmentId).toBe(`FAKE-${s.shipmentNo}-2`);
      expect(fakeCourierHooks.cancelled.has(`FAKE-${s.shipmentNo}`)).toBe(true);
      const rows = await prisma.courierBooking.findMany({
        where: { shipmentId: s.id },
        orderBy: { attempt: 'asc' },
      });
      expect(rows.map((b) => [b.attempt, b.status])).toEqual([
        [1, 'cancelled'],
        [2, 'booked'],
      ]);
    });

    it('cancelling a booked shipment cancels the booking; real couriers need manualCancel', async () => {
      const { o, items } = await order([
        [1, 50_000],
        [1, 20_000],
      ]);
      const a = await fullShipment(o.id, items[0].id, 1);
      const b = await fullShipment(o.id, items[1].id, 1);
      await book(a.id).expect(200);
      await admin.post(`/v1/admin/shipments/${a.id}/cancel`).send({}).expect(200);
      expect(fakeCourierHooks.cancelled.size).toBe(1);
      expect(
        await prisma.courierBooking.count({ where: { shipmentId: a.id, status: 'cancelled' } }),
      ).toBe(1);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({ status: 200, consignment: { consignment_id: 77, tracking_code: 'TC1' } }),
      );
      await book(b.id, 'steadfast').expect(200);
      const stuck = await admin.post(`/v1/admin/shipments/${b.id}/cancel`).send({}).expect(502);
      expect(stuck.body.code).toBe('COURIER_CANCEL_FAILED');
      await admin
        .post(`/v1/admin/shipments/${b.id}/cancel`)
        .send({ manualCancel: true })
        .expect(200);
    });

    it('is refused for a held order', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      await prisma.order.update({ where: { id: o.id }, data: { status: 'on_hold' } });
      await book(s.id)
        .expect(409)
        .expect((r) => expect(r.body.code).toBe('ORDER_NOT_SHIPPABLE'));
    });
  });

  describe('handover and stock', () => {
    it('handover books ship movements and moves the order along', async () => {
      const { o, items, variants } = await order([
        [1, 40_000],
        [2, 30_000],
      ]);
      const a = await fullShipment(o.id, items[0].id, 1);
      const b = await fullShipment(o.id, items[1].id, 2);
      await admin.post(`/v1/admin/shipments/${a.id}/handover`).expect(409); // not booked yet
      await book(a.id).expect(200);
      const h = await admin.post(`/v1/admin/shipments/${a.id}/handover`).expect(200);
      expect(h.body.status).toBe('handed_over');
      expect(h.body.handedAt).not.toBeNull();

      const inv = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: variants[0].id },
      });
      expect(inv).toMatchObject({ onHand: 19, reserved: 0 });
      const mv = await prisma.stockMovement.findMany({
        where: { variantId: variants[0].id, reason: 'ship' },
      });
      expect(mv).toMatchObject([
        { qtyDelta: -1, reservedDelta: -1, refType: 'order', refId: o.id, note: a.shipmentNo },
      ]);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
        'partially_shipped',
      );

      await book(b.id).expect(200);
      await admin.post(`/v1/admin/shipments/${b.id}/handover`).expect(200);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
        'shipped',
      );
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variants[1].id } }),
      ).toMatchObject({ onHand: 18, reserved: 0 });
      // second handover is refused and moves no stock
      await admin.post(`/v1/admin/shipments/${b.id}/handover`).expect(409);
      expect(await prisma.stockMovement.count({ where: { reason: 'ship' } })).toBe(2);
    });
  });

  describe('status sync', () => {
    it('in_transit from the courier also hands the parcel over; delivered collects the COD', async () => {
      const { o, items, variants } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      const booked = (await book(s.id).expect(200)).body;

      fakeCourierHooks.setStatus(booked.consignmentId, 'in_transit');
      const t = await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
      expect(t.body).toMatchObject({ mapped: 'in_transit', changed: true });
      expect(t.body.shipment.status).toBe('in_transit');
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variants[0].id } }),
      ).toMatchObject({ onHand: 18, reserved: 0 });
      expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
        'shipped',
      );

      // same status again: nothing changes, no duplicate event
      const again = await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
      expect(again.body.changed).toBe(false);

      fakeCourierHooks.setStatus(booked.consignmentId, 'delivered');
      const d = await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
      expect(d.body.shipment.status).toBe('delivered');
      expect(d.body.shipment.deliveredAt).not.toBeNull();

      const order2 = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(order2).toMatchObject({
        status: 'delivered',
        paymentStatus: 'paid',
        paidP: o.grandTotalP,
        codDueP: 0,
      });
      expect(order2.deliveredAt).not.toBeNull();
      const pays = await prisma.payment.findMany({ where: { orderId: o.id } });
      expect(pays).toMatchObject([
        {
          method: 'cod',
          purpose: 'full',
          status: 'success',
          amountP: o.grandTotalP,
          provider: 'fake',
        },
      ]);
      expect(pays[0]?.paidAt).not.toBeNull();

      const events = await prisma.courierStatusEvent.findMany({
        where: { booking: { shipmentId: s.id } },
        orderBy: { at: 'asc' },
      });
      expect(events.map((e) => e.rawStatus)).toEqual(['in_transit', 'delivered']);
      // delivered is final: a stray later status changes nothing
      fakeCourierHooks.setStatus(booked.consignmentId, 'returned');
      await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(409);
    });

    it('split deliveries collect COD shipment by shipment', async () => {
      const { o, items } = await order([
        [1, 40_000],
        [1, 30_000],
      ]);
      const a = await fullShipment(o.id, items[0].id, 1);
      const b = await fullShipment(o.id, items[1].id, 1);
      const ca = (await book(a.id).expect(200)).body.consignmentId;
      const cb = (await book(b.id).expect(200)).body.consignmentId;

      fakeCourierHooks.setStatus(ca, 'delivered');
      await admin.post(`/v1/admin/shipments/${a.id}/sync`).expect(200);
      let cur = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(cur).toMatchObject({
        paymentStatus: 'partially_paid',
        paidP: a.codAmountP,
        codDueP: o.grandTotalP - a.codAmountP,
        status: 'partially_shipped',
      });
      expect(
        await prisma.payment.findMany({
          where: { orderId: o.id },
          orderBy: { initiatedAt: 'asc' },
        }),
      ).toMatchObject([
        { status: 'initiated', amountP: o.grandTotalP - a.codAmountP },
        {
          status: 'success',
          purpose: 'balance',
          amountP: a.codAmountP,
          providerTxnId: a.shipmentNo,
        },
      ]);

      fakeCourierHooks.setStatus(cb, 'delivered');
      await admin.post(`/v1/admin/shipments/${b.id}/sync`).expect(200);
      cur = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(cur).toMatchObject({
        paymentStatus: 'paid',
        paidP: o.grandTotalP,
        codDueP: 0,
        status: 'delivered',
      });
      const pays = await prisma.payment.findMany({ where: { orderId: o.id, status: 'success' } });
      expect(pays.reduce((n, p) => n + p.amountP, 0)).toBe(o.grandTotalP);
      expect(await prisma.payment.count({ where: { orderId: o.id, status: 'initiated' } })).toBe(0);
    });

    it('failed and returned shipments collect nothing and never restock', async () => {
      const { o, items, variants } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      const c = (await book(s.id).expect(200)).body.consignmentId;
      await admin.post(`/v1/admin/shipments/${s.id}/handover`).expect(200);
      for (const [mapped, status] of [
        ['failed', 'failed'],
        ['returning', 'returning'],
        ['returned', 'returned'],
      ] as const) {
        fakeCourierHooks.setStatus(c, mapped);
        await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
        expect((await prisma.shipment.findUniqueOrThrow({ where: { id: s.id } })).status).toBe(
          status,
        );
      }
      const order2 = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(order2).toMatchObject({ paidP: 0, codDueP: o.grandTotalP, paymentStatus: 'unpaid' });
      expect(order2.status).toBe('shipped');
      expect(await prisma.stockMovement.count({ where: { reason: 'return_restock' } })).toBe(0);
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variants[0].id } }),
      ).toMatchObject({ onHand: 18 });
    });

    it('a courier-side cancel before pickup puts the shipment back in the queue', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      const c = (await book(s.id).expect(200)).body.consignmentId;
      fakeCourierHooks.setStatus(c, 'cancelled');
      await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
      const cur = await prisma.shipment.findUniqueOrThrow({ where: { id: s.id } });
      expect(cur).toMatchObject({ status: 'ready', consignmentId: null, courierId: null });
      await book(s.id).expect(200);
    });

    it('syncOpen polls every open shipment and reports problems', async () => {
      const { o, items } = await order([
        [1, 40_000],
        [1, 30_000],
      ]);
      const a = await fullShipment(o.id, items[0].id, 1);
      const b = await fullShipment(o.id, items[1].id, 1);
      const ca = (await book(a.id).expect(200)).body.consignmentId;
      await book(b.id).expect(200);
      fakeCourierHooks.setStatus(ca, 'in_transit');
      const { ShipmentSyncService } = await import('../src/shipments/shipment-sync.service');
      const r = await app.get(ShipmentSyncService).syncOpen();
      expect(r).toEqual({ checked: 2, updated: 1, errors: [] });
    });
  });

  describe('Steadfast adapter (mocked HTTP)', () => {
    it('sends the documented create_order request and maps the reply', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({
          status: 200,
          message: 'Consignment has been created successfully.',
          consignment: { consignment_id: 1424107, tracking_code: '15BAEB8A', status: 'in_review' },
        }),
      );
      const res = await book(s.id, 'steadfast').expect(200);
      expect(res.body).toMatchObject({
        consignmentId: '1424107',
        trackingUrl: 'https://steadfast.com.bd/t/15BAEB8A',
        courier: { code: 'steadfast' },
      });
      const [url, init] = spy.mock.calls[0] ?? [];
      expect(url).toBe('https://portal.packzy.com/api/v1/create_order');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({ 'Api-Key': 'sf-key', 'Secret-Key': 'sf-secret' });
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        invoice: s.shipmentNo,
        recipient_name: 'Karim',
        recipient_phone: '01811111111',
        cod_amount: o.codDueP / 100,
      });
      expect(body.recipient_address).toContain('Road 1, House 2');
    });

    it('keeps the shipment ready when Steadfast rejects the order', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({ message: 'invalid phone' }, { status: 422 }),
      );
      const r = await book(s.id, 'steadfast').expect(502);
      expect(r.body.message).toContain('422');
      expect(
        await prisma.courierBooking.findFirstOrThrow({ where: { shipmentId: s.id } }),
      ).toMatchObject({
        status: 'failed',
        response: { raw: { message: 'invalid phone' } },
      });
      // network failure is a booking failure too, never a 500
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
      await book(s.id, 'steadfast').expect(502);
    });

    it('pulls status_by_cid and maps delivery_status', async () => {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        Response.json({ status: 200, consignment: { consignment_id: 55 } }),
      );
      await book(s.id, 'steadfast').expect(200);
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json({ status: 200, delivery_status: 'delivered' }));
      const r = await admin.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
      expect(spy.mock.calls.at(-1)?.[0]).toBe('https://portal.packzy.com/api/v1/status_by_cid/55');
      expect(r.body).toMatchObject({ rawStatus: 'delivered', mapped: 'delivered' });
      expect(r.body.shipment.status).toBe('delivered');

      const x = await order();
      const s2 = await fullShipment(x.o.id, x.items[0].id, 2);
      spy.mockResolvedValueOnce(
        Response.json({ status: 200, consignment: { consignment_id: 56 } }),
      );
      await book(s2.id, 'steadfast').expect(200);
      spy.mockResolvedValue(Response.json({}, { status: 500 }));
      const bad = await admin.post(`/v1/admin/shipments/${s2.id}/sync`).expect(502);
      expect(bad.body.code).toBe('COURIER_SYNC_FAILED');
    });

    it('maps every documented status', () => {
      const m = mapSteadfastStatus;
      expect(m('pending')).toBe('booked');
      expect(m('in_review')).toBe('booked');
      expect(m('hold')).toBe('in_transit');
      expect(m('delivered')).toBe('delivered');
      expect(m('delivered_approval_pending')).toBe('delivered');
      expect(m('partial_delivered')).toBe('failed');
      expect(m('cancelled')).toBe('cancelled');
      expect(m('unknown')).toBeNull();
      expect(m('something_new')).toBeNull();
    });
  });

  describe('Pathao adapter (mocked HTTP)', () => {
    const keys = {
      PATHAO_CLIENT_ID: 'cid',
      PATHAO_CLIENT_SECRET: 'csecret',
      PATHAO_USERNAME: 'me@shop.test',
      PATHAO_PASSWORD: 'pw',
      PATHAO_STORE_ID: '4242',
    };

    it('gets a token, creates the order and maps the status', async () => {
      // the registry reads env at construction, so build a second app with Pathao keys
      Object.assign(process.env, keys);
      const app2 = await createApp();
      try {
        const prisma2 = app2.get(PrismaService);
        const { o, items } = await order();
        const s = await fullShipment(o.id, items[0].id, 2);
        const spy = vi
          .spyOn(globalThis, 'fetch')
          .mockResolvedValueOnce(Response.json({ access_token: 'tok', expires_in: 3600 }))
          .mockResolvedValueOnce(
            Response.json({
              code: 200,
              data: { consignment_id: 'DL121224VS8TTJ', order_status: 'Pending' },
            }),
          )
          .mockResolvedValueOnce(
            Response.json({
              code: 200,
              data: { consignment_id: 'DL121224VS8TTJ', order_status: 'Pickup' },
            }),
          );
        // use the app2 instance for the whole flow (its registry has the keys)
        const staff = await createStaffWith(app2, ['shipments.manage']);
        const res = await staff.agent
          .post(`/v1/admin/shipments/${s.id}/book`)
          .send({ courierCode: 'pathao' })
          .expect(200);
        expect(res.body.consignmentId).toBe('DL121224VS8TTJ');
        const [tokenUrl, tokenInit] = spy.mock.calls[0] ?? [];
        expect(tokenUrl).toBe('https://api-hermes.pathao.com/aladdin/api/v1/issue-token');
        expect(JSON.parse(String(tokenInit?.body))).toMatchObject({
          client_id: 'cid',
          username: 'me@shop.test',
          grant_type: 'password',
        });
        const [orderUrl, orderInit] = spy.mock.calls[1] ?? [];
        expect(orderUrl).toBe('https://api-hermes.pathao.com/aladdin/api/v1/orders');
        expect(orderInit?.headers).toMatchObject({ Authorization: 'Bearer tok' });
        expect(JSON.parse(String(orderInit?.body))).toMatchObject({
          store_id: 4242,
          merchant_order_id: s.shipmentNo,
          recipient_phone: '01811111111',
          delivery_type: 48,
          item_type: 2,
          item_weight: 0.6,
          amount_to_collect: o.codDueP / 100,
        });
        const sync = await staff.agent.post(`/v1/admin/shipments/${s.id}/sync`).expect(200);
        // token is cached: no second issue-token call
        expect(spy.mock.calls[2]?.[0]).toBe(
          'https://api-hermes.pathao.com/aladdin/api/v1/orders/DL121224VS8TTJ/info',
        );
        expect(sync.body).toMatchObject({ rawStatus: 'Pickup', mapped: 'handed_over' });
        expect(sync.body.shipment.status).toBe('handed_over');
        expect(await prisma2.stockMovement.count({ where: { reason: 'ship' } })).toBe(1);
      } finally {
        await app2.close();
        for (const k of Object.keys(keys)) delete process.env[k];
      }
    });

    it('maps statuses and webhook events', () => {
      const m = mapPathaoStatus;
      expect(m('Pending')).toBe('booked');
      expect(m('Pickup')).toBe('handed_over');
      expect(m('At the Sorting HUB')).toBe('in_transit');
      expect(m('Delivered')).toBe('delivered');
      expect(m('Partial Delivery')).toBe('failed');
      expect(m('Return')).toBe('returning');
      expect(m('Pickup Cancelled')).toBe('cancelled');
      expect(m('order.delivered')).toBe('delivered');
      expect(m('order.in-transit')).toBe('in_transit');
      expect(m('order.returned')).toBe('returned');
      expect(m('Exchange')).toBeNull();
    });
  });

  describe('webhooks', () => {
    async function steadfastBooked() {
      const { o, items } = await order();
      const s = await fullShipment(o.id, items[0].id, 2);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        Response.json({ status: 200, consignment: { consignment_id: 9001 } }),
      );
      await book(s.id, 'steadfast').expect(200);
      return { o, s };
    }
    const hook = (code: string, body: object, headers: Record<string, string> = {}) =>
      request(app.getHttpServer())
        .post(`/v1/public/courier-webhooks/${code}`)
        .set(headers)
        .send(body);

    it('rejects calls without the right secret and unknown couriers', async () => {
      const body = {
        notification_type: 'delivery_status',
        consignment_id: 9001,
        status: 'delivered',
      };
      await hook('steadfast', body).expect(401);
      await hook('steadfast', body, { Authorization: 'Bearer wrong' }).expect(401);
      await hook('steadfast', body, { Authorization: 'Bearer ' }).expect(401);
      await hook('pathao', { consignment_id: 'x' }, { 'x-pathao-signature': 'nope' }).expect(401);
      await hook('fake', body).expect(401);
      await hook('nothere', body).expect(404);
    });

    it('applies a Steadfast delivery notification', async () => {
      const { o, s } = await steadfastBooked();
      const res = await hook(
        'steadfast',
        {
          notification_type: 'delivery_status',
          consignment_id: 9001,
          invoice: s.shipmentNo,
          status: 'delivered',
        },
        { Authorization: `Bearer ${SF_TOKEN}` },
      ).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect((await prisma.shipment.findUniqueOrThrow({ where: { id: s.id } })).status).toBe(
        'delivered',
      );
      expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({
        status: 'delivered',
        paymentStatus: 'paid',
        codDueP: 0,
      });
      // retries are harmless
      await hook(
        'steadfast',
        { notification_type: 'delivery_status', consignment_id: 9001, status: 'delivered' },
        { Authorization: `Bearer ${SF_TOKEN}` },
      ).expect(200);
      expect(await prisma.payment.count({ where: { orderId: o.id, status: 'success' } })).toBe(1);
    });

    it('acknowledges unknown consignments, tracking updates and the Pathao ping', async () => {
      const auth = { Authorization: `Bearer ${SF_TOKEN}` };
      await hook(
        'steadfast',
        { notification_type: 'delivery_status', consignment_id: 424242, status: 'delivered' },
        auth,
      ).expect(200);
      await hook(
        'steadfast',
        { notification_type: 'tracking_update', consignment_id: 9001, tracking_message: 'hi' },
        auth,
      ).expect(200);
      await hook(
        'pathao',
        { event: 'webhook_integration' },
        { 'x-pathao-signature': PATHAO_SECRET },
      ).expect(200);
      await hook(
        'pathao',
        { event: 'order.delivered', consignment_id: 'ZZZ', order_status: 'Delivered' },
        { 'x-pathao-signature': PATHAO_SECRET },
      ).expect(200);
    });

    it('moves a shipment through hold-style events in order', async () => {
      const { s } = await steadfastBooked();
      const auth = { Authorization: `Bearer ${SF_TOKEN}` };
      await hook(
        'steadfast',
        { notification_type: 'delivery_status', consignment_id: 9001, status: 'hold' },
        auth,
      ).expect(200);
      expect((await prisma.shipment.findUniqueOrThrow({ where: { id: s.id } })).status).toBe(
        'in_transit',
      );
      const events = await prisma.courierStatusEvent.findMany({
        where: { booking: { shipmentId: s.id } },
      });
      expect(events).toMatchObject([{ rawStatus: 'hold', mappedStatus: 'in_transit' }]);
    });
  });

  describe('permissions', () => {
    it('needs a session and the right permission', async () => {
      const { o, items } = await order();
      const anon = request.agent(app.getHttpServer());
      await anon.get('/v1/admin/shipments').expect(401);
      await anon.post(`/v1/admin/orders/${o.id}/shipments`).send({}).expect(401);

      const viewer = (await createStaffWith(app, ['orders.view'])).agent;
      await viewer.get('/v1/admin/shipments').expect(403);
      await viewer
        .post(`/v1/admin/orders/${o.id}/shipments`)
        .send({ items: [{ orderItemId: items[0].id, qty: 1 }] })
        .expect(403);
      await viewer.get(`/v1/admin/orders/${o.id}/shipments`).expect(200);

      const packer = (await createStaffWith(app, ['shipments.manage'])).agent;
      await packer.get('/v1/admin/shipments').expect(200);
      await packer.get(`/v1/admin/orders/${o.id}/shipments`).expect(403);
      const s = await packer
        .post(`/v1/admin/orders/${o.id}/shipments`)
        .send({ items: [{ orderItemId: items[0].id, qty: 1 }] })
        .expect(201);
      await viewer
        .post(`/v1/admin/shipments/${s.body.id}/book`)
        .send({ courierCode: 'fake' })
        .expect(403);
      await viewer.post(`/v1/admin/shipments/${s.body.id}/sync`).expect(403);
    });
  });
});
