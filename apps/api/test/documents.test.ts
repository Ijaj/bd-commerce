import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InvoicesService, vatIncluded } from '../src/documents/invoices.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { makeProduct, resetCommerce, signupCustomer } from './cart-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

describe('vatIncluded', () => {
  it('extracts the VAT portion of a VAT-inclusive amount', () => {
    expect(vatIncluded(115_000, 1500)).toBe(15_000);
    expect(vatIncluded(100_000, 0)).toBe(0);
    // 1001 * 1500 / 11500 = 130.56 -> 131
    expect(vatIncluded(1001, 1500)).toBe(131);
    // 3 * 1500 / 11500 = 0.39 -> 0
    expect(vatIncluded(3, 1500)).toBe(0);
    expect(vatIncluded(0, 1500)).toBe(0);
  });
});

describe('documents: invoices + labels', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let settings: SettingsService;
  let invoices: InvoicesService;
  let admin: { id: string; agent: Agent };
  let n = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    settings = app.get(SettingsService);
    invoices = app.get(InvoicesService);
  });
  afterAll(() => app.close());

  async function actor(perms: Parameters<typeof createStaffWith>[1]) {
    const s = await createStaffWith(app, perms);
    const staff = await prisma.staff.findUniqueOrThrow({ where: { email: s.email } });
    return { id: staff.id, agent: s.agent };
  }

  beforeEach(async () => {
    await resetCommerce(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE invoices, shipment_items, shipments, courier_bookings CASCADE',
    );
    admin = await actor(['orders.view', 'shipments.manage']);
  });

  async function makeOrder(
    o: {
      customerId?: string;
      status?: 'processing' | 'delivered' | 'cancelled';
      grandTotalP?: number;
      cancelled?: number;
    } = {},
  ) {
    n += 1;
    const { product, variant } = await makeProduct(app, { priceP: 50_000 });
    const zone = await prisma.deliveryZone.findFirstOrThrow();
    const seller = await prisma.seller.findFirstOrThrow();
    const order = await prisma.order.create({
      data: {
        orderNo: `2610-9${String(n).padStart(4, '0')}`,
        customerId: o.customerId ?? null,
        guestName: o.customerId ? null : 'Guest Buyer',
        guestPhone: o.customerId ? null : '01811111111',
        lang: 'bn',
        shipName: 'Karim',
        shipPhone: '01799999999',
        shipDivisionId: 3,
        shipDistrictId: 47,
        shipUpazilaId: 1,
        shipPlaceText: 'Gulshan, Dhaka',
        shipLine: 'House 1, Road 2',
        shipLandmark: 'Near mosque',
        zoneId: zone.id,
        status: o.status ?? 'processing',
        subtotalP: 100_000,
        deliveryChargeP: 15_000,
        grandTotalP: o.grandTotalP ?? 115_000,
        codDueP: o.grandTotalP ?? 115_000,
        items: {
          create: {
            sellerId: seller.id,
            productId: product.id,
            variantId: variant.id,
            titleSnapshot: 'Blue Tee',
            sku: variant.sku,
            optionsText: 'Size: M',
            qty: 2,
            qtyCancelled: o.cancelled ?? 0,
            unitBaseP: 50_000,
            unitPriceP: 50_000,
            priceSource: 'base',
            lineTotalP: 100_000,
          },
        },
      },
      include: { items: true },
    });
    return order;
  }

  async function makeShipment(
    orderId: string,
    orderItemId: string,
    status: 'ready' | 'handed_over' = 'ready',
    consignmentId: string | null = null,
  ) {
    const seller = await prisma.seller.findFirstOrThrow();
    n += 1;
    return prisma.shipment.create({
      data: {
        orderId,
        shipmentNo: `SHP-2610-9${String(n).padStart(4, '0')}`,
        sellerId: seller.id,
        status,
        weightG: 1000,
        codAmountP: 115_000,
        consignmentId,
        note: 'Handle with care',
        items: { create: { orderItemId, qty: 2 } },
      },
    });
  }

  describe('InvoicesService', () => {
    it('issues once, idempotently, with VAT included and a frozen snapshot', async () => {
      await settings.set(
        'store_info',
        {
          name: 'Shop A',
          address: 'Dhaka',
          phone: '01700000000',
          email: 'a@x.test',
          bin: 'BIN-1',
          vatRateBp: 1500,
        },
        admin.id,
      );
      const order = await makeOrder();
      const [a, b] = await Promise.all([
        invoices.ensureIssued(order.id),
        invoices.ensureIssued(order.id),
      ]);
      expect(a.id).toBe(b.id);
      expect(a.invoiceNo).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(a.vatTotalP).toBe(15_000);
      expect(a.bin).toBe('BIN-1');
      expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);

      // Store info changes later; the issued invoice keeps its snapshot.
      await settings.set(
        'store_info',
        {
          name: 'Shop B',
          address: 'Ctg',
          phone: '01800000000',
          email: 'b@x.test',
          bin: 'BIN-2',
          vatRateBp: 500,
        },
        admin.id,
      );
      const res = await admin.agent.get(`/v1/admin/invoices/${a.id}`).expect(200);
      expect(res.body.store).toBeUndefined();
      expect(res.body.snapshot.store).toMatchObject({
        name: 'Shop A',
        bin: 'BIN-1',
        vatRateBp: 1500,
      });
      expect(res.body.vatRateBp).toBe(1500);
      expect(res.body.snapshot.vat).toEqual({ rateBp: 1500, totalP: 15_000, netP: 100_000 });
      expect(res.body.snapshot.lines).toEqual([
        {
          titleSnapshot: 'Blue Tee',
          sku: expect.any(String),
          optionsText: 'Size: M',
          qty: 2,
          unitPriceP: 50_000,
          lineTotalP: 100_000,
        },
      ]);
      expect(res.body.snapshot.billTo.name).toBe('Guest Buyer');
      expect(res.body.snapshot.shipTo).toEqual({
        name: 'Karim',
        phone: '01799999999',
        address: 'House 1, Road 2, Near mosque',
        placeText: 'Gulshan, Dhaka',
      });
      expect(res.body.snapshot.grandTotalP).toBe(115_000);
      expect(res.body.isCurrent).toBe(true);
    });

    it('handles a 0% VAT rate', async () => {
      await settings.set(
        'store_info',
        { name: 'S', address: '', phone: '', email: '', bin: '', vatRateBp: 0 },
        admin.id,
      );
      const order = await makeOrder({ grandTotalP: 100_001 });
      const inv = await invoices.ensureIssued(order.id);
      expect(inv.vatTotalP).toBe(0);
      expect(inv.bin).toBeNull();
    });

    it('rounds odd paisa and drops fully cancelled lines', async () => {
      const order = await makeOrder({ grandTotalP: 1001, cancelled: 2 });
      const inv = await invoices.ensureIssued(order.id);
      expect(inv.vatTotalP).toBe(131);
      const detail = await invoices.detail(inv.id);
      expect(detail.snapshot.lines).toEqual([]);
      expect(detail.snapshot.vat.netP).toBe(870);
    });

    it('uses active quantity for partly cancelled lines', async () => {
      const order = await makeOrder({ cancelled: 1 });
      const detail = await invoices.detail((await invoices.ensureIssued(order.id)).id);
      expect(detail.snapshot.lines[0]).toMatchObject({ qty: 1, lineTotalP: 50_000 });
    });

    it('reissue creates a new invoice and keeps the old one', async () => {
      const order = await makeOrder();
      const first = await invoices.ensureIssued(order.id);
      const res = await admin.agent
        .post(`/v1/admin/orders/${order.id}/invoice`)
        .send({ reissue: true })
        .expect(201);
      expect(res.body.id).not.toBe(first.id);
      expect(res.body.invoiceNo).not.toBe(first.invoiceNo);
      expect(res.body.isCurrent).toBe(true);
      // Without reissue the latest one comes back (also by order number).
      const again = await admin.agent
        .post(`/v1/admin/orders/${order.orderNo}/invoice`)
        .send({})
        .expect(201);
      expect(again.body.id).toBe(res.body.id);

      const list = await admin.agent.get(`/v1/admin/orders/${order.id}/invoices`).expect(200);
      expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([res.body.id, first.id]);
      expect(list.body.items.map((i: { isCurrent: boolean }) => i.isCurrent)).toEqual([
        true,
        false,
      ]);
    });

    it('refuses cancelled orders and unknown ids', async () => {
      const order = await makeOrder({ status: 'cancelled' });
      const res = await admin.agent
        .post(`/v1/admin/orders/${order.id}/invoice`)
        .send({})
        .expect(409);
      expect(res.body.code).toBe('INVOICE_NOT_AVAILABLE');
      const missing = await admin.agent
        .post('/v1/admin/orders/2610-00000/invoice')
        .send({})
        .expect(404);
      expect(missing.body.code).toBe('ORDER_NOT_FOUND');
      await admin.agent.get('/v1/admin/invoices/019a0000-0000-7000-8000-000000000000').expect(404);
      await admin.agent.get('/v1/admin/invoices/nope').expect(400);
    });

    it('joins a caller transaction', async () => {
      const order = await makeOrder();
      const inv = await prisma.$transaction((tx) => invoices.ensureIssued(order.id, tx));
      expect(inv.orderNo).toBe(order.orderNo);
      expect(await prisma.invoice.count({ where: { orderId: order.id } })).toBe(1);
    });
  });

  describe('customer invoice', () => {
    it('owner only, and only once goods have shipped', async () => {
      const agent = request.agent(app.getHttpServer());
      const customer = await signupCustomer(app, agent);
      const other = request.agent(app.getHttpServer());
      await signupCustomer(app, other, '01722222222');
      const order = await makeOrder({ customerId: customer.id });
      const url = `/v1/customer/orders/${order.orderNo}/invoice`;

      await request(app.getHttpServer()).get(url).expect(401);
      const early = await agent.get(url).expect(409);
      expect(early.body.code).toBe('INVOICE_NOT_AVAILABLE');
      await other.get(url).expect(404);
      expect(await prisma.invoice.count()).toBe(0);

      const item = order.items[0];
      if (!item) throw new Error('no item');
      await makeShipment(order.id, item.id, 'ready');
      await agent.get(url).expect(409);

      await prisma.shipment.updateMany({
        where: { orderId: order.id },
        data: { status: 'handed_over' },
      });
      const ok = await agent.get(url).expect(200);
      expect(ok.body.invoiceNo).toMatch(/^INV-/);
      expect(ok.body.snapshot.billTo.name).toBe('Rahim');
      expect(ok.body.snapshot.lang).toBe('bn');
      const again = await agent.get(url).expect(200);
      expect(again.body.id).toBe(ok.body.id);
      await other.get(url).expect(404);
    });

    it('is available for delivered orders without shipments', async () => {
      const agent = request.agent(app.getHttpServer());
      const customer = await signupCustomer(app, agent);
      const order = await makeOrder({ customerId: customer.id, status: 'delivered' });
      await agent.get(`/v1/customer/orders/${order.orderNo}/invoice`).expect(200);
    });
  });

  describe('labels', () => {
    it('returns print data with consignment barcode, falling back to the shipment no', async () => {
      const order = await makeOrder();
      const item = order.items[0];
      if (!item) throw new Error('no item');
      await settings.set(
        'store_info',
        {
          name: 'Shop A',
          address: 'Dhaka',
          phone: '01700000000',
          email: '',
          bin: '',
          vatRateBp: 1500,
        },
        admin.id,
      );
      const plain = await makeShipment(order.id, item.id, 'ready');
      const res = await admin.agent.get(`/v1/admin/shipments/${plain.id}/label`).expect(200);
      expect(res.body).toMatchObject({
        shipmentNo: plain.shipmentNo,
        orderNo: order.orderNo,
        barcodeValue: plain.shipmentNo,
        courier: null,
        consignmentId: null,
        store: { name: 'Shop A', phone: '01700000000' },
        to: {
          name: 'Karim',
          phone: '01799999999',
          address: 'House 1, Road 2, Near mosque',
          placeText: 'Gulshan, Dhaka',
        },
        codAmountP: 115_000,
        weightG: 1000,
        itemsText: `2× Blue Tee (${item.sku})`,
        note: 'Handle with care',
      });
      expect(Number.isNaN(Date.parse(res.body.printedAt))).toBe(false);

      const courier = await prisma.courier.findFirstOrThrow({ where: { code: 'steadfast' } });
      const booked = await makeShipment(order.id, item.id, 'ready', 'CID-777');
      await prisma.shipment.update({ where: { id: booked.id }, data: { courierId: courier.id } });
      const withCourier = await admin.agent
        .get(`/v1/admin/shipments/${booked.id}/label`)
        .expect(200);
      expect(withCourier.body.barcodeValue).toBe('CID-777');
      expect(withCourier.body.courier).toEqual({ code: 'steadfast', name: courier.name });
    });

    it('prints in bulk in request order, and fails on unknown ids', async () => {
      const order = await makeOrder();
      const item = order.items[0];
      if (!item) throw new Error('no item');
      const a = await makeShipment(order.id, item.id);
      const b = await makeShipment(order.id, item.id);
      const res = await admin.agent
        .post('/v1/admin/shipments/labels')
        .send({ ids: [b.id, a.id, b.id] })
        .expect(200);
      expect(res.body.map((l: { shipmentNo: string }) => l.shipmentNo)).toEqual([
        b.shipmentNo,
        a.shipmentNo,
      ]);
      const missing = '019a0000-0000-7000-8000-000000000000';
      const bad = await admin.agent
        .post('/v1/admin/shipments/labels')
        .send({ ids: [a.id, missing] })
        .expect(404);
      expect(bad.body).toMatchObject({ code: 'SHIPMENT_NOT_FOUND', missing: [missing] });
      await admin.agent.post('/v1/admin/shipments/labels').send({ ids: [] }).expect(400);
      await admin.agent
        .post('/v1/admin/shipments/labels')
        .send({ ids: Array.from({ length: 51 }, () => a.id) })
        .expect(400);
      await admin.agent.get(`/v1/admin/shipments/${missing}/label`).expect(404);
    });
  });

  describe('permissions', () => {
    it('gates every admin route', async () => {
      const order = await makeOrder();
      const item = order.items[0];
      if (!item) throw new Error('no item');
      const ship = await makeShipment(order.id, item.id);
      const inv = await invoices.ensureIssued(order.id);
      const viewer = await actor(['orders.view']);
      const nobody = await actor(['settings.view']);

      await viewer.agent.post(`/v1/admin/orders/${order.id}/invoice`).send({}).expect(403);
      await viewer.agent.get(`/v1/admin/shipments/${ship.id}/label`).expect(403);
      await viewer.agent
        .post('/v1/admin/shipments/labels')
        .send({ ids: [ship.id] })
        .expect(403);
      await viewer.agent.get(`/v1/admin/orders/${order.id}/invoices`).expect(200);
      await viewer.agent.get(`/v1/admin/invoices/${inv.id}`).expect(200);

      await nobody.agent.get(`/v1/admin/orders/${order.id}/invoices`).expect(403);
      await nobody.agent.get(`/v1/admin/invoices/${inv.id}`).expect(403);

      await request(app.getHttpServer()).get(`/v1/admin/invoices/${inv.id}`).expect(401);
      await request(app.getHttpServer()).get(`/v1/admin/shipments/${ship.id}/label`).expect(401);
    });
  });
});
