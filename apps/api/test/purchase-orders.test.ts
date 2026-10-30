import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  dhakaToday,
  dhakaYymm,
  weightedAverageCost,
} from '../src/purchasing/purchase-orders/po.util';
import { makeProduct, resetCommerce } from './cart-fixtures';
import { type Agent, createStaffWith } from './helpers';

vi.setConfig({ testTimeout: 60_000 });

describe('weighted average cost (C64)', () => {
  it('uses the PO price with no old cost or nothing on hand', () => {
    expect(weightedAverageCost(null, 10, 5, 700)).toBe(700);
    expect(weightedAverageCost(500, 0, 5, 700)).toBe(700);
    expect(weightedAverageCost(500, -3, 5, 700)).toBe(700);
  });
  it('blends by quantity and rounds half up', () => {
    expect(weightedAverageCost(1000, 10, 10, 2000)).toBe(1500);
    // (3 x 1000 + 1 x 1002) / 4 = 1000.5 -> 1001
    expect(weightedAverageCost(1000, 3, 1, 1002)).toBe(1001);
    // (2 x 100 + 1 x 101) / 3 = 100.33 -> 100
    expect(weightedAverageCost(100, 2, 1, 101)).toBe(100);
  });
});

describe('purchase orders', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let admin: { id: string; agent: Agent };
  let n = 0;

  beforeAll(async () => {
    const { createApp } = await import('./helpers');
    app = await createApp();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
  });
  afterAll(() => app.close());

  async function staffWith(perms: Parameters<typeof createStaffWith>[1]) {
    const s = await createStaffWith(app, perms);
    const row = await prisma.staff.findUniqueOrThrow({ where: { email: s.email } });
    return { id: row.id, agent: s.agent };
  }

  beforeEach(async () => {
    await resetCommerce(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE supplier_ledger, po_receipt_items, po_receipts, purchase_order_items, purchase_orders, variant_suppliers, suppliers CASCADE',
    );
    admin = await staffWith(['suppliers.view', 'suppliers.manage', 'purchase_orders.receive']);
  });

  async function supplier(o: { email?: string | null; isActive?: boolean } = {}) {
    n += 1;
    return prisma.supplier.create({
      data: {
        name: `Supplier ${n}`,
        email: o.email === undefined ? `sup${n}@example.com` : o.email,
        isActive: o.isActive ?? true,
      },
    });
  }

  async function variant(o: { stock?: number; costP?: number | null; dropship?: boolean } = {}) {
    const { variant: v } = await makeProduct(app, {
      stock: o.stock ?? 0,
      fulfillment: o.dropship ? 'dropship' : 'stock',
    });
    if (o.costP !== undefined)
      await prisma.variant.update({ where: { id: v.id }, data: { costP: o.costP } });
    return v;
  }

  const base = '/v1/admin/purchase-orders';
  async function createPo(
    sup: { id: string },
    lines: { variantId: string; qtyOrdered: number; unitCostP: number }[],
    extra: Record<string, unknown> = {},
  ) {
    const res = await admin.agent.post(base).send({ supplierId: sup.id, items: lines, ...extra });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body;
  }
  async function sentPo(
    lines: { variantId: string; qtyOrdered: number; unitCostP: number }[],
    sup?: { id: string },
  ) {
    const s = sup ?? (await supplier());
    const po = await createPo(s, lines);
    await admin.agent.post(`${base}/${po.id}/send`).expect(200);
    return { ...po, supplierId: s.id };
  }
  const item = (po: { items: { id: string; variantId: string }[] }, variantId: string) =>
    po.items.find((i) => i.variantId === variantId)?.id as string;

  describe('create + edit', () => {
    it('numbers POs PO-YYMM-NNNNN, sums the subtotal and links variants to the supplier', async () => {
      const sup = await supplier();
      const a = await variant();
      const b = await variant();
      const po = await createPo(
        sup,
        [
          { variantId: a.id, qtyOrdered: 3, unitCostP: 1000 },
          { variantId: b.id, qtyOrdered: 2, unitCostP: 250 },
        ],
        { expectedAt: '2030-01-15', notes: 'rush' },
      );
      expect(po.poNo).toMatch(new RegExp(`^PO-${dhakaYymm(new Date())}-\\d{5}$`));
      expect(po).toMatchObject({
        status: 'draft',
        subtotalP: 3500,
        lineCount: 2,
        qtyOrdered: 5,
        expectedAt: '2030-01-15',
        notes: 'rush',
        late: false,
        supplier: { id: sup.id },
      });
      expect(po.items[0]).toMatchObject({ remaining: expect.any(Number), onHand: 0 });
      const links = await prisma.variantSupplier.findMany({ where: { supplierId: sup.id } });
      expect(links).toHaveLength(2);
      expect(links.every((l) => l.isDefault)).toBe(true);
      expect(links.find((l) => l.variantId === a.id)?.costP).toBe(1000);

      const second = await createPo(sup, [{ variantId: a.id, qtyOrdered: 1, unitCostP: 1200 }]);
      expect(Number(second.poNo.slice(-5))).toBe(Number(po.poNo.slice(-5)) + 1);
      const link = await prisma.variantSupplier.findFirstOrThrow({
        where: { supplierId: sup.id, variantId: a.id },
      });
      expect(link.costP).toBe(1200);
    });

    it('refuses dropship variants, inactive suppliers, duplicate lines and empty POs', async () => {
      const sup = await supplier();
      const drop = await variant({ dropship: true });
      const ok = await variant();
      const line = (v: { id: string }) => ({ variantId: v.id, qtyOrdered: 1, unitCostP: 10 });
      const r1 = await admin.agent.post(base).send({ supplierId: sup.id, items: [line(drop)] });
      expect(r1.status).toBe(409);
      expect(r1.body.code).toBe('PO_DROPSHIP_VARIANT');
      const off = await supplier({ isActive: false });
      const r2 = await admin.agent.post(base).send({ supplierId: off.id, items: [line(ok)] });
      expect(r2.status).toBe(409);
      expect(r2.body.code).toBe('SUPPLIER_INACTIVE');
      await admin.agent
        .post(base)
        .send({ supplierId: sup.id, items: [line(ok), line(ok)] })
        .expect(400);
      await admin.agent.post(base).send({ supplierId: sup.id, items: [] }).expect(400);
      await admin.agent
        .post(base)
        .send({ supplierId: sup.id, items: [{ variantId: ok.id, qtyOrdered: 0, unitCostP: 10 }] })
        .expect(400);
      expect(await prisma.purchaseOrder.count()).toBe(0);
    });

    it('edits a draft fully, a sent PO only for date + notes, and locks the rest', async () => {
      const sup = await supplier();
      const a = await variant();
      const b = await variant();
      const po = await createPo(sup, [{ variantId: a.id, qtyOrdered: 1, unitCostP: 100 }]);
      const res = await admin.agent
        .patch(`${base}/${po.id}`)
        .send({
          items: [{ variantId: b.id, qtyOrdered: 4, unitCostP: 50 }],
          notes: 'n2',
          expectedAt: '2030-02-02',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        subtotalP: 200,
        lineCount: 1,
        notes: 'n2',
        expectedAt: '2030-02-02',
      });
      expect(res.body.items[0].variantId).toBe(b.id);
      expect(
        await prisma.variantSupplier.count({ where: { supplierId: sup.id, variantId: b.id } }),
      ).toBe(1);

      const other = await supplier();
      await admin.agent.patch(`${base}/${po.id}`).send({ supplierId: other.id }).expect(200);
      expect(await prisma.variantSupplier.count({ where: { supplierId: other.id } })).toBe(1);

      await admin.agent.post(`${base}/${po.id}/send`).expect(200);
      const ok = await admin.agent
        .patch(`${base}/${po.id}`)
        .send({ expectedAt: null, notes: 'later' })
        .expect(200);
      expect(ok.body).toMatchObject({ expectedAt: null, notes: 'later', subtotalP: 200 });
      for (const body of [
        { supplierId: sup.id },
        { items: [{ variantId: a.id, qtyOrdered: 1, unitCostP: 1 }] },
      ]) {
        const locked = await admin.agent.patch(`${base}/${po.id}`).send(body);
        expect(locked.status).toBe(409);
        expect(locked.body.code).toBe('PO_LOCKED');
      }
      await admin.agent.post(`${base}/${po.id}/cancel`).send({}).expect(200);
      const gone = await admin.agent.patch(`${base}/${po.id}`).send({ notes: 'x' });
      expect(gone.status).toBe(409);
      expect(gone.body.code).toBe('PO_LOCKED');
    });
  });

  describe('send, print, list', () => {
    it('sends once, emails the supplier after commit, and prints', async () => {
      const sup = await supplier({ email: 'orders@supplier.test' });
      const v = await variant();
      const po = await createPo(sup, [{ variantId: v.id, qtyOrdered: 2, unitCostP: 12_345 }]);
      mail.outbox.length = 0;
      const res = await admin.agent.post(`${base}/${po.id}/send`).expect(200);
      expect(res.body.emailed).toBe(true);
      expect(res.body.po).toMatchObject({ status: 'sent', sentAt: expect.any(String) });
      expect(mail.outbox).toHaveLength(1);
      const m = mail.outbox[0] as unknown as {
        to: string;
        subject: string;
        text: string;
        html: string;
      };
      expect(m.to).toBe('orders@supplier.test');
      expect(m.subject).toContain(po.poNo);
      expect(m.text).toContain('Tk 246.90');
      expect(m.html).toContain('<table');
      expect(m.html).toContain(v.sku);

      const again = await admin.agent.post(`${base}/${po.id}/send`);
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('PO_BAD_STATUS');

      const pr = await admin.agent.get(`${base}/${po.id}/print`).expect(200);
      expect(pr.body.po).toMatchObject({
        poNo: po.poNo,
        subtotalP: 24_690,
        status: 'sent',
        receivedValueP: 0,
      });
      expect(pr.body.store.name).toBeTypeOf('string');
      expect(pr.body.supplier.name).toBe(sup.name);
      expect(pr.body.items[0]).toMatchObject({
        sku: v.sku,
        qtyOrdered: 2,
        qtyReceived: 0,
        lineTotalP: 24_690,
      });
    });

    it('sends without email when the supplier has none, and mail failure never fails the call', async () => {
      const v = await variant();
      const noMail = await supplier({ email: null });
      const po1 = await createPo(noMail, [{ variantId: v.id, qtyOrdered: 1, unitCostP: 10 }]);
      mail.outbox.length = 0;
      const r1 = await admin.agent.post(`${base}/${po1.id}/send`).expect(200);
      expect(r1.body.emailed).toBe(false);
      expect(mail.outbox).toHaveLength(0);

      const sup = await supplier();
      const po2 = await createPo(sup, [{ variantId: v.id, qtyOrdered: 1, unitCostP: 10 }]);
      const spy = vi.spyOn(mail, 'send').mockImplementation(() => {
        throw new Error('smtp down');
      });
      const r2 = await admin.agent.post(`${base}/${po2.id}/send`).expect(200);
      spy.mockRestore();
      expect(r2.body).toMatchObject({ emailed: false, po: { status: 'sent' } });
    });

    it('lists with filters, counts that ignore the status filter, and late flags', async () => {
      const s1 = await supplier();
      const s2 = await supplier();
      const v = await variant();
      const line = [{ variantId: v.id, qtyOrdered: 2, unitCostP: 100 }];
      const draft = await createPo(s1, line);
      const sent = await sentPo(line, s1);
      const late = await sentPo(line, s2);
      await prisma.purchaseOrder.update({
        where: { id: late.id },
        data: { expectedAt: new Date('2020-01-01T00:00:00Z') },
      });
      const future = await createPo(s2, line, { expectedAt: '2999-01-01' });

      const all = await admin.agent.get(base).expect(200);
      expect(all.body.total).toBe(4);
      expect(all.body.counts).toMatchObject({ all: 4, draft: 2, sent: 2, received: 0 });
      expect(all.body.items[0].id).toBe(future.id);
      expect(all.body.items.find((i: { id: string }) => i.id === late.id).late).toBe(true);
      expect(all.body.items.find((i: { id: string }) => i.id === sent.id).late).toBe(false);
      expect(all.body.items.find((i: { id: string }) => i.id === future.id).late).toBe(false);

      const f = await admin.agent.get(`${base}?status=sent&supplierId=${s2.id}`).expect(200);
      expect(f.body.items.map((i: { id: string }) => i.id)).toEqual([late.id]);
      expect(f.body.counts).toMatchObject({ all: 2, draft: 1, sent: 1 });
      const q1 = await admin.agent.get(`${base}?q=${draft.poNo}`).expect(200);
      expect(q1.body.items.map((i: { id: string }) => i.id)).toEqual([draft.id]);
      const q2 = await admin.agent.get(`${base}?q=${s1.name.toLowerCase()}`).expect(200);
      expect(q2.body.total).toBe(2);
      const pg = await admin.agent.get(`${base}?pageSize=1&page=2`).expect(200);
      expect(pg.body.items).toHaveLength(1);
      expect(pg.body.total).toBe(4);
      expect(dhakaToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('variant-options lists linked variants first with last cost', async () => {
      const sup = await supplier();
      const linked = await variant({ costP: 777 });
      const otherV = await variant({ costP: 55 });
      const drop = await variant({ dropship: true });
      await createPo(sup, [{ variantId: linked.id, qtyOrdered: 1, unitCostP: 900 }]);
      await prisma.variantSupplier.updateMany({
        where: { variantId: linked.id },
        data: { costP: null },
      });

      const res = await admin.agent
        .get(`${base}/variant-options?supplierId=${sup.id}&limit=30`)
        .expect(200);
      const ids = res.body.map((r: { variantId: string }) => r.variantId);
      expect(ids[0]).toBe(linked.id);
      expect(ids).toEqual(expect.arrayContaining([otherV.id, drop.id]));
      expect(res.body[0]).toMatchObject({ linked: true, lastCostP: 900, variantCostP: 777 });
      const o = res.body.find((r: { variantId: string }) => r.variantId === otherV.id);
      expect(o).toMatchObject({ linked: false, lastCostP: null, variantCostP: 55 });
      expect(res.body.find((r: { variantId: string }) => r.variantId === drop.id).fulfillment).toBe(
        'dropship',
      );

      const q = await admin.agent
        .get(`${base}/variant-options?supplierId=${sup.id}&q=${otherV.sku}`)
        .expect(200);
      expect(q.body.map((r: { variantId: string }) => r.variantId)).toEqual([otherV.id]);
      await admin.agent.get(`${base}/variant-options?supplierId=${sup.id}&limit=31`).expect(400);
    });
  });

  describe('receiving', () => {
    it('receives in parts: stock, cost, receipts, ledger and status follow', async () => {
      const a = await variant({ stock: 0 });
      const b = await variant({ stock: 0 });
      const po = await sentPo([
        { variantId: a.id, qtyOrdered: 10, unitCostP: 1000 },
        { variantId: b.id, qtyOrdered: 5, unitCostP: 200 },
      ]);
      const ia = item(po, a.id);
      const ib = item(po, b.id);

      const r1 = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({ note: 'first truck', items: [{ poItemId: ia, qtyGood: 4, qtyRejected: 1 }] })
        .expect(200);
      expect(r1.body.status).toBe('partially_received');
      expect(r1.body).toMatchObject({ qtyReceived: 4, qtyRejected: 1, receivedValueP: 4000 });
      const printed = await admin.agent.get(`${base}/${po.id}/print`).expect(200);
      expect(printed.body.po.receivedValueP).toBe(4000);
      expect(printed.body.items.find((i: { sku: string }) => i.sku === a.sku).qtyReceived).toBe(4);
      expect(r1.body.items.find((i: { id: string }) => i.id === ia)).toMatchObject({
        qtyReceived: 4,
        qtyRejected: 1,
        remaining: 5,
        onHand: 4,
        variantCostP: 1000,
      });
      expect(r1.body.receipts).toHaveLength(1);
      expect(r1.body.receipts[0]).toMatchObject({
        note: 'first truck',
        totalP: 4000,
        receivedBy: { id: admin.id },
      });
      expect(r1.body.receipts[0].items[0]).toMatchObject({
        sku: a.sku,
        qtyGood: 4,
        qtyRejected: 1,
        costBeforeP: null,
        costAfterP: 1000,
      });

      const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: a.id } });
      expect(inv.onHand).toBe(4);
      const mv = await prisma.stockMovement.findFirstOrThrow({
        where: { variantId: a.id, reason: 'po_receive' },
      });
      expect(mv).toMatchObject({
        qtyDelta: 4,
        reservedDelta: 0,
        refType: 'po_receipt',
        refId: r1.body.receipts[0].id,
        staffId: admin.id,
      });
      const led = await prisma.supplierLedger.findMany({ where: { supplierId: po.supplierId } });
      expect(led).toHaveLength(1);
      expect(led[0]).toMatchObject({
        type: 'receipt',
        amountP: 4000,
        poReceiptId: r1.body.receipts[0].id,
        recordedById: admin.id,
      });

      // Rest of line a good, line b all rejected: nothing owed, PO complete.
      const r2 = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({
          items: [
            { poItemId: ia, qtyGood: 5, qtyRejected: 0 },
            { poItemId: ib, qtyGood: 0, qtyRejected: 5 },
          ],
        })
        .expect(200);
      expect(r2.body.status).toBe('received');
      expect(r2.body.receipts).toHaveLength(2);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: a.id } })).onHand,
      ).toBe(9);
      expect(
        await prisma.stockMovement.count({ where: { variantId: b.id, reason: 'po_receive' } }),
      ).toBe(0);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: b.id } })).onHand,
      ).toBe(0);
      const ledger = await prisma.supplierLedger.findMany({ where: { supplierId: po.supplierId } });
      expect(ledger.map((l) => l.amountP).sort()).toEqual([4000, 5000]);
      expect((await prisma.variant.findUniqueOrThrow({ where: { id: b.id } })).costP).toBeNull();

      const done = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: ia, qtyGood: 1, qtyRejected: 0 }] });
      expect(done.status).toBe(409);
      expect(done.body.code).toBe('PO_BAD_STATUS');
    });

    it('refuses over-receiving, empty receipts and foreign lines without side effects', async () => {
      const v = await variant();
      const po = await sentPo([{ variantId: v.id, qtyOrdered: 3, unitCostP: 100 }]);
      const li = item(po, v.id);
      const over = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: li, qtyGood: 3, qtyRejected: 1 }] });
      expect(over.status).toBe(409);
      expect(over.body).toMatchObject({ code: 'PO_OVER_RECEIVE', remaining: 3 });
      const none = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: li, qtyGood: 0, qtyRejected: 0 }] });
      expect(none.status).toBe(422);
      const foreign = await admin.agent.post(`${base}/${po.id}/receive`).send({
        items: [{ poItemId: '0198f0a0-0000-7000-8000-000000000000', qtyGood: 1, qtyRejected: 0 }],
      });
      expect(foreign.status).toBe(404);
      expect(foreign.body.code).toBe('PO_ITEM_NOT_FOUND');
      const draft = await createPo(await supplier(), [
        { variantId: v.id, qtyOrdered: 1, unitCostP: 1 },
      ]);
      const d = await admin.agent
        .post(`${base}/${draft.id}/receive`)
        .send({ items: [{ poItemId: item(draft, v.id), qtyGood: 1, qtyRejected: 0 }] });
      expect(d.status).toBe(409);
      expect(d.body.code).toBe('PO_BAD_STATUS');
      expect(await prisma.poReceipt.count()).toBe(0);
      expect(await prisma.supplierLedger.count()).toBe(0);
      expect(await prisma.stockMovement.count({ where: { reason: 'po_receive' } })).toBe(0);
    });

    it('moves variant cost by weighted average: null cost, empty shelf, blend, rounding', async () => {
      const nullCost = await variant({ stock: 7, costP: null });
      const empty = await variant({ stock: 0, costP: 500 });
      const blend = await variant({ stock: 10, costP: 1000 });
      const round = await variant({ stock: 3, costP: 1000 });
      const po = await sentPo([
        { variantId: nullCost.id, qtyOrdered: 5, unitCostP: 800 },
        { variantId: empty.id, qtyOrdered: 5, unitCostP: 900 },
        { variantId: blend.id, qtyOrdered: 10, unitCostP: 2000 },
        { variantId: round.id, qtyOrdered: 1, unitCostP: 1002 },
      ]);
      const res = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({
          items: [nullCost, empty, blend, round].map((v) => ({
            poItemId: item(po, v.id),
            qtyGood: v === round ? 1 : v === blend ? 10 : 5,
            qtyRejected: 0,
          })),
        })
        .expect(200);
      const cost = async (id: string) =>
        (await prisma.variant.findUniqueOrThrow({ where: { id } })).costP;
      expect(await cost(nullCost.id)).toBe(800);
      expect(await cost(empty.id)).toBe(900);
      expect(await cost(blend.id)).toBe(1500);
      expect(await cost(round.id)).toBe(1001);
      const ri = res.body.receipts[0].items as {
        sku: string;
        costBeforeP: number | null;
        costAfterP: number;
      }[];
      expect(ri.find((i) => i.sku === blend.sku)).toMatchObject({
        costBeforeP: 1000,
        costAfterP: 1500,
      });
      expect(ri.find((i) => i.sku === nullCost.sku)).toMatchObject({
        costBeforeP: null,
        costAfterP: 800,
      });
      expect(res.body.receipts[0].totalP).toBe(5 * 800 + 5 * 900 + 10 * 2000 + 1002);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: blend.id } })).onHand,
      ).toBe(20);
    });

    it('lets a receive-only staff receive but not create or edit', async () => {
      const clerk = await staffWith(['purchase_orders.receive']);
      const viewer = await staffWith(['suppliers.view']);
      const v = await variant();
      const sup = await supplier();
      const po = await sentPo([{ variantId: v.id, qtyOrdered: 2, unitCostP: 100 }], sup);
      const line = { variantId: v.id, qtyOrdered: 1, unitCostP: 1 };
      await clerk.agent
        .post(base)
        .send({ supplierId: sup.id, items: [line] })
        .expect(403);
      await clerk.agent.patch(`${base}/${po.id}`).send({ notes: 'x' }).expect(403);
      await clerk.agent.get(`${base}/${po.id}`).expect(403);
      await viewer.agent.get(`${base}/${po.id}`).expect(200);
      await viewer.agent.get(base).expect(200);
      await viewer.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: item(po, v.id), qtyGood: 1, qtyRejected: 0 }] })
        .expect(403);
      await viewer.agent.post(`${base}/${po.id}/close`).send({ reason: 'because' }).expect(403);
      const ok = await clerk.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: item(po, v.id), qtyGood: 1, qtyRejected: 0 }] })
        .expect(200);
      expect(ok.body.status).toBe('partially_received');
      expect(ok.body.receipts[0].receivedBy.id).toBe(clerk.id);
    });

    it('serialises two parallel receipts of the same line: one wins, one 409', async () => {
      const v = await variant({ stock: 0 });
      const po = await sentPo([{ variantId: v.id, qtyOrdered: 5, unitCostP: 100 }]);
      const li = item(po, v.id);
      const call = () =>
        admin.agent
          .post(`${base}/${po.id}/receive`)
          .send({ items: [{ poItemId: li, qtyGood: 5, qtyRejected: 0 }] });
      const results = await Promise.all([call(), call()]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { variantId: v.id } })).onHand,
      ).toBe(5);
      expect(await prisma.poReceipt.count({ where: { poId: po.id } })).toBe(1);
      expect(await prisma.supplierLedger.count({ where: { supplierId: po.supplierId } })).toBe(1);
    });
  });

  describe('close + cancel', () => {
    it('closes only a partly received PO short, keeping the ledger as received', async () => {
      const v = await variant();
      const po = await sentPo([{ variantId: v.id, qtyOrdered: 10, unitCostP: 100 }]);
      const early = await admin.agent
        .post(`${base}/${po.id}/close`)
        .send({ reason: 'supplier short' });
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('PO_BAD_STATUS');
      await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: item(po, v.id), qtyGood: 6, qtyRejected: 0 }] })
        .expect(200);
      await admin.agent.post(`${base}/${po.id}/close`).send({ reason: 'x' }).expect(400);
      const res = await admin.agent
        .post(`${base}/${po.id}/close`)
        .send({ reason: 'supplier short' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'closed',
        closeReason: 'supplier short',
        closedBy: { id: admin.id },
        closedAt: expect.any(String),
      });
      expect(await prisma.supplierLedger.count({ where: { supplierId: po.supplierId } })).toBe(1);
      const recv = await admin.agent
        .post(`${base}/${po.id}/receive`)
        .send({ items: [{ poItemId: item(po, v.id), qtyGood: 1, qtyRejected: 0 }] });
      expect(recv.status).toBe(409);
      const cancel = await admin.agent.post(`${base}/${po.id}/cancel`).send({});
      expect(cancel.status).toBe(409);
      expect(cancel.body.code).toBe('PO_BAD_STATUS');
    });

    it('cancels a draft or a sent PO with nothing received, not a partly received one', async () => {
      const v = await variant();
      const sup = await supplier();
      const line = [{ variantId: v.id, qtyOrdered: 2, unitCostP: 100 }];
      const draft = await createPo(sup, line);
      const c1 = await admin.agent
        .post(`${base}/${draft.id}/cancel`)
        .send({ reason: 'oops' })
        .expect(200);
      expect(c1.body).toMatchObject({
        status: 'cancelled',
        closeReason: 'oops',
        closedBy: { id: admin.id },
      });
      const again = await admin.agent.post(`${base}/${draft.id}/cancel`).send({});
      expect(again.status).toBe(409);

      const sent = await sentPo(line, sup);
      const c2 = await admin.agent.post(`${base}/${sent.id}/cancel`).send({}).expect(200);
      expect(c2.body).toMatchObject({ status: 'cancelled', closeReason: null });

      const part = await sentPo(line, sup);
      await admin.agent
        .post(`${base}/${part.id}/receive`)
        .send({ items: [{ poItemId: item(part, v.id), qtyGood: 1, qtyRejected: 0 }] })
        .expect(200);
      const c3 = await admin.agent.post(`${base}/${part.id}/cancel`).send({});
      expect(c3.status).toBe(409);
      expect(c3.body.code).toBe('PO_BAD_STATUS');

      const counts = (await admin.agent.get(base).expect(200)).body.counts;
      expect(counts).toMatchObject({ cancelled: 2, partially_received: 1, all: 3 });
    });

    it('returns 404 for unknown POs', async () => {
      const id = '0198f0a0-0000-7000-8000-000000000000';
      for (const path of [id, `${id}/print`]) {
        const r = await admin.agent.get(`${base}/${path}`);
        expect(r.status).toBe(404);
      }
      const s = await admin.agent.post(`${base}/${id}/send`);
      expect(s.status).toBe(404);
      expect(s.body.code).toBe('PO_NOT_FOUND');
    });
  });
});
