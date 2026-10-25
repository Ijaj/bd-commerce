import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReturnsCompletionService } from '../src/returns/returns-completion.service';
import { SettingsService } from '../src/settings/settings.service';
import { makeProduct, resetCommerce, signupCustomer } from './cart-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

type Staff = { id: string; agent: Agent };

// Each test signs in several staff (slow password hashing); stay stable when other jobs load the box.
vi.setConfig({ testTimeout: 60_000 });

describe('returns and refunds', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let n = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  async function staffWith(perms: Parameters<typeof createStaffWith>[1]): Promise<Staff> {
    const s = await createStaffWith(app, perms);
    const row = await prisma.staff.findUniqueOrThrow({ where: { email: s.email } });
    return { id: row.id, agent: s.agent };
  }

  let ret: Staff;
  let refunder: Staff;
  let refunder2: Staff;

  beforeEach(async () => {
    await resetCommerce(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE refund_items, refunds, return_media, return_items, returns, shipment_items, shipments CASCADE',
    );
    ret = await staffWith(['returns.manage']);
    refunder = await staffWith(['refunds.manage', 'refunds.approve']);
    refunder2 = await staffWith(['refunds.manage', 'refunds.approve']);
  }, 60_000);

  let phones = 0;
  async function customer(phone = `0171${String(2_000_000 + ++phones).padStart(7, '0')}`) {
    const agent = request.agent(app.getHttpServer());
    const c = await signupCustomer(app, agent, phone);
    return { agent, id: c.id };
  }

  /**
   * Delivered order straight in the DB: line A 2 x 500.00, line B 1 x 300.00, coupon discount
   * 130.00 (10% of 1300.00 subtotal), delivery 60.00, fully paid in cash on delivery.
   */
  async function deliveredOrder(
    o: {
      customerId?: string;
      daysAgo?: number;
      windowA?: number | null;
      status?: 'delivered' | 'processing' | 'completed';
      coupon?: number;
      paid?: boolean;
    } = {},
  ) {
    n += 1;
    const a = await makeProduct(app, { priceP: 50_000 });
    const b = await makeProduct(app, { priceP: 30_000 });
    const zone = await prisma.deliveryZone.findFirstOrThrow();
    const coupon = o.coupon ?? 13_000;
    const grand = 130_000 - coupon + 6000;
    const paid = o.paid === false ? 0 : grand;
    // The order-level coupon is allocated to the lines (step 6): A takes its floored share, B the rest.
    const discA = Math.floor((100_000 * coupon) / 130_000);
    const deliveredAt = new Date(Date.now() - (o.daysAgo ?? 1) * 86_400_000);
    const order = await prisma.order.create({
      data: {
        orderNo: `2610-8${String(n).padStart(4, '0')}`,
        customerId: o.customerId ?? null,
        shipName: 'Karim',
        shipPhone: '01799999999',
        shipDivisionId: 3,
        shipDistrictId: 47,
        shipUpazilaId: 1,
        shipPlaceText: 'Gulshan, Dhaka',
        shipLine: 'Road 1',
        zoneId: zone.id,
        status: o.status ?? 'delivered',
        paymentStatus: paid ? 'paid' : 'unpaid',
        subtotalP: 130_000,
        couponDiscountP: coupon,
        deliveryChargeP: 6000,
        grandTotalP: grand,
        paidP: paid,
        codDueP: grand - paid,
        deliveredAt: (o.status ?? 'delivered') === 'processing' ? null : deliveredAt,
        items: {
          create: [
            line(a, 2, 50_000, o.windowA ?? null, discA),
            line(b, 1, 30_000, null, coupon - discA),
          ],
        },
      },
      include: { items: { orderBy: { unitPriceP: 'desc' } } },
    });
    const [itemA, itemB] = order.items as [(typeof order.items)[0], (typeof order.items)[0]];
    if (order.status !== 'processing') {
      const seller = await prisma.seller.findFirstOrThrow();
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          shipmentNo: `SHP-9999-${String(n).padStart(5, '0')}`,
          sellerId: seller.id,
          status: 'delivered',
          deliveredAt,
          items: {
            create: [
              { orderItemId: itemA.id, qty: 2 },
              { orderItemId: itemB.id, qty: 1 },
            ],
          },
        },
      });
    }
    return { order, itemA, itemB, variantA: a.variant, variantB: b.variant };

    function line(
      p: Awaited<ReturnType<typeof makeProduct>>,
      qty: number,
      price: number,
      window: number | null,
      discountP: number,
    ) {
      return {
        sellerId: p.product.sellerId,
        productId: p.product.id,
        variantId: p.variant.id,
        titleSnapshot: p.product.titleEn,
        sku: p.variant.sku,
        qty,
        unitBaseP: price,
        unitPriceP: price,
        priceSource: 'base',
        discountP,
        returnWindowDays: window,
        lineTotalP: price * qty,
      };
    }
  }

  const reqBody = (orderNo: string, items: { orderItemId: string; qty: number }[]) => ({
    orderNo,
    items: items.map((i) => ({ ...i, reason: 'defective' })),
  });

  describe('customer requests', () => {
    it('exposes orderItemId and returnableQty on the customer order, shrinking as returns are held', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      const before = await c.agent.get(`/v1/customer/orders/${o.order.orderNo}`).expect(200);
      const lineA = before.body.items.find(
        (i: { orderItemId: string }) => i.orderItemId === o.itemA.id,
      );
      expect(lineA.returnableQty).toBeGreaterThan(0);
      await c.agent
        .post('/v1/customer/returns')
        .send({
          orderNo: o.order.orderNo,
          items: [{ orderItemId: o.itemA.id, qty: 1, reason: 'damaged' }],
        })
        .expect(201);
      const after = await c.agent.get(`/v1/customer/orders/${o.order.orderNo}`).expect(200);
      const afterA = after.body.items.find(
        (i: { orderItemId: string }) => i.orderItemId === o.itemA.id,
      );
      expect(afterA.returnableQty).toBe(lineA.returnableQty - 1);
    });

    it('creates a requested return for my delivered order and lists it', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send({
          orderNo: o.order.orderNo,
          items: [{ orderItemId: o.itemA.id, qty: 1, reason: 'damaged', note: 'cracked' }],
        })
        .expect(201);
      expect(res.body).toMatchObject({
        orderNo: o.order.orderNo,
        status: 'requested',
        fault: null,
        items: [{ orderItemId: o.itemA.id, qty: 1, reason: 'damaged', note: 'cracked' }],
      });
      expect(res.body.returnNo).toMatch(/^RET-\d{4}-\d{5}$/);
      const list = await c.agent.get('/v1/customer/returns').expect(200);
      expect(list.body.total).toBe(1);
      const one = await c.agent.get(`/v1/customer/returns/${res.body.returnNo}`).expect(200);
      expect(one.body.returnNo).toBe(res.body.returnNo);
    });

    it('requires a session and hides other customers orders and returns', async () => {
      const c = await customer();
      const other = await customer('01912345678');
      const o = await deliveredOrder({ customerId: c.id });
      const body = reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]);
      await request(app.getHttpServer()).post('/v1/customer/returns').send(body).expect(401);
      const r1 = await other.agent.post('/v1/customer/returns').send(body).expect(404);
      expect(r1.body.code).toBe('ORDER_NOT_FOUND');
      const mine = await c.agent.post('/v1/customer/returns').send(body).expect(201);
      await other.agent.get(`/v1/customer/returns/${mine.body.returnNo}`).expect(404);
      expect((await other.agent.get('/v1/customer/returns').expect(200)).body.total).toBe(0);
    });

    it('refuses orders that are not delivered', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id, status: 'processing' });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]))
        .expect(409);
      expect(res.body.code).toBe('ORDER_NOT_DELIVERED');
    });

    it('enforces the window: default from settings, per-line override, counted from delivery', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id, daysAgo: 10, windowA: 30 });
      // Line A has a 30-day window, line B uses the 7-day default.
      await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]))
        .expect(201);
      const res = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemB.id, qty: 1 }]))
        .expect(409);
      expect(res.body).toMatchObject({ code: 'RETURN_WINDOW_CLOSED', windowDays: 7 });

      await app
        .get(SettingsService)
        .set('returns', { windowDays: 14, refundApprovalAboveP: 1 }, ret.id);
      await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemB.id, qty: 1 }]))
        .expect(201);
    });

    it('caps qty by delivered qty minus open returns, rejects duplicate and foreign lines', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      const other = await deliveredOrder({ customerId: c.id });
      const over = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 3 }]))
        .expect(409);
      expect(over.body).toMatchObject({ code: 'RETURN_QTY_EXCEEDED', available: 2 });
      await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]))
        .expect(201);
      const again = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 2 }]))
        .expect(409);
      expect(again.body).toMatchObject({ code: 'RETURN_QTY_EXCEEDED', available: 1 });
      await c.agent
        .post('/v1/customer/returns')
        .send(
          reqBody(o.order.orderNo, [
            { orderItemId: o.itemB.id, qty: 1 },
            { orderItemId: o.itemB.id, qty: 1 },
          ]),
        )
        .expect(400);
      await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: other.itemB.id, qty: 1 }]))
        .expect(400);
    });

    it('does not count units not delivered (shipment still in transit)', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      await prisma.shipment.updateMany({
        where: { orderId: o.order.id },
        data: { status: 'in_transit' },
      });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemB.id, qty: 1 }]))
        .expect(409);
      expect(res.body.code).toBe('RETURN_QTY_EXCEEDED');
    });

    it('rejects unknown media ids', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send({
          ...reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]),
          mediaIds: ['0197c0a0-0000-7000-8000-000000000000'],
        })
        .expect(400);
      expect(res.body.code).toBe('MEDIA_NOT_FOUND');
    });
  });

  describe('staff workflow', () => {
    async function requested(qtyA = 2, qtyB = 1) {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      const items = [{ orderItemId: o.itemA.id, qty: qtyA, reason: 'defective' }];
      if (qtyB) items.push({ orderItemId: o.itemB.id, qty: qtyB, reason: 'defective' });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send({ orderNo: o.order.orderNo, items })
        .expect(201);
      const row = await prisma.return.findUniqueOrThrow({ where: { returnNo: res.body.returnNo } });
      return { ...o, c, returnId: row.id, returnNo: res.body.returnNo as string };
    }

    it('lets staff create a return with window override and checks permissions', async () => {
      const o = await deliveredOrder({ daysAgo: 20 });
      const body = { items: [{ orderItemId: o.itemA.id, qty: 1, reason: 'other' }] };
      await ret.agent.post(`/v1/admin/orders/${o.order.id}/returns`).send(body).expect(409);
      const res = await ret.agent
        .post(`/v1/admin/orders/${o.order.orderNo}/returns`)
        .send({ ...body, windowOverride: true, note: 'VIP' })
        .expect(201);
      expect(res.body).toMatchObject({ status: 'requested', note: 'VIP', staffId: ret.id });
      expect(res.body.order.orderNo).toBe(o.order.orderNo);
      await refunder.agent.get('/v1/admin/returns').expect(403);
      await refunder.agent.post(`/v1/admin/orders/${o.order.id}/returns`).send(body).expect(403);
    });

    it('lists and filters', async () => {
      const r = await requested();
      await requested();
      const all = await ret.agent.get('/v1/admin/returns').expect(200);
      expect(all.body.total).toBe(2);
      const byNo = await ret.agent.get(`/v1/admin/returns?q=${r.returnNo}`).expect(200);
      expect(byNo.body.items.map((i: { id: string }) => i.id)).toEqual([r.returnId]);
      expect((await ret.agent.get('/v1/admin/returns?status=closed').expect(200)).body.total).toBe(
        0,
      );
      const d = await ret.agent.get(`/v1/admin/returns/${r.returnId}`).expect(200);
      expect(d.body.items).toHaveLength(2);
      // 10% coupon spread over the lines: 2 x 500.00 -> 900.00, 1 x 300.00 -> 270.00
      expect(d.body.items.map((i: { refundValueP: number }) => i.refundValueP).sort()).toEqual([
        27_000, 90_000,
      ]);
    });

    it('approve, receive, inspect with restock, close; moves stock and counts qtyReturned', async () => {
      const r = await requested(2, 1);
      const base = `/v1/admin/returns/${r.returnId}`;
      await ret.agent.post(`${base}/receive`).expect(409);
      const ap = await ret.agent
        .post(`${base}/approve`)
        .send({ fault: 'customer', returnShippingP: 8000 })
        .expect(200);
      expect(ap.body).toMatchObject({
        status: 'approved',
        fault: 'customer',
        returnShippingP: 8000,
      });
      await ret.agent.post(`${base}/approve`).send({ fault: 'ours' }).expect(409);
      await ret.agent.post(`${base}/pickup-booked`).send({ note: 'RedX tomorrow' }).expect(200);
      const rec = await ret.agent.post(`${base}/receive`).expect(200);
      expect(rec.body.status).toBe('received');
      await ret.agent.post(`${base}/close`).expect(409);

      const items = rec.body.items as { id: string; orderItemId: string }[];
      const idA = items.find((i) => i.orderItemId === r.itemA.id)?.id ?? '';
      const idB = items.find((i) => i.orderItemId === r.itemB.id)?.id ?? '';
      // restock only resellable
      await ret.agent
        .post(`${base}/inspect`)
        .send({
          items: [
            { returnItemId: idA, condition: 'damaged', restock: true },
            { returnItemId: idB, condition: 'damaged', restock: false },
          ],
        })
        .expect(400);
      // must cover every line
      await ret.agent
        .post(`${base}/inspect`)
        .send({ items: [{ returnItemId: idA, condition: 'resellable', restock: true }] })
        .expect(400);

      const onHandA = (
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: r.variantA.id } })
      ).onHand;
      const onHandB = (
        await prisma.inventory.findUniqueOrThrow({ where: { variantId: r.variantB.id } })
      ).onHand;
      const ins = await ret.agent
        .post(`${base}/inspect`)
        .send({
          items: [
            { returnItemId: idA, condition: 'resellable', restock: true },
            { returnItemId: idB, condition: 'damaged', restock: false },
          ],
        })
        .expect(200);
      expect(ins.body.status).toBe('inspected');
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: r.variantA.id } })).onHand,
      ).toBe(onHandA + 2);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: r.variantB.id } })).onHand,
      ).toBe(onHandB);
      const moves = await prisma.stockMovement.findMany({
        where: { refType: 'return', refId: r.returnId },
      });
      expect(moves).toHaveLength(1);
      expect(moves[0]).toMatchObject({ reason: 'return_restock', qtyDelta: 2, reservedDelta: 0 });
      const lines = await prisma.orderItem.findMany({ where: { orderId: r.order.id } });
      expect(lines.map((l) => l.qtyReturned).sort()).toEqual([1, 2]);

      // second inspect must not double-restock
      await ret.agent.post(`${base}/inspect`).send({ items: [] }).expect(400);
      await ret.agent
        .post(`${base}/inspect`)
        .send({
          items: [
            { returnItemId: idA, condition: 'resellable', restock: true },
            { returnItemId: idB, condition: 'damaged', restock: false },
          ],
        })
        .expect(409);
      const closed = await ret.agent.post(`${base}/close`).expect(200);
      expect(closed.body.status).toBe('closed');

      // everything came back: nothing left to return
      const again = await r.c.agent
        .post('/v1/customer/returns')
        .send(reqBody(r.order.orderNo, [{ orderItemId: r.itemA.id, qty: 1 }]))
        .expect(409);
      expect(again.body.code).toBe('RETURN_QTY_EXCEEDED');
    });

    it('fault ours stores no customer shipping; reject works once and records the reason', async () => {
      const r = await requested();
      const ap = await ret.agent
        .post(`/v1/admin/returns/${r.returnId}/approve`)
        .send({ fault: 'ours', returnShippingP: 9999 })
        .expect(200);
      expect(ap.body.returnShippingP).toBe(0);
      const r2 = await requested(1, 0);
      const rej = await ret.agent
        .post(`/v1/admin/returns/${r2.returnId}/reject`)
        .send({ reason: 'Used item' })
        .expect(200);
      expect(rej.body).toMatchObject({ status: 'rejected', rejectReason: 'Used item' });
      await ret.agent
        .post(`/v1/admin/returns/${r2.returnId}/reject`)
        .send({ reason: 'x' })
        .expect(409);
      // rejected return frees the qty again
      const c = r2.c;
      await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(r2.order.orderNo, [{ orderItemId: r2.itemA.id, qty: 2 }]))
        .expect(201);
      const mine = await c.agent.get(`/v1/customer/returns/${r2.returnNo}`).expect(200);
      expect(mine.body.rejectReason).toBe('Used item');
    });
  });

  describe('refunds', () => {
    async function inspectedReturn(fault: 'ours' | 'customer', shipP = 0, coupon?: number) {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id, coupon });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]))
        .expect(201);
      const row = await prisma.return.findUniqueOrThrow({ where: { returnNo: res.body.returnNo } });
      const base = `/v1/admin/returns/${row.id}`;
      await ret.agent.post(`${base}/approve`).send({ fault, returnShippingP: shipP }).expect(200);
      await ret.agent.post(`${base}/receive`).expect(200);
      const item = await prisma.returnItem.findFirstOrThrow({ where: { returnId: row.id } });
      await ret.agent
        .post(`${base}/inspect`)
        .send({ items: [{ returnItemId: item.id, condition: 'resellable', restock: true }] })
        .expect(200);
      return { ...o, returnId: row.id };
    }

    it('computes the amount pro-rata for discounts and deducts customer-paid return shipping', async () => {
      const r = await inspectedReturn('customer', 5000);
      // 1 x 500.00 with a 10% order discount = 450.00, minus 50.00 shipping
      const f = await refunder.agent
        .post(`/v1/admin/returns/${r.returnId}/refund`)
        .send({ method: 'original' })
        .expect(201);
      expect(f.body).toMatchObject({
        amountP: 40_000,
        status: 'approved',
        needsApproval: false,
        returnId: r.returnId,
        requestedBy: refunder.id,
        items: [{ orderItemId: r.itemA.id, qty: 1, amountP: 45_000 }],
      });
      const dup = await refunder.agent
        .post(`/v1/admin/returns/${r.returnId}/refund`)
        .send({ method: 'original' })
        .expect(409);
      expect(dup.body.code).toBe('REFUND_EXISTS');
    });

    it('uses the full line value when fault is ours and floors odd paisa', async () => {
      const r = await inspectedReturn('ours', 7000, 10_000);
      // Line A paid 100_000 - 7_692 (its share of the coupon) for 2 units -> 46_154 each; nothing deducted
      const f = await refunder.agent
        .post(`/v1/admin/returns/${r.returnId}/refund`)
        .send({ method: 'original' })
        .expect(201);
      expect(f.body.amountP).toBe(46_154);
    });

    it('needs an inspected return', async () => {
      const c = await customer();
      const o = await deliveredOrder({ customerId: c.id });
      const res = await c.agent
        .post('/v1/customer/returns')
        .send(reqBody(o.order.orderNo, [{ orderItemId: o.itemA.id, qty: 1 }]))
        .expect(201);
      const row = await prisma.return.findUniqueOrThrow({ where: { returnNo: res.body.returnNo } });
      const err = await refunder.agent
        .post(`/v1/admin/returns/${row.id}/refund`)
        .send({ method: 'original' })
        .expect(409);
      expect(err.body.code).toBe('RETURN_BAD_STATE');
    });

    it('sends refunds above the threshold for a second person, and completes them', async () => {
      await app
        .get(SettingsService)
        .set('returns', { windowDays: 7, refundApprovalAboveP: 40_000 }, ret.id);
      const r = await inspectedReturn('ours');
      const f = await refunder.agent
        .post(`/v1/admin/returns/${r.returnId}/refund`)
        .send({ method: 'original', note: 'ok' })
        .expect(201);
      expect(f.body).toMatchObject({
        amountP: 45_000,
        status: 'pending_approval',
        needsApproval: true,
      });
      const id = f.body.id as string;
      await refunder.agent.post(`/v1/admin/refunds/${id}/complete`).send({}).expect(409);
      const same = await refunder.agent.post(`/v1/admin/refunds/${id}/approve`).expect(409);
      expect(same.body.code).toBe('SAME_STAFF');
      // plain refunds.manage cannot approve
      await ret.agent.post(`/v1/admin/refunds/${id}/approve`).expect(403);
      const ap = await refunder2.agent.post(`/v1/admin/refunds/${id}/approve`).expect(200);
      expect(ap.body).toMatchObject({
        status: 'approved',
        approvedBy: refunder2.id,
        approvedByName: 'Staff Member',
      });
      await refunder2.agent.post(`/v1/admin/refunds/${id}/approve`).expect(409);
      const done = await refunder.agent
        .post(`/v1/admin/refunds/${id}/complete`)
        .send({ providerRef: 'BKASH-1' })
        .expect(200);
      expect(done.body).toMatchObject({ status: 'done', providerRef: 'BKASH-1' });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } });
      expect(order).toMatchObject({ refundedP: 45_000, paymentStatus: 'partially_refunded' });
      await refunder.agent.post(`/v1/admin/refunds/${id}/complete`).send({}).expect(409);

      const list = await refunder.agent.get('/v1/admin/refunds?status=done').expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].orderNo).toBe(r.order.orderNo);
    });

    it('rejects a pending refund and frees the return for a new refund', async () => {
      await app
        .get(SettingsService)
        .set('returns', { windowDays: 7, refundApprovalAboveP: 0 }, ret.id);
      const r = await inspectedReturn('ours');
      const f = await refunder.agent
        .post(`/v1/admin/returns/${r.returnId}/refund`)
        .send({ method: 'original' })
        .expect(201);
      const rej = await refunder2.agent
        .post(`/v1/admin/refunds/${f.body.id}/reject`)
        .send({ reason: 'Not eligible' })
        .expect(200);
      expect(rej.body.status).toBe('rejected');
      expect(rej.body.note).toContain('Not eligible');
      await refunder.agent
        .post(`/v1/admin/returns/${r.returnId}/refund`)
        .send({ method: 'original' })
        .expect(201);
    });

    it('a full wallet refund marks the order refunded and notes the missing wallet ledger', async () => {
      const o = await deliveredOrder({ coupon: 0 }); // paid 1360.00 = 1300.00 + 60.00 delivery
      const url = `/v1/admin/orders/${o.order.orderNo}/refund`;
      const over = await refunder.agent
        .post(url)
        .send({ amountP: 136_001, method: 'wallet', note: 'Cancelled and prepaid' })
        .expect(409);
      expect(over.body).toMatchObject({ code: 'REFUND_EXCEEDS_PAID', maxAmountP: 136_000 });
      const f = await refunder.agent
        .post(url)
        .send({ amountP: 136_000, method: 'wallet', note: 'Cancelled and prepaid' })
        .expect(201);
      // above the default 3000.00 threshold? no: approved straight away
      expect(f.body.status).toBe('approved');
      await refunder.agent.post(`/v1/admin/refunds/${f.body.id}/complete`).send({}).expect(200);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: o.order.id } });
      expect(order).toMatchObject({ refundedP: 136_000, paymentStatus: 'refunded' });
    });

    it('order refunds: by lines or explicit amount, capped by paid minus refunded', async () => {
      const o = await deliveredOrder(); // paid 1230.00
      const body = (extra: object) => ({ method: 'wallet', note: 'goodwill', ...extra });
      const url = `/v1/admin/orders/${o.order.id}/refund`;
      await refunder.agent.post(url).send(body({})).expect(400);
      const lines = await refunder.agent
        .post(url)
        .send(body({ items: [{ orderItemId: o.itemB.id, qty: 1 }] }))
        .expect(201);
      expect(lines.body).toMatchObject({ amountP: 27_000, returnId: null, status: 'approved' });
      await refunder.agent.post(`/v1/admin/refunds/${lines.body.id}/complete`).send({}).expect(200);
      const done = await prisma.refund.findUniqueOrThrow({ where: { id: lines.body.id } });
      expect(done.note).toContain('Wallet credit');
      // the same unit cannot be refunded twice
      const twice = await refunder.agent
        .post(url)
        .send(body({ items: [{ orderItemId: o.itemB.id, qty: 1 }] }))
        .expect(409);
      expect(twice.body.code).toBe('REFUND_INVALID');
      // explicit amount, capped: 1230.00 - 270.00 = 960.00 left
      const over = await refunder.agent
        .post(url)
        .send(body({ amountP: 96_001 }))
        .expect(409);
      expect(over.body).toMatchObject({ code: 'REFUND_EXCEEDS_PAID', maxAmountP: 96_000 });
      // an outstanding refund also holds back its share
      const rest = await refunder.agent
        .post(url)
        .send(body({ amountP: 96_000 }))
        .expect(201);
      await refunder.agent
        .post(url)
        .send(body({ amountP: 1 }))
        .expect(409);
      await refunder.agent.post(`/v1/admin/refunds/${rest.body.id}/complete`).send({}).expect(200);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: o.order.id } });
      expect(order).toMatchObject({ refundedP: 123_000, paymentStatus: 'refunded' });
    });

    it('cannot refund an unpaid (COD, not collected) order', async () => {
      const o = await deliveredOrder({ paid: false });
      const res = await refunder.agent
        .post(`/v1/admin/orders/${o.order.id}/refund`)
        .send({ amountP: 100, method: 'original', note: 'x' })
        .expect(409);
      expect(res.body.code).toBe('REFUND_EXCEEDS_PAID');
    });

    it('checks permissions and 404s', async () => {
      const o = await deliveredOrder();
      const url = `/v1/admin/orders/${o.order.id}/refund`;
      const body = { amountP: 100, method: 'original', note: 'x' };
      await ret.agent.post(url).send(body).expect(403);
      await ret.agent.get('/v1/admin/refunds').expect(403);
      await refunder.agent.post('/v1/admin/orders/2610-00000/refund').send(body).expect(404);
      await refunder.agent
        .get('/v1/admin/refunds/0197c0a0-0000-7000-8000-000000000000')
        .expect(404);
      await refunder.agent
        .get('/v1/admin/returns/0197c0a0-0000-7000-8000-000000000000')
        .expect(403);
    });
  });

  describe('order completion', () => {
    it('completes delivered orders after the window, but not with an open return', async () => {
      const completion = app.get(ReturnsCompletionService);
      const fresh = await deliveredOrder({ daysAgo: 1 });
      const old = await deliveredOrder({ daysAgo: 10 });
      const longWindow = await deliveredOrder({ daysAgo: 10, windowA: 30 });
      const openReturn = await deliveredOrder({ daysAgo: 10 });
      await ret.agent
        .post(`/v1/admin/orders/${openReturn.order.id}/returns`)
        .send({
          items: [{ orderItemId: openReturn.itemA.id, qty: 1, reason: 'other' }],
          windowOverride: true,
        })
        .expect(201);
      const closedReturn = await deliveredOrder({ daysAgo: 10 });
      const cr = await prisma.return.create({
        data: { returnNo: 'RET-2610-99999', orderId: closedReturn.order.id, status: 'closed' },
      });
      expect(cr.id).toBeTruthy();

      expect(await completion.completeDue()).toBe(2);
      const status = async (id: string) =>
        (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(fresh.order.id)).toBe('delivered');
      expect(await status(old.order.id)).toBe('completed');
      expect(await status(longWindow.order.id)).toBe('delivered');
      expect(await status(openReturn.order.id)).toBe('delivered');
      expect(await status(closedReturn.order.id)).toBe('completed');
      const row = await prisma.order.findUniqueOrThrow({ where: { id: old.order.id } });
      expect(row.completedAt).not.toBeNull();
      const hist = await prisma.orderStatusHistory.findFirst({
        where: { orderId: old.order.id, toStatus: 'completed' },
      });
      expect(hist?.fromStatus).toBe('delivered');
      // idempotent
      expect(await completion.completeDue()).toBe(0);
      // later, once the long window passes
      expect(await completion.completeDue(new Date(Date.now() + 40 * 86_400_000))).toBe(2);
    });
  });
});
