import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../src/mail/mail.service';
import { OrderNotifyService } from '../src/orders/order-notify.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { fakeCourierHooks } from '../src/shipments/couriers/fake.courier';
import { SmsService } from '../src/sms/sms.service';
import { addToCart, makeProduct, places, resetCommerce } from './cart-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

const PHONE = '01711111111';
const EMAIL = 'guest@example.com';

describe('order status notifications (A2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: SmsService;
  let mail: MailService;
  let admin: Agent;
  let n = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    sms = app.get(SmsService);
    mail = app.get(MailService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetCommerce(app);
    fakeCourierHooks.reset();
    await prisma.courier.upsert({
      where: { code: 'fake' },
      update: { isActive: true },
      create: { code: 'fake', name: 'Fake courier', isActive: true },
    });
    admin = (
      await createStaffWith(app, [
        'shipments.manage',
        'orders.view',
        'orders.manage',
        'orders.call',
        'orders.edit',
        'refunds.manage',
      ])
    ).agent;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app.get(SettingsService).set('order_notifications', allOn(), null);
  });

  const allOn = (over: Record<string, boolean> = {}) => ({
    confirmed: true,
    handedOver: true,
    delivered: true,
    cancelled: true,
    refundPaid: true,
    deliveryFailed: true,
    edited: true,
    ...over,
  });

  /** Guest COD order; the "placed" message is cleared so tests only see the event under test. */
  async function place(lang: 'en' | 'bn' = 'en', qty = 2) {
    const a = request.agent(app.getHttpServer());
    const { variant } = await makeProduct(app, { priceP: 50_000, stock: 20, weightG: 300 });
    await addToCart(a, variant.id, qty);
    const p = await places(app);
    const res = await a
      .post('/v1/checkout/place')
      .send({
        address: { name: 'Karim', phone: PHONE, ...p.dhaka, line: 'Road 1, House 2' },
        guest: { name: 'G', phone: PHONE, email: EMAIL },
        lang,
        idempotencyKey: `notify-test-key-${n++}`,
      })
      .expect(200);
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: res.body.orderId },
      include: { items: true },
    });
    sms.outbox.length = 0;
    mail.outbox.length = 0;
    return o;
  }

  const lastSms = () => sms.outbox.at(-1);
  const lastMail = () => mail.outbox.at(-1);
  const shipment = async (o: Awaited<ReturnType<typeof place>>, qty = 2) =>
    (
      await admin
        .post(`/v1/admin/orders/${o.id}/shipments`)
        .send({ items: [{ orderItemId: o.items[0]?.id, qty }] })
        .expect(201)
    ).body;
  const book = (id: string) =>
    admin.post(`/v1/admin/shipments/${id}/book`).send({ courierCode: 'fake' });
  const handover = (id: string) => admin.post(`/v1/admin/shipments/${id}/handover`);

  async function shipAndReport(
    shipmentId: string,
    mapped: Parameters<typeof fakeCourierHooks.setStatus>[1],
  ) {
    const c = (await book(shipmentId).expect(200)).body.consignmentId;
    await handover(shipmentId).expect(200);
    sms.outbox.length = 0;
    mail.outbox.length = 0;
    fakeCourierHooks.setStatus(c, mapped);
    await admin.post(`/v1/admin/shipments/${shipmentId}/sync`).expect(200);
    return c as string;
  }

  it('confirmed: only when staff confirm a call-queue order', async () => {
    const o = await place();
    await prisma.order.update({ where: { id: o.id }, data: { callStatus: 'pending' } });
    expect(sms.outbox).toHaveLength(0); // nothing for plain placement
    await admin.post(`/v1/admin/orders/${o.id}/call`).send({ outcome: 'confirmed' }).expect(200);
    expect(lastSms()).toMatchObject({ to: PHONE });
    expect(lastSms()?.text).toContain(`Order ${o.orderNo} is confirmed`);
    expect(lastMail()).toMatchObject({ to: EMAIL, subject: `Order ${o.orderNo} confirmed` });
  });

  it('confirmed: not sent for the unreachable outcome', async () => {
    const o = await place();
    await prisma.order.update({ where: { id: o.id }, data: { callStatus: 'pending' } });
    await admin.post(`/v1/admin/orders/${o.id}/call`).send({ outcome: 'unreachable' }).expect(200);
    expect(sms.outbox).toHaveLength(0);
  });

  it('handed_over: names the courier and tracking id', async () => {
    const o = await place();
    const s = await shipment(o);
    const c = (await book(s.id).expect(200)).body.consignmentId as string;
    sms.outbox.length = 0;
    await handover(s.id).expect(200);
    const text = lastSms()?.text ?? '';
    expect(text).toContain('handed to the courier with Fake courier');
    expect(text).toContain(c);
    expect(lastMail()?.to).toBe(EMAIL);
    expect(sms.outbox).toHaveLength(1); // one send, not one per code path
  });

  it('handed_over: Bangla order keeps tracking digits ASCII', async () => {
    const o = await place('bn');
    const s = await shipment(o);
    const c = (await book(s.id).expect(200)).body.consignmentId as string;
    sms.outbox.length = 0;
    await handover(s.id).expect(200);
    const text = lastSms()?.text ?? '';
    expect(text).toContain('কুরিয়ারে দেওয়া হয়েছে');
    expect(text).toContain(c);
    expect(text).toContain(`অর্ডার ${o.orderNo.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] ?? d)}`);
  });

  it('delivered: one message, names the parcel only when the order has several', async () => {
    const o = await place('en', 4);
    const s1 = await shipment(o, 2);
    await shipAndReport(s1.id, 'delivered');
    expect(sms.outbox).toHaveLength(1);
    expect(lastSms()?.text).toContain('has been delivered');
    expect(lastSms()?.text).not.toContain('parcel');

    const s2 = await shipment(o, 2);
    await shipAndReport(s2.id, 'delivered');
    expect(lastSms()?.text).toContain(`parcel ${s2.shipmentNo}`);
  });

  it('delivery_failed: parcel coming back', async () => {
    const o = await place();
    const s = await shipment(o);
    await shipAndReport(s.id, 'failed');
    expect(lastSms()?.text).toContain('could not deliver');
    expect(lastSms()?.text).toContain('we will contact you');
    expect(lastMail()?.subject).toContain('could not be delivered');
  });

  it('cancelled: staff cancel sends the plain text; delivery_failed reason sends the closed text', async () => {
    const o = await place();
    await admin.post(`/v1/admin/orders/${o.id}/cancel`).send({ reason: 'oos' }).expect(200);
    expect(lastSms()?.text).toBe(`Order ${o.orderNo} has been cancelled.`);

    sms.outbox.length = 0;
    await app.get(OrderNotifyService).event(o.id, 'cancelled', { reason: 'delivery_failed' });
    expect(lastSms()?.text).toContain('could not be delivered, so the order is closed');
  });

  it('cancelled: call-queue cancel notifies once', async () => {
    const o = await place();
    await prisma.order.update({ where: { id: o.id }, data: { callStatus: 'pending' } });
    await admin.post(`/v1/admin/orders/${o.id}/call`).send({ outcome: 'cancelled' }).expect(200);
    expect(sms.outbox).toHaveLength(1);
    expect(lastSms()?.text).toContain('has been cancelled');
  });

  it('edited: new total, and the edit row is stamped as notified', async () => {
    const o = await place();
    const res = await admin
      .post(`/v1/admin/orders/${o.id}/edit`)
      .send({ lines: [{ orderItemId: o.items[0]?.id, qty: 1 }] })
      .expect(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(lastSms()?.text).toContain(`Order ${o.orderNo} was changed`);
    expect(lastSms()?.text).toContain(
      `New total Tk ${(after.grandTotalP / 100).toLocaleString('en-US')}`,
    );
    const row = await prisma.orderEdit.findUniqueOrThrow({ where: { id: res.body.edit.id } });
    expect(row.customerNotifiedAt).not.toBeNull();
  });

  it('refund_paid: amount and method after a refund is completed', async () => {
    const o = await place();
    await prisma.order.update({ where: { id: o.id }, data: { paidP: o.grandTotalP } });
    const refund = await prisma.refund.create({
      data: { orderId: o.id, amountP: 25_000, method: 'original', status: 'approved' },
    });
    await admin.post(`/v1/admin/refunds/${refund.id}/complete`).send({}).expect(200);
    expect(lastSms()?.text).toBe(
      `Tk 250 has been refunded for order ${o.orderNo} to your original payment method.`,
    );
    expect(lastMail()?.to).toBe(EMAIL);
  });

  it('setting off: nothing is sent for that kind, other kinds still are', async () => {
    await app.get(SettingsService).set('order_notifications', allOn({ cancelled: false }), null);
    const o = await place();
    await admin.post(`/v1/admin/orders/${o.id}/cancel`).send({ reason: 'x' }).expect(200);
    expect(sms.outbox).toHaveLength(0);
    expect(mail.outbox).toHaveLength(0);
    await app.get(OrderNotifyService).event(o.id, 'edited', {});
    expect(sms.outbox).toHaveLength(1);
  });

  it('a failing SMS never breaks the transition', async () => {
    const o = await place();
    vi.spyOn(sms, 'send').mockImplementation(() => {
      throw new Error('gateway down');
    });
    await admin.post(`/v1/admin/orders/${o.id}/cancel`).send({ reason: 'x' }).expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
      'cancelled',
    );
    await expect(
      app.get(OrderNotifyService).event('00000000-0000-0000-0000-000000000000', 'delivered'),
    ).resolves.toBeUndefined();
  });
});
