import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { upsertSupplierLink } from '../src/purchasing/suppliers/supplier-links';
import { makeProduct, resetCommerce } from './cart-fixtures';
import { type Agent, createApp, createOwner, createStaffWith } from './helpers';

// Each test signs in staff (slow password hashing); stay stable when other jobs load the box.
vi.setConfig({ testTimeout: 60_000 });

describe('suppliers, links and payables ledger', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let viewer: Agent;
  let payer: Agent;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetCommerce(app);
    await prisma.$executeRawUnsafe('TRUNCATE suppliers CASCADE');
    owner = (await createOwner(app)).agent;
    viewer = (await createStaffWith(app, ['suppliers.view'])).agent;
    payer = (await createStaffWith(app, ['suppliers.view', 'supplier_payments.manage'])).agent;
  }, 60_000);

  const newSupplier = async (body: Record<string, unknown> = {}) => {
    const res = await owner
      .post('/v1/admin/suppliers')
      .send({
        name: `Sup ${Math.random().toString(36).slice(2, 8)}`,
        shipMode: 'via_warehouse',
        ...body,
      })
      .expect(201);
    return res.body as { id: string; name: string };
  };

  describe('CRUD', () => {
    it('creates, normalises the phone, reads and patches', async () => {
      const res = await owner
        .post('/v1/admin/suppliers')
        .send({
          name: 'Dhaka Traders',
          phone: '+88 017-1234 5678',
          email: 'buy@dt.test',
          shipMode: 'direct_to_customer',
          pickupAddress: 'Mirpur 10',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Dhaka Traders',
        phone: '01712345678',
        shipMode: 'direct_to_customer',
        pickupAddress: 'Mirpur 10',
        isActive: true,
        productCount: 0,
        openPoCount: 0,
        balanceP: 0,
      });
      const id = res.body.id as string;

      const patched = await owner
        .patch(`/v1/admin/suppliers/${id}`)
        .send({ contactName: 'Rahim', notes: 'net 15', isActive: false, email: null })
        .expect(200);
      expect(patched.body).toMatchObject({
        contactName: 'Rahim',
        notes: 'net 15',
        isActive: false,
        email: null,
        phone: '01712345678',
      });
      const got = await viewer.get(`/v1/admin/suppliers/${id}`).expect(200);
      expect(got.body.createdAt).toEqual(expect.any(String));
    });

    it('rejects a bad phone and a duplicate name (case-insensitive)', async () => {
      const bad = await owner
        .post('/v1/admin/suppliers')
        .send({ name: 'X Co', phone: '12345', shipMode: 'via_warehouse' })
        .expect(422);
      expect(bad.body.code).toBe('SUPPLIER_PHONE_INVALID');

      const a = await newSupplier({ name: 'Alpha Ltd' });
      const dup = await owner
        .post('/v1/admin/suppliers')
        .send({ name: 'alpha LTD', shipMode: 'via_warehouse' })
        .expect(409);
      expect(dup.body.code).toBe('SUPPLIER_NAME_TAKEN');
      const b = await newSupplier({ name: 'Beta' });
      const clash = await owner
        .patch(`/v1/admin/suppliers/${b.id}`)
        .send({ name: 'ALPHA ltd' })
        .expect(409);
      expect(clash.body.code).toBe('SUPPLIER_NAME_TAKEN');
      // renaming to its own name (other case) is fine
      await owner.patch(`/v1/admin/suppliers/${a.id}`).send({ name: 'ALPHA LTD' }).expect(200);
    });

    it('lists sorted by name with search, active filter, counts and balance', async () => {
      const zed = await newSupplier({ name: 'Zed', phone: '01811111111' });
      const amy = await newSupplier({ name: 'Amy', email: 'amy@x.test' });
      await owner.patch(`/v1/admin/suppliers/${zed.id}`).send({ isActive: false }).expect(200);
      const { variant } = await makeProduct(app);
      await owner
        .put(`/v1/admin/suppliers/${amy.id}/variants/${variant.id}`)
        .send({ costP: 100 })
        .expect(200);
      await payer
        .post(`/v1/admin/suppliers/${amy.id}/adjustments`)
        .send({ amountP: 5000, note: 'opening' })
        .expect(201);
      const staff = await prisma.staff.findFirstOrThrow();
      const po = await prisma.purchaseOrder.create({
        data: { poNo: 'PO-T-1', supplierId: amy.id, status: 'sent', createdById: staff.id },
      });
      await prisma.purchaseOrder.create({
        data: { poNo: 'PO-T-2', supplierId: amy.id, status: 'draft', createdById: staff.id },
      });
      expect(po.id).toBeTruthy();

      const all = await viewer.get('/v1/admin/suppliers').expect(200);
      expect(all.body.total).toBe(2);
      expect(all.body.items.map((s: { name: string }) => s.name)).toEqual(['Amy', 'Zed']);
      expect(all.body.items[0]).toMatchObject({ productCount: 1, openPoCount: 1, balanceP: 5000 });

      const inactive = await viewer.get('/v1/admin/suppliers?active=false').expect(200);
      expect(inactive.body.items.map((s: { name: string }) => s.name)).toEqual(['Zed']);
      const byPhone = await viewer.get('/v1/admin/suppliers?q=0181').expect(200);
      expect(byPhone.body.total).toBe(1);
      const byMail = await viewer.get('/v1/admin/suppliers?q=AMY@').expect(200);
      expect(byMail.body.items[0].name).toBe('Amy');
    });

    it('view-only staff cannot write; unknown id is 404', async () => {
      const s = await newSupplier();
      await viewer
        .post('/v1/admin/suppliers')
        .send({ name: 'Nope', shipMode: 'via_warehouse' })
        .expect(403);
      await viewer.patch(`/v1/admin/suppliers/${s.id}`).send({ notes: 'x' }).expect(403);
      await viewer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 1, method: 'cash' })
        .expect(403);
      await payer
        .post('/v1/admin/suppliers')
        .send({ name: 'Nope', shipMode: 'via_warehouse' })
        .expect(403);
      const miss = await viewer
        .get('/v1/admin/suppliers/0198f3a0-0000-7000-8000-000000000000')
        .expect(404);
      expect(miss.body.code).toBe('SUPPLIER_NOT_FOUND');
    });
  });

  describe('variant links', () => {
    it('upserts links, first becomes default, default switches within the variant', async () => {
      const a = await newSupplier();
      const b = await newSupplier();
      const { variant, product } = await makeProduct(app);
      const base = `/v1/admin/suppliers`;

      const first = await owner
        .put(`${base}/${a.id}/variants/${variant.id}`)
        .send({ supplierSku: 'A-1', costP: 4000, leadTimeDays: 5 })
        .expect(200);
      expect(first.body).toMatchObject({
        variantId: variant.id,
        productId: product.id,
        productTitleEn: product.titleEn,
        sku: variant.sku,
        supplierSku: 'A-1',
        costP: 4000,
        leadTimeDays: 5,
        isDefault: true,
        fulfillment: 'stock',
        variantCostP: null,
        options: [],
      });
      const second = await owner
        .put(`${base}/${b.id}/variants/${variant.id}`)
        .send({ costP: 3900 })
        .expect(200);
      expect(second.body.isDefault).toBe(false);

      // partial update keeps other fields
      const upd = await owner
        .put(`${base}/${a.id}/variants/${variant.id}`)
        .send({ costP: 4100 })
        .expect(200);
      expect(upd.body).toMatchObject({ supplierSku: 'A-1', costP: 4100, isDefault: true });

      await owner
        .put(`${base}/${b.id}/variants/${variant.id}`)
        .send({ isDefault: true })
        .expect(200);
      const links = await prisma.variantSupplier.findMany({ where: { variantId: variant.id } });
      expect(links.filter((l) => l.isDefault).map((l) => l.supplierId)).toEqual([b.id]);

      const list = await viewer.get(`${base}/${a.id}/variants`).expect(200);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0].isDefault).toBe(false);
      const sup = await viewer.get(`${base}/${a.id}`).expect(200);
      expect(sup.body.productCount).toBe(1);
    });

    it('lists option labels, searches, deletes, and validates ids', async () => {
      const s = await newSupplier();
      const { product, variant } = await makeProduct(app);
      const opt = await prisma.productOption.create({
        data: { productId: product.id, position: 1, nameEn: 'Size', nameBn: 'সাইজ' },
      });
      const val = await prisma.productOptionValue.create({
        data: { optionId: opt.id, valueEn: 'Large', valueBn: 'বড়' },
      });
      await prisma.variant.update({
        where: { id: variant.id },
        data: { optionValue1Id: val.id, costP: 777 },
      });
      const base = `/v1/admin/suppliers/${s.id}/variants`;
      const put = await owner.put(`${base}/${variant.id}`).send({}).expect(200);
      expect(put.body.options).toEqual([{ en: 'Large', bn: 'বড়' }]);
      expect(put.body.variantCostP).toBe(777);

      const bySku = await viewer.get(`${base}?q=${variant.sku.toUpperCase()}`).expect(200);
      expect(bySku.body.total).toBe(1);
      const none = await viewer.get(`${base}?q=zzzz-nothing`).expect(200);
      expect(none.body.total).toBe(0);

      const ghost = '0198f3a0-0000-7000-8000-000000000000';
      const nv = await owner.put(`${base}/${ghost}`).send({}).expect(404);
      expect(nv.body.code).toBe('VARIANT_NOT_FOUND');
      await owner.delete(`${base}/${variant.id}`).expect(204);
      const gone = await owner.delete(`${base}/${variant.id}`).expect(404);
      expect(gone.body.code).toBe('LINK_NOT_FOUND');
      await viewer.delete(`${base}/${variant.id}`).expect(403);
    });

    it('upsertSupplierLink helper: creates, keeps default, updates cost', async () => {
      const a = await newSupplier();
      const b = await newSupplier();
      const { variant } = await makeProduct(app);
      await prisma.$transaction(async (tx) => {
        await upsertSupplierLink(tx, a.id, variant.id, 100);
        await upsertSupplierLink(tx, b.id, variant.id, 200);
        await upsertSupplierLink(tx, a.id, variant.id, 150);
      });
      const links = await prisma.variantSupplier.findMany({ where: { variantId: variant.id } });
      const byS = Object.fromEntries(links.map((l) => [l.supplierId, l]));
      expect(byS[a.id]).toMatchObject({ costP: 150, isDefault: true });
      expect(byS[b.id]).toMatchObject({ costP: 200, isDefault: false });
    });
  });

  describe('ledger', () => {
    it('payment is negative, balance can go below zero, running balance is newest first', async () => {
      const s = await newSupplier();
      const staff = await prisma.staff.findFirstOrThrow({
        where: { email: { startsWith: 'owner' } },
      });
      // a receipt-type row comes from PO receiving; seed one directly
      await prisma.supplierLedger.create({
        data: { supplierId: s.id, type: 'receipt', amountP: 10_000, recordedById: staff.id },
      });
      const pay = await payer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 4000, method: 'bkash', reference: 'TX123', note: 'part' })
        .expect(201);
      expect(pay.body).toMatchObject({
        type: 'payment',
        amountP: -4000,
        method: 'bkash',
        reference: 'TX123',
        balanceP: 6000,
        balanceAfterP: 6000,
      });
      const over = await payer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 9000, method: 'cash' })
        .expect(201);
      expect(over.body.balanceP).toBe(-3000);

      const led = await viewer.get(`/v1/admin/suppliers/${s.id}/ledger`).expect(200);
      expect(led.body.balanceP).toBe(-3000);
      expect(led.body.total).toBe(3);
      expect(led.body.items.map((e: { balanceAfterP: number }) => e.balanceAfterP)).toEqual([
        -3000, 6000, 10_000,
      ]);
      expect(led.body.items[0].recordedBy.name).toEqual(expect.any(String));
      const page2 = await viewer
        .get(`/v1/admin/suppliers/${s.id}/ledger?pageSize=2&page=2`)
        .expect(200);
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items[0].type).toBe('receipt');
      expect(page2.body.items[0].balanceAfterP).toBe(10_000);

      const row = await viewer.get(`/v1/admin/suppliers/${s.id}`).expect(200);
      expect(row.body.balanceP).toBe(-3000);
    });

    it('payment validation: reference needed for non-cash, amount positive', async () => {
      const s = await newSupplier();
      const url = `/v1/admin/suppliers/${s.id}/payments`;
      await payer.post(url).send({ amountP: 100, method: 'bank' }).expect(400);
      await payer.post(url).send({ amountP: 100, method: 'nagad' }).expect(400);
      await payer.post(url).send({ amountP: 0, method: 'cash' }).expect(400);
      await payer.post(url).send({ amountP: -5, method: 'cash' }).expect(400);
      await payer.post(url).send({ amountP: 100, method: 'cheque' }).expect(400);
      await payer.post(url).send({ amountP: 100, method: 'bank', reference: 'CHQ-1' }).expect(201);
    });

    it('inactive supplier still accepts payments', async () => {
      const s = await newSupplier();
      await owner.patch(`/v1/admin/suppliers/${s.id}`).send({ isActive: false }).expect(200);
      await payer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 100, method: 'cash' })
        .expect(201);
    });

    it('adjustment: signed, note required 3..300, zero refused', async () => {
      const s = await newSupplier();
      const url = `/v1/admin/suppliers/${s.id}/adjustments`;
      await payer.post(url).send({ amountP: 500 }).expect(400);
      await payer.post(url).send({ amountP: 500, note: 'ab' }).expect(400);
      await payer
        .post(url)
        .send({ amountP: 500, note: 'x'.repeat(301) })
        .expect(400);
      await payer.post(url).send({ amountP: 0, note: 'nothing' }).expect(400);
      const up = await payer.post(url).send({ amountP: 8000, note: 'Opening balance' }).expect(201);
      expect(up.body).toMatchObject({ type: 'adjustment', amountP: 8000, balanceP: 8000 });
      const down = await payer.post(url).send({ amountP: -3000, note: 'Credit note' }).expect(201);
      expect(down.body.balanceP).toBe(5000);
      await viewer.post(url).send({ amountP: 1, note: 'nope' }).expect(403);
    });

    it('reversal: negates payments and adjustments once; others are not reversible', async () => {
      const s = await newSupplier();
      const staff = await prisma.staff.findFirstOrThrow({
        where: { email: { startsWith: 'owner' } },
      });
      const receipt = await prisma.supplierLedger.create({
        data: { supplierId: s.id, type: 'receipt', amountP: 10_000, recordedById: staff.id },
      });
      const pay = await payer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 4000, method: 'cash' })
        .expect(201);
      const adj = await payer
        .post(`/v1/admin/suppliers/${s.id}/adjustments`)
        .send({ amountP: -1000, note: 'discount' })
        .expect(201);

      const rev = await payer
        .post(`/v1/admin/supplier-ledger/${pay.body.id}/reverse`)
        .send({ note: 'Wrong supplier' })
        .expect(201);
      expect(rev.body).toMatchObject({
        type: 'reversal',
        amountP: 4000,
        reversesId: pay.body.id,
        note: 'Wrong supplier',
        balanceP: 9000,
      });

      const again = await payer
        .post(`/v1/admin/supplier-ledger/${pay.body.id}/reverse`)
        .send({ note: 'again' })
        .expect(409);
      expect(again.body.code).toBe('LEDGER_ALREADY_REVERSED');
      const revRev = await payer
        .post(`/v1/admin/supplier-ledger/${rev.body.id}/reverse`)
        .send({ note: 'undo undo' })
        .expect(409);
      expect(revRev.body.code).toBe('LEDGER_NOT_REVERSIBLE');
      const rcp = await payer
        .post(`/v1/admin/supplier-ledger/${receipt.id}/reverse`)
        .send({ note: 'no way' })
        .expect(409);
      expect(rcp.body.code).toBe('LEDGER_NOT_REVERSIBLE');
      await payer
        .post(`/v1/admin/supplier-ledger/${adj.body.id}/reverse`)
        .send({ note: 'oops' })
        .expect(201);
      await payer.post(`/v1/admin/supplier-ledger/${adj.body.id}/reverse`).send({}).expect(400);
      const nf = await payer
        .post('/v1/admin/supplier-ledger/0198f3a0-0000-7000-8000-000000000000/reverse')
        .send({ note: 'ghost' })
        .expect(404);
      expect(nf.body.code).toBe('LEDGER_ENTRY_NOT_FOUND');
      await viewer
        .post(`/v1/admin/supplier-ledger/${adj.body.id}/reverse`)
        .send({ note: 'nope' })
        .expect(403);

      const led = await viewer.get(`/v1/admin/suppliers/${s.id}/ledger`).expect(200);
      expect(led.body.balanceP).toBe(10_000);
      const orig = led.body.items.find((e: { id: string }) => e.id === pay.body.id);
      expect(orig.reversedById).toBe(rev.body.id);
    });

    it('parallel reversals of one entry: exactly one wins', async () => {
      const s = await newSupplier();
      const pay = await payer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 700, method: 'cash' })
        .expect(201);
      const calls = await Promise.all(
        [1, 2].map(() =>
          payer.post(`/v1/admin/supplier-ledger/${pay.body.id}/reverse`).send({ note: 'race' }),
        ),
      );
      expect(calls.map((c) => c.status).sort()).toEqual([201, 409]);
      const led = await viewer.get(`/v1/admin/suppliers/${s.id}/ledger`).expect(200);
      expect(led.body.balanceP).toBe(0);
    });

    it('is append-only at the database level', async () => {
      const s = await newSupplier();
      const pay = await payer
        .post(`/v1/admin/suppliers/${s.id}/payments`)
        .send({ amountP: 700, method: 'cash' })
        .expect(201);
      await expect(
        prisma.supplierLedger.update({ where: { id: pay.body.id }, data: { amountP: -1 } }),
      ).rejects.toThrow();
      await expect(prisma.supplierLedger.delete({ where: { id: pay.body.id } })).rejects.toThrow();
    });
  });
});
