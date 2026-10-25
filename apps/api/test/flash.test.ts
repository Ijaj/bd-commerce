import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { makeProduct, resetCommerce } from './cart-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const HOUR = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

describe('flash sales', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let nobody: Agent;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetCommerce(app);
    admin = (await createStaffWith(app, ['flash_sales.manage'])).agent;
    nobody = (await createStaffWith(app, ['coupons.view'])).agent;
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await prisma.flashSale.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE order_items, orders, products CASCADE');
  });

  const get = (url: string) => request(app.getHttpServer()).get(url);

  async function sale(body: Record<string, unknown> = {}) {
    const res = await admin
      .post('/v1/admin/flash-sales')
      .send({ nameEn: 'Eid flash', startsAt: iso(-HOUR), endsAt: iso(HOUR), ...body })
      .expect(201);
    return res.body as { id: string };
  }
  const item = (variantId: string, over: Record<string, unknown> = {}) => ({
    variantId,
    flashPriceP: 5000,
    qtyLimit: 10,
    ...over,
  });
  const putItems = (id: string, items: unknown[]) =>
    admin.put(`/v1/admin/flash-sales/${id}/items`).send({ items });

  describe('admin', () => {
    it('requires flash_sales.manage', async () => {
      await nobody.get('/v1/admin/flash-sales').expect(403);
      await request(app.getHttpServer()).get('/v1/admin/flash-sales').expect(401);
    });

    it('creates, reads, updates and validates the window', async () => {
      const s = await sale({ nameBn: 'ঈদ' });
      const detail = await admin.get(`/v1/admin/flash-sales/${s.id}`).expect(200);
      expect(detail.body).toMatchObject({
        nameEn: 'Eid flash',
        nameBn: 'ঈদ',
        phase: 'live',
        itemCount: 0,
        unitsSold: 0,
        items: [],
      });
      await admin
        .post('/v1/admin/flash-sales')
        .send({ nameEn: 'Bad', startsAt: iso(HOUR), endsAt: iso(-HOUR) })
        .expect(400);
      const patched = await admin
        .patch(`/v1/admin/flash-sales/${s.id}`)
        .send({ nameEn: 'Renamed', isActive: false })
        .expect(200);
      expect(patched.body).toMatchObject({ nameEn: 'Renamed', phase: 'inactive' });
      const bad = await admin
        .patch(`/v1/admin/flash-sales/${s.id}`)
        .send({ endsAt: iso(-2 * HOUR) })
        .expect(422);
      expect(bad.body.code).toBe('FLASH_INVALID');
      await admin.get('/v1/admin/flash-sales/0197a1b2-0000-7000-8000-000000000000').expect(404);
    });

    it('lists with phase, counts and filters', async () => {
      const live = await sale({ nameEn: 'Live one' });
      await sale({ nameEn: 'Soon', startsAt: iso(HOUR), endsAt: iso(2 * HOUR) });
      await sale({ nameEn: 'Over', startsAt: iso(-3 * HOUR), endsAt: iso(-2 * HOUR) });
      await sale({ nameEn: 'Off', isActive: false });
      const { variant } = await makeProduct(app, { priceP: 10_000 });
      await putItems(live.id, [item(variant.id)]).expect(200);
      await prisma.flashSaleItem.updateMany({ data: { qtySold: 4 } });

      const all = await admin.get('/v1/admin/flash-sales').expect(200);
      const phases = Object.fromEntries(
        all.body.items.map((i: { nameEn: string; phase: string }) => [i.nameEn, i.phase]),
      );
      expect(phases).toEqual({
        'Live one': 'live',
        Soon: 'scheduled',
        Over: 'ended',
        Off: 'inactive',
      });
      expect(all.body.total).toBe(4);
      const liveRow = all.body.items.find((i: { nameEn: string }) => i.nameEn === 'Live one');
      expect(liveRow).toMatchObject({ itemCount: 1, unitsSold: 4 });
      for (const [phase, name] of [
        ['live', 'Live one'],
        ['scheduled', 'Soon'],
        ['ended', 'Over'],
        ['inactive', 'Off'],
      ]) {
        const res = await admin.get(`/v1/admin/flash-sales?phase=${phase}`).expect(200);
        expect(res.body.items.map((i: { nameEn: string }) => i.nameEn)).toEqual([name]);
      }
      const q = await admin.get('/v1/admin/flash-sales?q=soo&pageSize=1').expect(200);
      expect(q.body).toMatchObject({ total: 1, pageSize: 1 });
    });

    it('replaces items and reports product, price and current sale', async () => {
      const s = await sale();
      const a = await makeProduct(app, { priceP: 10_000, salePriceP: 8000 });
      const b = await makeProduct(app, { priceP: 20_000 });
      const res = await putItems(s.id, [
        item(a.variant.id, { flashPriceP: 6000, perCustomerLimit: 2, sort: 1 }),
        item(b.variant.id, { flashPriceP: 15_000, qtyLimit: 3, sort: 0 }),
      ]).expect(200);
      expect(res.body.itemCount).toBe(2);
      expect(res.body.items.map((i: { sku: string }) => i.sku)).toEqual([
        b.variant.sku,
        a.variant.sku,
      ]);
      expect(res.body.items[1]).toMatchObject({
        productTitleEn: a.product.titleEn,
        priceP: 10_000,
        currentSalePriceP: 8000,
        flashPriceP: 6000,
        qtyLimit: 10,
        qtySold: 0,
        perCustomerLimit: 2,
      });
      expect(res.body.items[0].currentSalePriceP).toBeNull();
      // second PUT drops one item and edits the other
      const again = await putItems(s.id, [item(b.variant.id, { flashPriceP: 12_000 })]).expect(200);
      expect(again.body.items).toHaveLength(1);
      expect(again.body.items[0]).toMatchObject({ flashPriceP: 12_000, qtyLimit: 10 });
    });

    it('validates items: price below regular, unknown and duplicate variants', async () => {
      const s = await sale();
      const { variant } = await makeProduct(app, { priceP: 10_000 });
      const high = await putItems(s.id, [item(variant.id, { flashPriceP: 10_000 })]).expect(422);
      expect(high.body.code).toBe('FLASH_INVALID');
      await putItems(s.id, [item('0197a1b2-0000-7000-8000-000000000000')]).expect(422);
      await putItems(s.id, [item(variant.id), item(variant.id)]).expect(422);
      await putItems(s.id, [item(variant.id, { qtyLimit: 0 })]).expect(400);
    });

    it('refuses overlapping windows with the clashing sale name', async () => {
      const { variant } = await makeProduct(app, { priceP: 10_000 });
      const first = await sale({ nameEn: 'First' });
      await putItems(first.id, [item(variant.id)]).expect(200);
      const second = await sale({
        nameEn: 'Second',
        startsAt: iso(30 * 60_000),
        endsAt: iso(3 * HOUR),
      });
      const clash = await putItems(second.id, [item(variant.id)]).expect(409);
      expect(clash.body).toMatchObject({ code: 'FLASH_OVERLAP', saleName: 'First' });
      expect(clash.body.message).toContain('First');
      // a later, non-overlapping window is fine
      const later = await sale({ nameEn: 'Later', startsAt: iso(2 * HOUR), endsAt: iso(3 * HOUR) });
      await putItems(later.id, [item(variant.id)]).expect(200);
      // moving it onto the first one is refused
      const move = await admin
        .patch(`/v1/admin/flash-sales/${later.id}`)
        .send({ startsAt: iso(0) })
        .expect(409);
      expect(move.body.code).toBe('FLASH_OVERLAP');
      // an inactive sale does not block, and cannot be activated into a clash
      const off = await sale({ nameEn: 'Off', isActive: false });
      await putItems(off.id, [item(variant.id)]).expect(200);
      const act = await admin
        .patch(`/v1/admin/flash-sales/${off.id}`)
        .send({ isActive: true })
        .expect(409);
      expect(act.body.saleName).toBe('First');
    });

    it('protects sold items: qty floor, no removal, no delete', async () => {
      const a = await makeProduct(app, { priceP: 10_000 });
      const b = await makeProduct(app, { priceP: 10_000 });
      const s = await sale();
      await putItems(s.id, [item(a.variant.id), item(b.variant.id)]).expect(200);
      await prisma.flashSaleItem.update({
        where: { flashSaleId_variantId: { flashSaleId: s.id, variantId: a.variant.id } },
        data: { qtySold: 6 },
      });
      const low = await putItems(s.id, [
        item(a.variant.id, { qtyLimit: 5 }),
        item(b.variant.id),
      ]).expect(422);
      expect(low.body.code).toBe('FLASH_INVALID');
      const drop = await putItems(s.id, [item(b.variant.id)]).expect(409);
      expect(drop.body.code).toBe('FLASH_HAS_SALES');
      const ok = await putItems(s.id, [item(a.variant.id, { qtyLimit: 6 })]).expect(200);
      expect(ok.body.items[0]).toMatchObject({ qtyLimit: 6, qtySold: 6 });
      const del = await admin.delete(`/v1/admin/flash-sales/${s.id}`).expect(409);
      expect(del.body.code).toBe('FLASH_HAS_SALES');
      await admin.patch(`/v1/admin/flash-sales/${s.id}`).send({ isActive: false }).expect(200);
    });

    it('deletes a sale nothing was sold from', async () => {
      const { variant } = await makeProduct(app, { priceP: 10_000 });
      const s = await sale();
      await putItems(s.id, [item(variant.id)]).expect(200);
      await admin.delete(`/v1/admin/flash-sales/${s.id}`).expect(204);
      await admin.get(`/v1/admin/flash-sales/${s.id}`).expect(404);
      expect(await prisma.flashSaleItem.count()).toBe(0);
    });
  });

  describe('public', () => {
    it('lists live and upcoming sales with flash prices, hiding sold out and non-public items', async () => {
      const live = await makeProduct(app, { priceP: 10_000 });
      const sold = await makeProduct(app, { priceP: 10_000 });
      const draft = await makeProduct(app, { priceP: 10_000, status: 'draft' });
      const noStock = await makeProduct(app, { priceP: 10_000, stock: 0 });
      const later = await makeProduct(app, { priceP: 10_000 });
      const beyond = await makeProduct(app, { priceP: 10_000 });
      const s1 = await sale({ nameEn: 'Now', nameBn: 'এখন' });
      await putItems(s1.id, [
        item(live.variant.id, { flashPriceP: 6000, qtyLimit: 8, sort: 0 }),
        item(sold.variant.id, { sort: 1 }),
        item(draft.variant.id, { sort: 2 }),
        item(noStock.variant.id, { sort: 3 }),
      ]).expect(200);
      await prisma.flashSaleItem.updateMany({
        where: { variantId: sold.variant.id },
        data: { qtySold: 10 },
      });
      await prisma.flashSaleItem.updateMany({
        where: { variantId: live.variant.id },
        data: { qtySold: 3 },
      });
      const s2 = await sale({
        nameEn: 'Soon',
        startsAt: iso(2 * 24 * HOUR),
        endsAt: iso(3 * 24 * HOUR),
      });
      await putItems(s2.id, [item(later.variant.id, { flashPriceP: 7000 })]).expect(200);
      const s3 = await sale({
        nameEn: 'Far',
        startsAt: iso(10 * 24 * HOUR),
        endsAt: iso(11 * 24 * HOUR),
      });
      await putItems(s3.id, [item(beyond.variant.id)]).expect(200);
      await sale({ nameEn: 'Empty' });
      await sale({ nameEn: 'Off', isActive: false });

      const res = await get('/v1/public/flash-sales').expect(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.body.live.map((s: { nameEn: string }) => s.nameEn)).toEqual(['Now']);
      expect(res.body.upcoming.map((s: { nameEn: string }) => s.nameEn)).toEqual(['Soon']);
      const now = res.body.live[0];
      expect(now.nameBn).toBe('এখন');
      expect(now.items).toHaveLength(1);
      expect(now.items[0]).toMatchObject({
        variantId: live.variant.id,
        flashPriceP: 6000,
        remaining: 5,
        qtyLimit: 8,
      });
      expect(now.items[0].productCard).toMatchObject({
        slug: live.product.slug,
        priceP: 6000,
        compareAtP: 10_000,
        discountPct: 40,
        flashEndsAt: now.endsAt,
      });
      const soon = res.body.upcoming[0].items[0];
      expect(soon.productCard).toMatchObject({ priceP: 7000, flashEndsAt: null });
    });
  });
});
