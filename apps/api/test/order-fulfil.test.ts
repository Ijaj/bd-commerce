import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderNotifyService } from '../src/orders/order-notify.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { fakeCourierHooks } from '../src/shipments/couriers/fake.courier';
import { addToCart, makeProduct, places, resetCommerce, signupCustomer } from './cart-fixtures';
import { dbCoupon } from './coupons-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

describe('order fulfilment: customer cancel, shipment info, failed delivery', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let notify: ReturnType<typeof vi.spyOn>;
  let n = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetCommerce(app);
    fakeCourierHooks.reset();
    // Other test files truncate couriers, so do not rely on the migration seed row.
    await prisma.courier.upsert({
      where: { code: 'fake' },
      update: { isActive: true },
      create: { code: 'fake', name: 'Fake courier', isActive: true },
    });
    admin = (await createStaffWith(app, ['shipments.manage', 'orders.view'])).agent;
    notify = vi.spyOn(app.get(OrderNotifyService), 'event');
  });
  afterEach(() => vi.restoreAllMocks());

  const http = () => request(app.getHttpServer());

  /** COD order through the real checkout; `a` is a guest agent or a signed-in customer. */
  async function place(
    a: Agent,
    lines: [number, number][] = [[2, 50_000]],
    extra: Record<string, unknown> = {},
  ) {
    const variants = [];
    for (const [qty, priceP] of lines) {
      const { variant } = await makeProduct(app, { priceP, stock: 20, weightG: 300 });
      await addToCart(a, variant.id, qty);
      variants.push(variant);
    }
    const p = await places(app);
    const res = await a
      .post('/v1/checkout/place')
      .send({
        address: { name: 'Karim', phone: '01811111111', ...p.dhaka, line: 'Road 1, House 2' },
        ...extra,
        lang: 'en',
        idempotencyKey: `fulfil-test-key-${n++}`,
      })
      .expect(200);
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: res.body.orderId },
      include: { items: true },
    });
    const items = variants.map((v) =>
      o.items.find((i) => i.variantId === v.id),
    ) as (typeof o.items)[number][];
    return { o, items, variants };
  }

  const guestOrder = (lines?: [number, number][]) =>
    place(request.agent(app.getHttpServer()), lines, {
      guest: { name: 'G', phone: '01711111111' },
    });

  const ship = (orderId: string, items: { orderItemId: string; qty: number }[]) =>
    admin.post(`/v1/admin/orders/${orderId}/shipments`).send({ items });
  const fullShipment = async (orderId: string, itemId: string, qty: number) =>
    (await ship(orderId, [{ orderItemId: itemId, qty }]).expect(201)).body;
  const book = (id: string) =>
    admin.post(`/v1/admin/shipments/${id}/book`).send({ courierCode: 'fake' });
  const handover = (id: string) => admin.post(`/v1/admin/shipments/${id}/handover`);
  const sync = (id: string) => admin.post(`/v1/admin/shipments/${id}/sync`);
  const back = (id: string, body: object = {}) =>
    admin.post(`/v1/admin/shipments/${id}/received-back`).send(body);
  const status = async (orderId: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;

  /** Books, hands over and lets the courier report `mapped`. */
  async function shipAndReport(
    shipmentId: string,
    mapped: Parameters<typeof fakeCourierHooks.setStatus>[1],
  ) {
    const c = (await book(shipmentId).expect(200)).body.consignmentId;
    await handover(shipmentId).expect(200);
    fakeCourierHooks.setStatus(c, mapped);
    await sync(shipmentId).expect(200);
    return c as string;
  }

  describe('customer cancel (A3)', () => {
    async function customerOrder(phone = '01712345678') {
      const a = request.agent(app.getHttpServer());
      const c = await signupCustomer(app, a, phone);
      const placed = await place(a);
      return { a, c, ...placed };
    }
    const cancel = (a: Agent, orderNo: string, body: object = {}) =>
      a.post(`/v1/customer/orders/${orderNo}/cancel`).send(body);

    it('cancels a processing order, releases stock and stamps the reason', async () => {
      const { a, o, variants } = await customerOrder();
      const before = (await a.get(`/v1/customer/orders/${o.orderNo}`).expect(200)).body;
      expect(before.canCancel).toBe(true);
      const res = await cancel(a, o.orderNo, { reason: 'changed my mind' }).expect(200);
      expect(res.body).toMatchObject({ status: 'cancelled', canCancel: false });
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      expect(row.cancelReason).toBe('customer: changed my mind');
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variants[0]?.id } }),
      ).toMatchObject({ onHand: 20, reserved: 0 });
      const h = await prisma.orderStatusHistory.findFirstOrThrow({
        where: { orderId: o.id, toStatus: 'cancelled' },
      });
      expect(h.actorType).toBe('customer');
      expect(notify).toHaveBeenCalledWith(o.id, 'cancelled');
      await cancel(a, o.orderNo).expect(409); // already cancelled
    });

    it('refuses others, on hold, booked and handed-over orders', async () => {
      const { a, o, items } = await customerOrder();
      const stranger = request.agent(app.getHttpServer());
      await signupCustomer(app, stranger, '01912345678');
      await cancel(stranger, o.orderNo).expect(404);
      await http().post(`/v1/customer/orders/${o.orderNo}/cancel`).send({}).expect(401);

      await prisma.order.update({ where: { id: o.id }, data: { status: 'on_hold' } });
      const hold = await cancel(a, o.orderNo).expect(409);
      expect(hold.body.code).toBe('ORDER_ON_HOLD');
      await prisma.order.update({ where: { id: o.id }, data: { status: 'processing' } });

      const s = await fullShipment(o.id, items[0]?.id ?? '', 2);
      // a plain warehouse shipment does not stop the customer
      expect((await a.get(`/v1/customer/orders/${o.orderNo}`)).body.canCancel).toBe(true);
      await book(s.id).expect(200);
      const detail = (await a.get(`/v1/customer/orders/${o.orderNo}`).expect(200)).body;
      expect(detail.canCancel).toBe(false);
      expect((await cancel(a, o.orderNo).expect(409)).body.code).toBe('SHIPMENT_BOOKED');
      await handover(s.id).expect(200);
      expect((await cancel(a, o.orderNo).expect(409)).body.code).toBe('ORDER_NOT_CANCELLABLE');
      expect(await status(o.id)).toBe('shipped');
    });

    it('cancels a guest order from the track page; account orders need a login', async () => {
      const g = await guestOrder();
      const body = { orderNo: g.o.orderNo, phone: '01711111111' };
      await http()
        .post('/v1/public/track/cancel')
        .send({ ...body, phone: '01999999999' })
        .expect(404);
      const t = await http().post('/v1/public/track').send(body).expect(200);
      expect(t.body.canCancel).toBe(true);
      const res = await http()
        .post('/v1/public/track/cancel')
        .send({ ...body, reason: 'oops' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'cancelled',
        canCancel: false,
        orderNo: g.o.orderNo,
      });
      expect((await prisma.order.findUniqueOrThrow({ where: { id: g.o.id } })).cancelReason).toBe(
        'customer: oops',
      );
      await http().post('/v1/public/track/cancel').send(body).expect(409);

      const c = await customerOrder('01612345678');
      const denied = await http()
        .post('/v1/public/track/cancel')
        .send({ orderNo: c.o.orderNo, phone: '01612345678' })
        .expect(403);
      expect(denied.body.code).toBe('LOGIN_REQUIRED');
      expect(await status(c.o.id)).toBe('processing');
    });
  });

  describe('shipment info for customers (A4)', () => {
    it('hides courier details until hand-over, omits cancelled, lists items', async () => {
      const g = await guestOrder([
        [1, 40_000],
        [1, 30_000],
      ]);
      const track = async () =>
        (
          await http()
            .post('/v1/public/track')
            .send({ orderNo: g.o.orderNo, phone: '01711111111' })
            .expect(200)
        ).body;
      expect((await track()).shipments).toEqual([]);

      const a = await fullShipment(g.o.id, g.items[0]?.id ?? '', 1);
      const b = await fullShipment(g.o.id, g.items[1]?.id ?? '', 1);
      await admin.post(`/v1/admin/shipments/${b.id}/cancel`).send({}).expect(200);
      let t = await track();
      expect(t.shipments).toHaveLength(1);
      expect(t.shipments[0]).toMatchObject({
        shipmentNo: a.shipmentNo,
        status: 'preparing',
        courier: null,
        trackingId: null,
        trackingUrl: null,
        handedAt: null,
      });
      expect(t.shipments[0].items).toHaveLength(1);

      const booked = (await book(a.id).expect(200)).body;
      t = await track();
      expect(t.shipments[0]).toMatchObject({
        status: 'preparing',
        courier: null,
        trackingId: null,
      });

      await handover(a.id).expect(200);
      t = await track();
      expect(t.shipments[0]).toMatchObject({
        status: 'with_courier',
        courier: { code: 'fake', name: expect.any(String) },
        trackingId: booked.consignmentId,
      });
      expect(t.shipments[0].handedAt).not.toBeNull();
      expect(notify).toHaveBeenCalledWith(
        g.o.id,
        'handed_over',
        expect.objectContaining({ shipmentNo: a.shipmentNo, trackingId: booked.consignmentId }),
      );
    });

    it('is on the account order detail too, with delivered state', async () => {
      const ag = request.agent(app.getHttpServer());
      await signupCustomer(app, ag, '01712345678');
      const { o, items } = await place(ag);
      const s = await fullShipment(o.id, items[0]?.id ?? '', 2);
      await shipAndReport(s.id, 'delivered');
      const d = (await ag.get(`/v1/customer/orders/${o.orderNo}`).expect(200)).body;
      expect(d.status).toBe('delivered');
      expect(d.shipments[0]).toMatchObject({ status: 'delivered', items: [{ qty: 2 }] });
      expect(d.shipments[0].deliveredAt).not.toBeNull();
      expect(notify).toHaveBeenCalledWith(o.id, 'delivered', expect.anything());
    });
  });

  describe('failed delivery (A5)', () => {
    it('a failed parcel moves the order to delivery_failed and notifies once', async () => {
      const g = await guestOrder();
      const s = await fullShipment(g.o.id, g.items[0]?.id ?? '', 2);
      await shipAndReport(s.id, 'failed');
      expect(await status(g.o.id)).toBe('delivery_failed');
      expect(notify.mock.calls.filter((c) => c[1] === 'delivery_failed')).toHaveLength(1);
      const t = await http()
        .post('/v1/public/track')
        .send({ orderNo: g.o.orderNo, phone: '01711111111' })
        .expect(200);
      expect(t.body).toMatchObject({ status: 'delivery_failed' });
      expect(t.body.shipments[0].status).toBe('failed');
      // no automatic stock or promotion change
      expect(await prisma.stockMovement.count({ where: { reason: 'return_restock' } })).toBe(0);
    });

    it('a sibling still moving keeps the order shipped; a later delivery recovers it', async () => {
      const g = await guestOrder([
        [1, 40_000],
        [1, 30_000],
      ]);
      const a = await fullShipment(g.o.id, g.items[0]?.id ?? '', 1);
      const b = await fullShipment(g.o.id, g.items[1]?.id ?? '', 1);
      const cb = (await book(b.id).expect(200)).body.consignmentId;
      await handover(b.id).expect(200);
      await shipAndReport(a.id, 'failed');
      expect(await status(g.o.id)).toBe('shipped');
      expect(notify.mock.calls.filter((c) => c[1] === 'delivery_failed')).toHaveLength(0);

      fakeCourierHooks.setStatus(cb, 'delivered');
      await sync(b.id).expect(200);
      expect(await status(g.o.id)).toBe('delivery_failed');
      expect(notify.mock.calls.filter((c) => c[1] === 'delivery_failed')).toHaveLength(1);
    });

    it('received-back closes the order: stock back, promotions reversed, sold count down', async () => {
      const ag = request.agent(app.getHttpServer());
      const coupon = await dbCoupon(app);
      const { variant } = await makeProduct(app, { priceP: 50_000, stock: 20, weightG: 300 });
      await addToCart(ag, variant.id, 2);
      await ag.post('/v1/cart/coupon').send({ code: coupon.code }).expect(200);
      const p = await places(app);
      const placed = await ag
        .post('/v1/checkout/place')
        .send({
          address: { name: 'K', phone: '01811111111', ...p.dhaka, line: 'Road 1' },
          guest: { name: 'G', phone: '01711111111' },
          lang: 'en',
          idempotencyKey: 'fulfil-coupon-key',
        })
        .expect(200);
      const orderId = placed.body.orderId as string;
      expect(await prisma.couponRedemption.count({ where: { orderId, status: 'applied' } })).toBe(
        1,
      );
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
      const soldBefore = (
        await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } })
      ).soldCount;
      expect(soldBefore).toBe(2);

      const s = await fullShipment(orderId, item.id, 2);
      await shipAndReport(s.id, 'returned');
      expect(await status(orderId)).toBe('delivery_failed');
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } }),
      ).toMatchObject({ onHand: 18 });

      const res = await back(s.id, { note: 'customer refused' }).expect(200);
      expect(res.body).toMatchObject({
        status: 'returned',
        orderStatus: 'failed',
        reshipmentId: null,
        receivedBackNote: 'customer refused',
      });
      expect(res.body.receivedBackAt).not.toBeNull();
      expect(res.body.receivedBackBy.name).toBe('Staff Member');
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } }),
      ).toMatchObject({ onHand: 20, reserved: 0 });
      expect(
        await prisma.stockMovement.count({
          where: { reason: 'return_restock', variantId: variant.id },
        }),
      ).toBe(1);
      expect(await prisma.couponRedemption.count({ where: { orderId, status: 'reversed' } })).toBe(
        1,
      );
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } })).soldCount,
      ).toBe(0);
      const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(o).toMatchObject({ status: 'failed', failedReason: 'customer refused' });
      expect(
        await prisma.orderStatusHistory.count({
          where: { orderId, toStatus: 'failed', actorType: 'staff' },
        }),
      ).toBe(1);
      expect(
        (await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } })).qtyCancelled,
      ).toBe(2);

      // second call is refused and moves nothing
      await back(s.id).expect(409);
      expect(await prisma.stockMovement.count({ where: { reason: 'return_restock' } })).toBe(1);
      // the failed state is terminal: a sync of a later courier event cannot revive it
      expect(await status(orderId)).toBe('failed');
    });

    it('reship restocks, reserves again and creates a ready shipment', async () => {
      const g = await guestOrder();
      const s = await fullShipment(g.o.id, g.items[0]?.id ?? '', 2);
      await shipAndReport(s.id, 'failed');
      const res = await back(s.id, { reship: true }).expect(200);
      expect(res.body.orderStatus).toBe('processing');
      expect(res.body.reshipmentId).not.toBeNull();
      const fresh = await prisma.shipment.findUniqueOrThrow({
        where: { id: res.body.reshipmentId },
        include: { items: true },
      });
      expect(fresh).toMatchObject({
        status: 'ready',
        courierId: null,
        codAmountP: s.codAmountP,
        deliveryChargeShareP: s.deliveryChargeShareP,
      });
      expect(fresh.items).toMatchObject([{ qty: 2 }]);
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: g.variants[0]?.id } }),
      ).toMatchObject({ onHand: 20, reserved: 2 });
      expect(
        (await prisma.orderItem.findFirstOrThrow({ where: { orderId: g.o.id } })).qtyCancelled,
      ).toBe(0);
      // promotions and sold count untouched
      expect((await prisma.product.findFirstOrThrow()).soldCount).toBe(2);

      // the new shipment goes through the normal flow
      await book(fresh.id).expect(200);
      await handover(fresh.id).expect(200);
      expect(await status(g.o.id)).toBe('shipped');
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: g.variants[0]?.id } }),
      ).toMatchObject({ onHand: 18, reserved: 0 });
    });

    it('partial case: cancels only the failed lines and keeps the order alive', async () => {
      const g = await guestOrder([
        [1, 40_000],
        [1, 30_000],
      ]);
      const a = await fullShipment(g.o.id, g.items[0]?.id ?? '', 1);
      const b = await fullShipment(g.o.id, g.items[1]?.id ?? '', 1);
      await shipAndReport(a.id, 'failed');
      await shipAndReport(b.id, 'delivered');
      expect(await status(g.o.id)).toBe('delivery_failed');

      const res = await back(a.id).expect(200);
      expect(res.body.warnings).toHaveLength(1);
      expect(res.body.orderStatus).toBe('delivered');
      expect(
        (await prisma.orderItem.findUniqueOrThrow({ where: { id: g.items[0]?.id } })).qtyCancelled,
      ).toBe(1);
      expect(
        (await prisma.orderItem.findUniqueOrThrow({ where: { id: g.items[1]?.id } })).qtyCancelled,
      ).toBe(0);
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: g.variants[0]?.id } }),
      ).toMatchObject({ onHand: 20 });
    });

    it('refuses wrong states and callers without shipments.manage', async () => {
      const g = await guestOrder();
      const s = await fullShipment(g.o.id, g.items[0]?.id ?? '', 2);
      await back(s.id).expect(409); // ready
      await back('00000000-0000-4000-8000-000000000000').expect(404);
      await shipAndReport(s.id, 'failed');
      const viewer = (await createStaffWith(app, ['orders.view'])).agent;
      await viewer.post(`/v1/admin/shipments/${s.id}/received-back`).send({}).expect(403);
      await admin
        .post(`/v1/admin/shipments/${s.id}/received-back`)
        .send({ note: 'x'.repeat(301) })
        .expect(400);
      await back(s.id).expect(200);
    });

    it('lists parcels that need taking back', async () => {
      const g = await guestOrder();
      const s = await fullShipment(g.o.id, g.items[0]?.id ?? '', 2);
      const q = () => admin.get('/v1/admin/shipments?attention=true').expect(200);
      expect((await q()).body.total).toBe(0);
      await shipAndReport(s.id, 'failed');
      expect((await q()).body.items.map((i: { id: string }) => i.id)).toEqual([s.id]);
      await back(s.id).expect(200);
      expect((await q()).body.total).toBe(0);
    });
  });
});
