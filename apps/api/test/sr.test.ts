import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { monthKey } from '../src/sr/sr.util';
import { type Agent, createApp, createStaffWith, resetDb } from './helpers';

describe('SR / B2B', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inventory: InventoryService;
  let categoryId: string;
  let seq = 0;

  let srA: { id: string; agent: Agent };
  let srB: { id: string; agent: Agent };
  let admin: { id: string; agent: Agent };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    inventory = app.get(InventoryService);
  });
  afterAll(() => app.close());

  async function actor(perms: Parameters<typeof createStaffWith>[1], sr = false) {
    const s = await createStaffWith(app, perms);
    const staff = await prisma.staff.findUniqueOrThrow({ where: { email: s.email } });
    if (sr) await prisma.srProfile.create({ data: { staffId: staff.id, area: 'Mirpur' } });
    return { id: staff.id, agent: s.agent };
  }

  beforeEach(async () => {
    await resetDb(app);
    categoryId = randomUUID();
    await prisma.category.create({
      data: { id: categoryId, level: 1, path: `/${categoryId}/`, nameEn: 'Root', slug: 'root' },
    });
    srA = await actor(['sr.portal'], true);
    srB = await actor(['sr.portal'], true);
    admin = await actor(['sr.approve', 'b2b.view', 'b2b.manage', 'sr.manage']);
  });

  async function makeVariant(stock: number, opts: { dropship?: boolean; title?: string } = {}) {
    seq += 1;
    const seller = await prisma.seller.findFirstOrThrow();
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        primaryCategoryId: categoryId,
        titleEn: opts.title ?? `Tee ${seq}`,
        titleBn: 'টি-শার্ট',
        slug: `sr-p-${seq}`,
        status: 'active',
        fulfillment: opts.dropship ? 'dropship' : 'stock',
        categories: { create: { categoryId } },
        variants: { create: [{ sku: `SR-SKU-${seq}`, priceP: 50_000 }] },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]?.id as string;
    if (stock > 0) {
      await prisma.$transaction((tx) =>
        inventory.move(tx, { variantId, qtyDelta: stock, reservedDelta: 0, reason: 'adjust' }),
      );
    }
    return variantId;
  }

  const level = (variantId: string) => prisma.inventory.findUniqueOrThrow({ where: { variantId } });

  async function makeShop(agent: Agent = srA.agent, name = 'Rahim Store') {
    const res = await agent
      .post('/v1/portal/sr/shops')
      .send({ name, phone: '01711111111', address: 'Mirpur 10, Dhaka' })
      .expect(201);
    return res.body.id as string;
  }

  async function submit(
    agent: Agent,
    b2bShopId: string,
    variantId: string,
    over: { qty?: number; unitPriceP?: number; paidAtSaleP?: number } = {},
  ) {
    return agent.post('/v1/portal/sr/sales').send({
      b2bShopId,
      items: [{ variantId, qty: over.qty ?? 10, unitPriceP: over.unitPriceP ?? 40_000 }],
      paidAtSaleP: over.paidAtSaleP ?? 0,
    });
  }

  const shopDue = async (id: string) =>
    (await prisma.b2bShop.findUniqueOrThrow({ where: { id } })).dueBalanceP;

  async function ledgerSum(shopId: string) {
    const rows = await prisma.b2bLedger.findMany({ where: { b2bShopId: shopId } });
    return rows
      .filter((r) => r.type !== 'collection' || r.confirmedAt)
      .reduce((s, r) => s + r.amountP, 0);
  }

  describe('sale lifecycle', () => {
    it('submit reserves, approve writes the due, deliver ships', async () => {
      const v = await makeVariant(50);
      const shopId = await makeShop();
      const res = await submit(srA.agent, shopId, v, { paidAtSaleP: 100_000 }).then((r) => {
        expect(r.status).toBe(201);
        return r.body;
      });
      expect(res).toMatchObject({
        status: 'submitted',
        totalP: 400_000,
        paidAtSaleP: 100_000,
        dueP: 300_000,
        sr: { id: srA.id },
        shop: { id: shopId },
      });
      expect(res.memoNo).toMatch(/^SR-\d{4}-\d{5}$/);
      expect(res.items).toHaveLength(1);
      expect(await level(v)).toMatchObject({ onHand: 50, reserved: 10 });
      expect(await shopDue(shopId)).toBe(0);

      const approved = await admin.agent.post(`/v1/admin/sr/sales/${res.id}/approve`).expect(200);
      expect(approved.body).toMatchObject({ status: 'approved', approvedBy: { id: admin.id } });
      // approve leaves stock alone
      expect(await level(v)).toMatchObject({ onHand: 50, reserved: 10 });
      // payment at sale is not a ledger entry; only the unpaid rest is
      const ledger = await prisma.b2bLedger.findMany({ where: { b2bShopId: shopId } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ type: 'sale_due', amountP: 300_000, srSaleId: res.id });
      expect(ledger[0]?.confirmedAt).not.toBeNull();
      expect(await shopDue(shopId)).toBe(300_000);

      await admin.agent.post(`/v1/admin/sr/sales/${res.id}/deliver`).expect(200);
      expect(await level(v)).toMatchObject({ onHand: 40, reserved: 0 });
      const moves = await prisma.stockMovement.findMany({
        where: { variantId: v, refId: res.id },
        orderBy: { id: 'asc' },
      });
      expect(moves.map((m) => [m.reason, m.qtyDelta, m.reservedDelta])).toEqual([
        ['sr_reserve', 0, 10],
        ['sr_ship', -10, -10],
      ]);
      const done = await srA.agent.get(`/v1/portal/sr/sales/${res.id}`).expect(200);
      expect(done.body).toMatchObject({ status: 'delivered', deliveredBy: { id: admin.id } });
    });

    it('fully paid sale writes no ledger row', async () => {
      const v = await makeVariant(5);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 2, paidAtSaleP: 80_000 })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(200);
      expect(await prisma.b2bLedger.count({ where: { b2bShopId: shopId } })).toBe(0);
      expect(await shopDue(shopId)).toBe(0);
    });

    it('reject and cancel release the reservation; only submitted sales change', async () => {
      const v = await makeVariant(20);
      const shopId = await makeShop();
      const a = (await submit(srA.agent, shopId, v, { qty: 5 })).body;
      const b = (await submit(srA.agent, shopId, v, { qty: 4 })).body;
      expect(await level(v)).toMatchObject({ reserved: 9 });

      await admin.agent
        .post(`/v1/admin/sr/sales/${a.id}/reject`)
        .send({ reason: 'price too low' })
        .expect(200)
        .expect((r) => {
          expect(r.body).toMatchObject({ status: 'rejected', rejectedReason: 'price too low' });
        });
      expect(await level(v)).toMatchObject({ reserved: 4 });

      await srA.agent.post(`/v1/portal/sr/sales/${b.id}/cancel`).expect(200);
      expect(await level(v)).toMatchObject({ onHand: 20, reserved: 0 });

      // both are final now
      await srA.agent.post(`/v1/portal/sr/sales/${b.id}/cancel`).expect(409);
      await admin.agent.post(`/v1/admin/sr/sales/${a.id}/approve`).expect(409);
      await admin.agent.post(`/v1/admin/sr/sales/${a.id}/deliver`).expect(409);
      expect(await prisma.b2bLedger.count()).toBe(0);

      // an approved sale cannot be cancelled or rejected
      const c = (await submit(srA.agent, shopId, v, { qty: 1 })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${c.id}/approve`).expect(200);
      await srA.agent.post(`/v1/portal/sr/sales/${c.id}/cancel`).expect(409);
      await admin.agent
        .post(`/v1/admin/sr/sales/${c.id}/reject`)
        .send({ reason: 'late' })
        .expect(409);
      expect(await level(v)).toMatchObject({ reserved: 1 });
    });

    it('validates stock, prices, payment, variants and blocked shops', async () => {
      const v = await makeVariant(5);
      const shopId = await makeShop();

      const over = await submit(srA.agent, shopId, v, { qty: 6 });
      expect(over.status).toBe(409);
      expect(over.body.code).toBe('OUT_OF_STOCK');
      expect(await level(v)).toMatchObject({ reserved: 0 });
      expect(await prisma.srSale.count()).toBe(0);

      expect((await submit(srA.agent, shopId, v, { unitPriceP: -1 })).status).toBe(400);
      expect((await submit(srA.agent, shopId, v, { qty: 0 })).status).toBe(400);
      const tooMuch = await submit(srA.agent, shopId, v, {
        qty: 1,
        unitPriceP: 1000,
        paidAtSaleP: 1001,
      });
      expect(tooMuch.status).toBe(400);
      expect(tooMuch.body.code).toBe('PAID_EXCEEDS_TOTAL');
      // C46: unit price must be at least 1 taka
      expect((await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: 99 })).status).toBe(400);
      expect((await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: 100 })).status).toBe(201);

      const dup = await srA.agent.post('/v1/portal/sr/sales').send({
        b2bShopId: shopId,
        items: [
          { variantId: v, qty: 1, unitPriceP: 1 },
          { variantId: v, qty: 1, unitPriceP: 1 },
        ],
      });
      expect(dup.status).toBe(400);

      const drop = await makeVariant(5, { dropship: true });
      expect((await submit(srA.agent, shopId, drop, { qty: 1 })).body.code).toBe(
        'VARIANT_UNAVAILABLE',
      );
      expect((await submit(srA.agent, shopId, randomUUID(), { qty: 1 })).body.code).toBe(
        'VARIANT_UNAVAILABLE',
      );

      await admin.agent
        .patch(`/v1/admin/b2b/shops/${shopId}`)
        .send({ status: 'blocked' })
        .expect(200);
      const blocked = await submit(srA.agent, shopId, v, { qty: 1 });
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('SHOP_BLOCKED');
    });

    it('memo numbers are unique and sequential', async () => {
      const v = await makeVariant(20);
      const shopId = await makeShop();
      const a = (await submit(srA.agent, shopId, v, { qty: 1 })).body.memoNo as string;
      const b = (await submit(srB.agent, shopId, v, { qty: 1 })).body.memoNo as string;
      expect(a).not.toBe(b);
      expect(Number(b.slice(-5))).toBeGreaterThan(Number(a.slice(-5)));
      const ym = monthKey(new Date()).replace('-', '').slice(2);
      expect(a.startsWith(`SR-${ym}-`)).toBe(true);
    });

    it('stock for two sales of the last units: only one reservation wins', async () => {
      const v = await makeVariant(5);
      const shopId = await makeShop();
      const [r1, r2] = await Promise.all([
        submit(srA.agent, shopId, v, { qty: 4 }),
        submit(srB.agent, shopId, v, { qty: 4 }),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      expect(await level(v)).toMatchObject({ reserved: 4 });
    });
  });

  describe('scoping and permissions', () => {
    it('an SR never sees another SR sales or collections; shops are shared', async () => {
      const v = await makeVariant(30);
      const shopId = await makeShop(srA.agent);
      const sale = (await submit(srA.agent, shopId, v, { qty: 2 })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(200);
      await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 1000, method: 'cash' })
        .expect(201);

      // B: own list is empty, A's sale is a 404 everywhere
      expect((await srB.agent.get('/v1/portal/sr/sales').expect(200)).body.total).toBe(0);
      await srB.agent.get(`/v1/portal/sr/sales/${sale.id}`).expect(404);
      await srB.agent.get(`/v1/portal/sr/sales/${sale.id}/memo`).expect(404);
      await srB.agent.post(`/v1/portal/sr/sales/${sale.id}/cancel`).expect(404);
      expect((await srB.agent.get('/v1/portal/sr/collections').expect(200)).body.total).toBe(0);
      expect((await srA.agent.get('/v1/portal/sr/collections').expect(200)).body.total).toBe(1);

      // shops are shared: B sees A's shop (with the total due) and can sell to it
      const shops = (await srB.agent.get('/v1/portal/sr/shops').expect(200)).body;
      expect(shops.items.map((s: { id: string }) => s.id)).toContain(shopId);
      const detail = (await srB.agent.get(`/v1/portal/sr/shops/${shopId}`).expect(200)).body;
      expect(detail.dueBalanceP).toBeGreaterThan(0);
      expect(detail.ledger).toEqual([]); // but not A's ledger entries
      const own = (await srA.agent.get(`/v1/portal/sr/shops/${shopId}`).expect(200)).body;
      expect(own.ledger.length).toBe(2);
      expect((await submit(srB.agent, shopId, v, { qty: 1 })).status).toBe(201);

      // me() counts only own numbers
      const meA = (await srA.agent.get('/v1/portal/sr/me').expect(200)).body;
      const meB = (await srB.agent.get('/v1/portal/sr/me').expect(200)).body;
      expect(meA.month.soldP).toBe(80_000);
      expect(meB.month.soldP).toBe(0);
    });

    it('enforces permissions and the SR profile', async () => {
      const v = await makeVariant(5);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 1 })).body;

      // an SR cannot reach admin endpoints
      await srA.agent.get('/v1/admin/sr/sales').expect(403);
      await srA.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(403);
      await srA.agent.get('/v1/admin/b2b/shops').expect(403);

      // admin without sr.portal cannot use the portal
      await admin.agent.get('/v1/portal/sr/me').expect(403);

      // view-only staff can read but not act
      const viewer = await actor(['b2b.view']);
      await viewer.agent.get('/v1/admin/sr/sales').expect(200);
      await viewer.agent.get('/v1/admin/b2b/shops').expect(200);
      await viewer.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(403);
      await viewer.agent.patch(`/v1/admin/b2b/shops/${shopId}`).send({ isNew: false }).expect(403);
      await viewer.agent.get('/v1/admin/sr/commissions').expect(403);

      // sr.portal without an sr_profile is not an SR
      const noProfile = await actor(['sr.portal']);
      await noProfile.agent.get('/v1/portal/sr/me').expect(403);
      await noProfile.agent.get('/v1/portal/sr/sales').expect(403);

      // nobody signed in
      const request = (await import('supertest')).default;
      await request(app.getHttpServer()).get('/v1/portal/sr/me').expect(401);
    });

    it('nobody approves their own sale', async () => {
      const both = await actor(['sr.portal', 'sr.approve'], true);
      const v = await makeVariant(5);
      const shopId = await makeShop(both.agent);
      const sale = (await submit(both.agent, shopId, v, { qty: 1 })).body;
      await both.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(403);
      await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(200);
    });

    it('SR-added shops are usable at once and flagged new until staff clear it', async () => {
      const shopId = await makeShop();
      const shop = (await srA.agent.get(`/v1/portal/sr/shops/${shopId}`).expect(200)).body;
      expect(shop).toMatchObject({ isNew: true, status: 'active', createdBy: { id: srA.id } });
      const list = (await admin.agent.get('/v1/admin/b2b/shops?isNew=true').expect(200)).body;
      expect(list.total).toBe(1);
      const cleared = await admin.agent
        .patch(`/v1/admin/b2b/shops/${shopId}`)
        .send({ isNew: false, notes: 'verified' })
        .expect(200);
      expect(cleared.body).toMatchObject({ isNew: false, notes: 'verified' });
      expect((await admin.agent.get('/v1/admin/b2b/shops?isNew=true').expect(200)).body.total).toBe(
        0,
      );
    });

    it('blocking a shop also stops approving its pending sales', async () => {
      const v = await makeVariant(5);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 1 })).body;
      await admin.agent
        .patch(`/v1/admin/b2b/shops/${shopId}`)
        .send({ status: 'blocked' })
        .expect(200);
      const res = await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(409);
      expect(res.body.code).toBe('SHOP_BLOCKED');
      // rolled back: still submitted, reservation intact
      expect((await admin.agent.get(`/v1/admin/sr/sales/${sale.id}`)).body.status).toBe(
        'submitted',
      );
      await admin.agent
        .post(`/v1/admin/sr/sales/${sale.id}/reject`)
        .send({ reason: 'blocked' })
        .expect(200);
      expect(await level(v)).toMatchObject({ reserved: 0 });
    });

    it('filters the admin sale list', async () => {
      const v = await makeVariant(20);
      const s1 = await makeShop(srA.agent, 'One');
      const s2 = await makeShop(srB.agent, 'Two');
      await submit(srA.agent, s1, v, { qty: 1 });
      const b = (await submit(srB.agent, s2, v, { qty: 1 })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${b.id}/approve`).expect(200);
      const get = async (q: string) =>
        (await admin.agent.get(`/v1/admin/sr/sales?${q}`).expect(200)).body;
      expect((await get('')).total).toBe(2);
      expect((await get(`srId=${srA.id}`)).total).toBe(1);
      expect((await get(`shopId=${s2}`)).items[0].id).toBe(b.id);
      expect((await get('status=approved')).total).toBe(1);
    });

    it('lists pickable variants with stock, images optional', async () => {
      const v = await makeVariant(7, { title: 'Blue Cap' });
      await makeVariant(3, { dropship: true, title: 'Blue Dropship' });
      const res = (await srA.agent.get('/v1/portal/sr/products?q=blue').expect(200)).body;
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ variantId: v, available: 7, priceP: 50_000, image: null });
      await submit(srA.agent, await makeShop(), v, { qty: 3 });
      const again = (await srA.agent.get('/v1/portal/sr/products?q=blue').expect(200)).body;
      expect(again[0].available).toBe(4);
    });
  });

  describe('ledger and collections', () => {
    async function dueShop(due: number) {
      const v = await makeVariant(100);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: due })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(200);
      return { shopId, saleId: sale.id as string };
    }

    it('collections count only after staff confirm; the trigger blocks edits', async () => {
      const { shopId } = await dueShop(100_000);
      const col = (
        await srA.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 30_000, method: 'bkash', note: 'tnx 1' })
          .expect(201)
      ).body;
      expect(col).toMatchObject({ type: 'collection', amountP: -30_000, confirmed: false });
      expect(await shopDue(shopId)).toBe(100_000);

      // over-collecting beyond the open due (incl. pending) is refused
      const over = await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 70_001, method: 'cash' })
        .expect(409);
      expect(over.body.code).toBe('EXCEEDS_DUE');
      await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 0, method: 'cash' })
        .expect(400);
      await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 5, method: 'gold' })
        .expect(400);

      // an SR cannot confirm; staff with sr.approve can, once
      await srA.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(403);
      const pending = (await admin.agent.get('/v1/admin/b2b/collections').expect(200)).body;
      expect(pending.items.map((r: { id: string }) => r.id)).toEqual([col.id]);
      const ok = await admin.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(200);
      expect(ok.body).toMatchObject({ confirmed: true, confirmedBy: { id: admin.id } });
      expect(await shopDue(shopId)).toBe(70_000);
      const again = await admin.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(409);
      expect(again.body.code).toBe('ALREADY_CONFIRMED');
      expect((await admin.agent.get('/v1/admin/b2b/collections').expect(200)).body.total).toBe(0);

      // append-only: edits and deletes are rejected by the database
      await expect(
        prisma.$executeRaw`UPDATE b2b_ledger SET amount_p = -1 WHERE id = ${col.id}::uuid`,
      ).rejects.toThrow(/append-only|never edited|confirmed once/);
      await expect(
        prisma.$executeRaw`UPDATE b2b_ledger SET confirmed_at = NULL WHERE id = ${col.id}::uuid`,
      ).rejects.toThrow();
      await expect(
        prisma.$executeRaw`DELETE FROM b2b_ledger WHERE id = ${col.id}::uuid`,
      ).rejects.toThrow(/append-only/);
      expect(await ledgerSum(shopId)).toBe(await shopDue(shopId));
    });

    it('confirming something that is not a collection is refused', async () => {
      const { shopId } = await dueShop(1000);
      const row = await prisma.b2bLedger.findFirstOrThrow({ where: { b2bShopId: shopId } });
      const res = await admin.agent.post(`/v1/admin/b2b/ledger/${row.id}/confirm`).expect(409);
      expect(res.body.code).toBe('NOT_A_COLLECTION');
      await admin.agent.post(`/v1/admin/b2b/ledger/${randomUUID()}/confirm`).expect(404);
    });

    it('adjustments change the due and need a note and b2b.manage', async () => {
      const { shopId } = await dueShop(50_000);
      const up = await admin.agent
        .post(`/v1/admin/b2b/shops/${shopId}/adjust`)
        .send({ amountP: 5_000, note: 'old baki' })
        .expect(200);
      expect(up.body.dueBalanceP).toBe(55_000);
      const down = await admin.agent
        .post(`/v1/admin/b2b/shops/${shopId}/adjust`)
        .send({ amountP: -15_000, note: 'discount' })
        .expect(200);
      expect(down.body).toMatchObject({
        dueBalanceP: 40_000,
        entry: { type: 'adjustment', amountP: -15_000, confirmed: true },
      });
      await admin.agent
        .post(`/v1/admin/b2b/shops/${shopId}/adjust`)
        .send({ amountP: 0, note: 'x' })
        .expect(400);
      await admin.agent
        .post(`/v1/admin/b2b/shops/${shopId}/adjust`)
        .send({ amountP: 5 })
        .expect(400);
      const viewer = await actor(['b2b.view']);
      await viewer.agent
        .post(`/v1/admin/b2b/shops/${shopId}/adjust`)
        .send({ amountP: 5, note: 'x' })
        .expect(403);

      const ledger = (await admin.agent.get(`/v1/admin/b2b/shops/${shopId}/ledger`).expect(200))
        .body;
      expect(ledger.total).toBe(3);
      expect(ledger.items[0]).toMatchObject({ type: 'adjustment', amountP: -15_000 });
      expect(await ledgerSum(shopId)).toBe(40_000);
      expect(
        (await admin.agent.get('/v1/admin/b2b/shops?hasDue=true').expect(200)).body.total,
      ).toBe(1);
    });

    it('the cache matches the ledger after concurrent writes', async () => {
      const { shopId } = await dueShop(100_000);
      await Promise.all(
        [1, 2, 3, 4].map((i) =>
          admin.agent
            .post(`/v1/admin/b2b/shops/${shopId}/adjust`)
            .send({ amountP: i * 100, note: `a${i}` })
            .expect(200),
        ),
      );
      expect(await shopDue(shopId)).toBe(101_000);
      expect(await ledgerSum(shopId)).toBe(101_000);
    });
  });

  describe('profiles, targets, commissions', () => {
    const month = monthKey(new Date());

    it('manages profiles; commission rate falls back to the store default', async () => {
      const staff = await actor(['products.view']);
      await admin.agent.get(`/v1/admin/sr/profiles/${staff.id}`).expect(404);
      const made = await admin.agent
        .put(`/v1/admin/sr/profiles/${staff.id}`)
        .send({ area: 'Uttara' })
        .expect(200);
      expect(made.body).toMatchObject({
        area: 'Uttara',
        commissionBp: null,
        effectiveCommissionBp: 100,
      });
      const set = await admin.agent
        .put(`/v1/admin/sr/profiles/${staff.id}`)
        .send({ commissionBp: 250 })
        .expect(200);
      expect(set.body).toMatchObject({
        area: 'Uttara',
        commissionBp: 250,
        effectiveCommissionBp: 250,
      });
      await admin.agent
        .put(`/v1/admin/sr/profiles/${staff.id}`)
        .send({ commissionBp: 10_001 })
        .expect(400);
      await admin.agent
        .put(`/v1/admin/sr/profiles/${randomUUID()}`)
        .send({ area: 'x' })
        .expect(404);
      expect((await admin.agent.get('/v1/admin/sr/profiles').expect(200)).body).toHaveLength(3);
      await srA.agent.put(`/v1/admin/sr/profiles/${staff.id}`).send({}).expect(403);
    });

    it('targets show up in the SR portal numbers', async () => {
      const put = await admin.agent
        .put(`/v1/admin/sr/targets?month=${month}`)
        .send({ targets: [{ srStaffId: srA.id, targetP: 5_000_000 }] })
        .expect(200);
      expect(
        put.body.items.find((i: { srStaffId: string }) => i.srStaffId === srA.id).targetP,
      ).toBe(5_000_000);
      expect(
        put.body.items.find((i: { srStaffId: string }) => i.srStaffId === srB.id).targetP,
      ).toBeNull();
      await admin.agent
        .put(`/v1/admin/sr/targets?month=${month}`)
        .send({ targets: [{ srStaffId: srA.id, targetP: 6_000_000 }] })
        .expect(200);
      const me = (await srA.agent.get('/v1/portal/sr/me').expect(200)).body;
      expect(me).toMatchObject({
        staff: { id: srA.id },
        profile: { area: 'Mirpur', commissionBp: 100 },
        month: { month, targetP: 6_000_000 },
      });
      await admin.agent
        .put('/v1/admin/sr/targets?month=2026-13')
        .send({ targets: [{ srStaffId: srA.id, targetP: 1 }] })
        .expect(400);
      await admin.agent
        .put(`/v1/admin/sr/targets?month=${month}`)
        .send({ targets: [{ srStaffId: randomUUID(), targetP: 1 }] })
        .expect(404);
    });

    it('computes commission on payment at sale + confirmed collections, idempotently', async () => {
      const v = await makeVariant(100);
      const shopId = await makeShop();
      // sale 1: total 100_000, paid 40_000 at sale, approved
      const s1 = (
        await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: 100_000, paidAtSaleP: 40_000 })
      ).body;
      await admin.agent.post(`/v1/admin/sr/sales/${s1.id}/approve`).expect(200);
      // sale 2: only submitted, its payment must not count
      await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: 100_000, paidAtSaleP: 100_000 });
      // collections: one confirmed (counts), one pending (does not)
      const c1 = (
        await srA.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 20_000, method: 'cash' })
          .expect(201)
      ).body;
      await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 10_000, method: 'cash' })
        .expect(201);
      await admin.agent.post(`/v1/admin/b2b/ledger/${c1.id}/confirm`).expect(200);
      // SR B sells with an override rate
      await prisma.srProfile.update({ where: { staffId: srB.id }, data: { commissionBp: 500 } });
      const s2 = (
        await submit(srB.agent, shopId, v, { qty: 1, unitPriceP: 200_000, paidAtSaleP: 200_000 })
      ).body;
      await admin.agent.post(`/v1/admin/sr/sales/${s2.id}/approve`).expect(200);

      const first = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(first.skipped).toBe(0);
      const a = first.items.find((i: { sr: { id: string } }) => i.sr.id === srA.id);
      const b = first.items.find((i: { sr: { id: string } }) => i.sr.id === srB.id);
      expect(a).toMatchObject({
        baseP: 60_000,
        commissionBp: 100,
        amountP: 600,
        status: 'pending',
      });
      expect(b).toMatchObject({ baseP: 200_000, commissionBp: 500, amountP: 10_000 });

      // re-run: same rows, same numbers
      const second = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(second.items.map((i: { id: string }) => i.id).sort()).toEqual(
        first.items.map((i: { id: string }) => i.id).sort(),
      );
      expect(await prisma.srCommission.count()).toBe(2);

      // another confirmed collection changes the pending row on the next run
      const c2 = await prisma.b2bLedger.findFirstOrThrow({
        where: { type: 'collection', confirmedAt: null },
      });
      await admin.agent.post(`/v1/admin/b2b/ledger/${c2.id}/confirm`).expect(200);
      const third = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(third.items.find((i: { sr: { id: string } }) => i.sr.id === srA.id)).toMatchObject({
        baseP: 70_000,
        amountP: 700,
        id: a.id,
      });

      // the portal shows the same numbers
      const me = (await srA.agent.get('/v1/portal/sr/me').expect(200)).body.month;
      expect(me).toMatchObject({
        soldP: 100_000,
        collectedP: 70_000,
        commissionP: 700,
        pendingCollectionP: 0,
        dueOutstandingP: 30_000,
      });

      // approved and paid rows are frozen
      await admin.agent.post(`/v1/admin/sr/commissions/${a.id}/paid`).expect(409); // approve first
      await admin.agent.post(`/v1/admin/sr/commissions/${a.id}/approve`).expect(200);
      await admin.agent.post(`/v1/admin/sr/commissions/${a.id}/approve`).expect(409);
      const paid = await admin.agent.post(`/v1/admin/sr/commissions/${a.id}/paid`).expect(200);
      expect(paid.body.status).toBe('paid');
      expect(paid.body.paidAt).not.toBeNull();
      const c3 = (
        await srA.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 5_000, method: 'cash' })
          .expect(201)
      ).body;
      await admin.agent.post(`/v1/admin/b2b/ledger/${c3.id}/confirm`).expect(200);
      const fourth = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(fourth.skipped).toBe(1);
      expect(fourth.items.find((i: { id: string }) => i.id === a.id)).toMatchObject({
        baseP: 70_000,
        status: 'paid',
      });

      const list = (await admin.agent.get(`/v1/admin/sr/commissions?month=${month}`).expect(200))
        .body;
      expect(list.items).toHaveLength(2);
      const summary = (await admin.agent.get(`/v1/admin/sr/summary?month=${month}`).expect(200))
        .body;
      expect(
        summary.items.find((i: { srStaffId: string }) => i.srStaffId === srB.id),
      ).toMatchObject({ soldP: 200_000, collectedP: 200_000 });
    });

    it('uses the store default rate setting when the profile has none', async () => {
      await app.get(SettingsService); // ensure registry loaded
      await prisma.setting.upsert({
        where: { key: 'sr_default_commission_bp' },
        create: { key: 'sr_default_commission_bp', value: 300 },
        update: { value: 300 },
      });
      await app
        .get<import('ioredis').default>((await import('../src/redis/redis.module')).REDIS)
        .flushdb();
      const v = await makeVariant(10);
      const shopId = await makeShop();
      const s = (
        await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: 100_000, paidAtSaleP: 100_000 })
      ).body;
      await admin.agent.post(`/v1/admin/sr/sales/${s.id}/approve`).expect(200);
      const out = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(out.items[0]).toMatchObject({ commissionBp: 300, amountP: 3_000 });
    });
  });

  describe('wave 3: delivery choice, reject collection, reverse, public memo', () => {
    const month = monthKey(new Date());

    async function approvedSale(
      over: {
        qty?: number;
        unitPriceP?: number;
        paidAtSaleP?: number;
        deliveryBy?: 'sr' | 'staff';
      } = {},
      stock = 50,
    ) {
      const v = await makeVariant(stock);
      const shopId = await makeShop();
      const res = await srA.agent.post('/v1/portal/sr/sales').send({
        b2bShopId: shopId,
        items: [{ variantId: v, qty: over.qty ?? 10, unitPriceP: over.unitPriceP ?? 40_000 }],
        paidAtSaleP: over.paidAtSaleP ?? 0,
        ...(over.deliveryBy && { deliveryBy: over.deliveryBy }),
      });
      expect(res.status).toBe(201);
      await admin.agent.post(`/v1/admin/sr/sales/${res.body.id}/approve`).expect(200);
      return { v, shopId, id: res.body.id as string };
    }

    it('delivery defaults to staff; an SR delivers only own sales they chose to deliver', async () => {
      const staffSale = await approvedSale();
      const own = await approvedSale({ deliveryBy: 'sr' });
      expect((await srA.agent.get(`/v1/portal/sr/sales/${staffSale.id}`)).body.deliveryBy).toBe(
        'staff',
      );
      expect((await srA.agent.get(`/v1/portal/sr/sales/${own.id}`)).body.deliveryBy).toBe('sr');

      const refused = await srA.agent
        .post(`/v1/portal/sr/sales/${staffSale.id}/deliver`)
        .expect(403);
      expect(refused.body.code).toBe('DELIVERY_BY_STAFF');
      await srB.agent.post(`/v1/portal/sr/sales/${own.id}/deliver`).expect(404);

      const done = await srA.agent.post(`/v1/portal/sr/sales/${own.id}/deliver`).expect(200);
      expect(done.body).toMatchObject({ status: 'delivered', deliveredBy: { id: srA.id } });
      expect(await level(own.v)).toMatchObject({ onHand: 40, reserved: 0 });
      await srA.agent.post(`/v1/portal/sr/sales/${own.id}/deliver`).expect(409);

      // staff can deliver either kind
      await admin.agent.post(`/v1/admin/sr/sales/${staffSale.id}/deliver`).expect(200);

      // not before approval
      const v = await makeVariant(5);
      const shopId = await makeShop();
      const sub = (
        await srA.agent.post('/v1/portal/sr/sales').send({
          b2bShopId: shopId,
          deliveryBy: 'sr',
          items: [{ variantId: v, qty: 1, unitPriceP: 100 }],
        })
      ).body;
      await srA.agent.post(`/v1/portal/sr/sales/${sub.id}/deliver`).expect(409);
      await srA.agent
        .post('/v1/portal/sr/sales')
        .send({
          b2bShopId: shopId,
          deliveryBy: 'drone',
          items: [{ variantId: v, qty: 1, unitPriceP: 100 }],
        })
        .expect(400);
    });

    it('rejecting a pending collection: reason, never counted, SR sees it', async () => {
      const { shopId } = await approvedSale({ qty: 1, unitPriceP: 100_000 });
      const col = (
        await srA.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 60_000, method: 'cash' })
          .expect(201)
      ).body;
      expect((await srA.agent.get('/v1/portal/sr/me')).body.month.pendingCollectionP).toBe(60_000);
      // pending blocks collecting more than the rest
      await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 60_000, method: 'cash' })
        .expect(409);

      await srA.agent
        .post(`/v1/admin/b2b/ledger/${col.id}/reject`)
        .send({ reason: 'x' })
        .expect(403);
      await admin.agent.post(`/v1/admin/b2b/ledger/${col.id}/reject`).send({}).expect(400);
      const rej = await admin.agent
        .post(`/v1/admin/b2b/ledger/${col.id}/reject`)
        .send({ reason: 'No such payment' })
        .expect(200);
      expect(rej.body).toMatchObject({
        confirmed: false,
        rejected: true,
        rejectReason: 'No such payment',
        rejectedBy: { id: admin.id },
      });

      expect(await shopDue(shopId)).toBe(100_000);
      expect((await admin.agent.get('/v1/admin/b2b/collections').expect(200)).body.total).toBe(0);
      const listed = (
        await admin.agent.get('/v1/admin/b2b/collections?status=rejected').expect(200)
      ).body;
      expect(listed.items.map((r: { id: string }) => r.id)).toEqual([col.id]);
      const mine = (await srA.agent.get('/v1/portal/sr/collections').expect(200)).body.items[0];
      expect(mine).toMatchObject({
        rejected: true,
        rejectReason: 'No such payment',
        confirmed: false,
      });
      const me = (await srA.agent.get('/v1/portal/sr/me')).body.month;
      expect(me).toMatchObject({ pendingCollectionP: 0, collectedP: 0, dueOutstandingP: 100_000 });

      // resolved once: no confirm after reject, no reject after confirm
      expect(
        (await admin.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(409)).body.code,
      ).toBe('ALREADY_REJECTED');
      expect(
        (
          await admin.agent
            .post(`/v1/admin/b2b/ledger/${col.id}/reject`)
            .send({ reason: 'again' })
            .expect(409)
        ).body.code,
      ).toBe('ALREADY_REJECTED');
      const col2 = (
        await srA.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 100_000, method: 'cash' })
          .expect(201)
      ).body;
      await admin.agent.post(`/v1/admin/b2b/ledger/${col2.id}/confirm`).expect(200);
      expect(
        (
          await admin.agent
            .post(`/v1/admin/b2b/ledger/${col2.id}/reject`)
            .send({ reason: 'late' })
            .expect(409)
        ).body.code,
      ).toBe('ALREADY_CONFIRMED');
      expect(await shopDue(shopId)).toBe(0);

      // not a collection
      const dueRow = await prisma.b2bLedger.findFirstOrThrow({ where: { type: 'sale_due' } });
      expect(
        (
          await admin.agent
            .post(`/v1/admin/b2b/ledger/${dueRow.id}/reject`)
            .send({ reason: 'x' })
            .expect(409)
        ).body.code,
      ).toBe('NOT_A_COLLECTION');

      // commission ignores the rejected one
      const out = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(out.items[0]).toMatchObject({ baseP: 100_000 });

      // the database refuses to touch a resolved row
      await expect(
        prisma.$executeRaw`UPDATE b2b_ledger SET reject_reason = 'edited' WHERE id = ${col.id}::uuid`,
      ).rejects.toThrow();
      await expect(
        prisma.$executeRaw`UPDATE b2b_ledger SET confirmed_at = now(), confirmed_by_id = ${admin.id}::uuid WHERE id = ${col.id}::uuid`,
      ).rejects.toThrow();
    });

    it('reverses an approved sale: due cancelled, reservation released', async () => {
      const { v, shopId, id } = await approvedSale({ paidAtSaleP: 100_000 });
      expect(await shopDue(shopId)).toBe(300_000);
      expect(await level(v)).toMatchObject({ onHand: 50, reserved: 10 });

      await srA.agent.post(`/v1/admin/sr/sales/${id}/reverse`).send({ reason: 'x' }).expect(403);
      await admin.agent.post(`/v1/admin/sr/sales/${id}/reverse`).send({}).expect(400);
      const res = await admin.agent
        .post(`/v1/admin/sr/sales/${id}/reverse`)
        .send({ reason: 'Shop refused' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'reversed',
        reverseReason: 'Shop refused',
        reversedBy: { id: admin.id },
      });
      expect(await shopDue(shopId)).toBe(0);
      const rows = await prisma.b2bLedger.findMany({
        where: { b2bShopId: shopId },
        orderBy: { id: 'asc' },
      });
      expect(rows.map((r) => [r.type, r.amountP])).toEqual([
        ['sale_due', 300_000],
        ['reversal', -300_000],
      ]);
      expect(await ledgerSum(shopId)).toBe(0);
      expect(await level(v)).toMatchObject({ onHand: 50, reserved: 0 });
      const moves = await prisma.stockMovement.findMany({
        where: { variantId: v, refId: id },
        orderBy: { id: 'asc' },
      });
      expect(moves.map((m) => m.reason)).toEqual(['sr_reserve', 'sr_release']);

      // final: no second reverse, no deliver, no approve
      await admin.agent
        .post(`/v1/admin/sr/sales/${id}/reverse`)
        .send({ reason: 'again' })
        .expect(409);
      await admin.agent.post(`/v1/admin/sr/sales/${id}/deliver`).expect(409);
      await srA.agent.post(`/v1/portal/sr/sales/${id}/cancel`).expect(409);
    });

    it('reverses a delivered sale: goods back on hand; collected money becomes credit', async () => {
      const { v, shopId, id } = await approvedSale({ qty: 10, unitPriceP: 10_000 });
      await admin.agent.post(`/v1/admin/sr/sales/${id}/deliver`).expect(200);
      expect(await level(v)).toMatchObject({ onHand: 40, reserved: 0 });
      const col = (
        await srA.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 30_000, method: 'cash' })
          .expect(201)
      ).body;
      await admin.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(200);
      expect(await shopDue(shopId)).toBe(70_000);

      await admin.agent
        .post(`/v1/admin/sr/sales/${id}/reverse`)
        .send({ reason: 'Returned' })
        .expect(200);
      expect(await level(v)).toMatchObject({ onHand: 50, reserved: 0 });
      const moves = await prisma.stockMovement.findMany({
        where: { variantId: v, refId: id },
        orderBy: { id: 'asc' },
      });
      expect(moves.map((m) => [m.reason, m.qtyDelta, m.reservedDelta])).toEqual([
        ['sr_reserve', 0, 10],
        ['sr_ship', -10, -10],
        ['return_restock', 10, 0],
      ]);
      // the 300 already paid stays a collection: the shop is now in credit
      expect(await shopDue(shopId)).toBe(-30_000);
      expect(await ledgerSum(shopId)).toBe(-30_000);
      // credit can't be "collected" again
      await srA.agent
        .post('/v1/portal/sr/collections')
        .send({ b2bShopId: shopId, amountP: 1, method: 'cash' })
        .expect(409);
    });

    it('a fully paid sale reverses without a ledger row; reversed sales leave summaries and pending commission', async () => {
      const { shopId, id } = await approvedSale({
        qty: 1,
        unitPriceP: 100_000,
        paidAtSaleP: 100_000,
      });
      const keep = await approvedSale({ qty: 1, unitPriceP: 50_000, paidAtSaleP: 50_000 });
      const first = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(first.items[0]).toMatchObject({ baseP: 150_000 });
      const meBefore = (await srA.agent.get('/v1/portal/sr/me')).body.month;
      expect(meBefore).toMatchObject({ soldP: 150_000, collectedP: 150_000 });

      await admin.agent
        .post(`/v1/admin/sr/sales/${id}/reverse`)
        .send({ reason: 'void' })
        .expect(200);
      expect(await prisma.b2bLedger.count({ where: { b2bShopId: shopId } })).toBe(0);
      const meAfter = (await srA.agent.get('/v1/portal/sr/me')).body.month;
      expect(meAfter).toMatchObject({ soldP: 50_000, collectedP: 50_000 });

      // pending commission recomputes without it
      const second = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(second.items[0]).toMatchObject({ baseP: 50_000, id: first.items[0].id });

      // once approved, a later reversal does not touch it
      await admin.agent.post(`/v1/admin/sr/commissions/${first.items[0].id}/approve`).expect(200);
      await admin.agent
        .post(`/v1/admin/sr/sales/${keep.id}/reverse`)
        .send({ reason: 'void 2' })
        .expect(200);
      const third = (
        await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${month}`).expect(200)
      ).body;
      expect(third.skipped).toBe(1);
      expect(third.items[0]).toMatchObject({ baseP: 50_000, status: 'approved' });
    });

    it('cannot reverse a submitted, rejected or cancelled sale', async () => {
      const v = await makeVariant(10);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 1 })).body;
      await admin.agent
        .post(`/v1/admin/sr/sales/${sale.id}/reverse`)
        .send({ reason: 'x' })
        .expect(409);
      await admin.agent
        .post(`/v1/admin/sr/sales/${sale.id}/reject`)
        .send({ reason: 'x' })
        .expect(200);
      await admin.agent
        .post(`/v1/admin/sr/sales/${sale.id}/reverse`)
        .send({ reason: 'x' })
        .expect(409);
      await admin.agent
        .post(`/v1/admin/sr/sales/${randomUUID()}/reverse`)
        .send({ reason: 'x' })
        .expect(404);
    });

    it('public memo link: create, reuse, rotate, headers, revocation', async () => {
      const request = (await import('supertest')).default;
      const pub = () => request(app.getHttpServer());
      const v = await makeVariant(10);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 1, unitPriceP: 25_000 })).body;
      const early = await srA.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link`).expect(409);
      expect(early.body.code).toBe('NOT_APPROVED');
      await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(200);

      await srB.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link`).expect(404);
      const link = (await srA.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link`).expect(200))
        .body;
      expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(link.url).toBe(`http://localhost:4000/v1/public/memo/${link.token}`);
      const again = (await srA.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link`).expect(200))
        .body;
      expect(again.token).toBe(link.token);
      expect(
        (await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/memo-link`).expect(200)).body.token,
      ).toBe(link.token);

      const page = await pub().get(`/v1/public/memo/${link.token}`).expect(200);
      expect(page.headers['content-type']).toMatch(/text\/html/);
      expect(page.headers['x-robots-tag']).toContain('noindex');
      expect(page.headers['referrer-policy']).toBe('no-referrer');
      expect(page.headers['content-security-policy']).toContain("default-src 'none'");
      expect(page.text).toContain(sale.memoNo);
      expect((await pub().get(`/v1/public/memo/${link.token}?lang=bn`).expect(200)).text).toContain(
        'বিক্রয় মেমো',
      );

      await pub()
        .get(`/v1/public/memo/${'A'.repeat(43)}`)
        .expect(404);
      await pub().get('/v1/public/memo/short').expect(404);

      // rotating revokes the old link
      const next = (
        await srA.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link?rotate=1`).expect(200)
      ).body;
      expect(next.token).not.toBe(link.token);
      await pub().get(`/v1/public/memo/${link.token}`).expect(404);
      await pub().get(`/v1/public/memo/${next.token}`).expect(200);

      // reversed sales stop resolving; no new link either
      await admin.agent
        .post(`/v1/admin/sr/sales/${sale.id}/reverse`)
        .send({ reason: 'void' })
        .expect(200);
      await pub().get(`/v1/public/memo/${next.token}`).expect(404);
      await srA.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link`).expect(409);
      await srA.agent.get(`/v1/portal/sr/sales/${sale.id}/memo`).expect(409);
    });

    it('rate limits the public memo endpoint per IP', async () => {
      const request = (await import('supertest')).default;
      const codes: number[] = [];
      for (let i = 0; i < 62; i++) {
        codes.push(
          (await request(app.getHttpServer()).get(`/v1/public/memo/${'B'.repeat(43)}`)).status,
        );
      }
      expect(codes.slice(0, 60).every((c) => c === 404)).toBe(true);
      expect(codes.slice(60)).toEqual([429, 429]);
    });
  });

  describe('wave 4: commission adjustments, review fixes, admin gaps', () => {
    const month = monthKey(new Date());
    const monthAfter = (n: number) => {
      const [y, m] = month.split('-').map(Number) as [number, number];
      const d = new Date(Date.UTC(y, m - 1 + n, 15, 6));
      return { key: monthKey(d), at: d };
    };

    async function approved(agent: Agent, paid: number, opts: { at?: Date; shopId?: string } = {}) {
      const v = await makeVariant(20);
      const shopId = opts.shopId ?? (await makeShop(agent));
      const res = await submit(agent, shopId, v, {
        qty: 1,
        unitPriceP: paid + 50_000,
        paidAtSaleP: paid,
      });
      expect(res.status).toBe(201);
      await admin.agent.post(`/v1/admin/sr/sales/${res.body.id}/approve`).expect(200);
      if (opts.at) {
        await prisma.srSale.update({ where: { id: res.body.id }, data: { approvedAt: opts.at } });
      }
      return { id: res.body.id as string, shopId, v };
    }

    const compute = async (m: string) =>
      (await admin.agent.post(`/v1/admin/sr/commissions/compute?month=${m}`).expect(200)).body;

    it('reversing a sale in a locked commission month creates an adjustment applied by a later run', async () => {
      const sale1 = await approved(srA.agent, 100_000); // commission 1,000
      const first = await compute(month);
      expect(first.items[0].amountP).toBe(1000);
      await admin.agent.post(`/v1/admin/sr/commissions/${first.items[0].id}/approve`).expect(200);
      await admin.agent.post(`/v1/admin/sr/commissions/${first.items[0].id}/paid`).expect(200);

      await admin.agent
        .post(`/v1/admin/sr/sales/${sale1.id}/reverse`)
        .send({ reason: 'returned' })
        .expect(200);
      const open = (
        await admin.agent
          .get(`/v1/admin/sr/commission-adjustments?srId=${srA.id}&applied=false`)
          .expect(200)
      ).body;
      expect(open.total).toBe(1);
      expect(open.items[0]).toMatchObject({
        amountP: -1000,
        srSaleId: sale1.id,
        sr: { id: srA.id },
        appliedTo: null,
      });
      expect(open.items[0].memoNo).toMatch(/^SR-/);
      await srA.agent.get('/v1/admin/sr/commission-adjustments').expect(403);

      // next month earns 500: the deduction takes it to 0 and carries the remaining 500
      const next = monthAfter(1);
      await approved(srA.agent, 50_000, { at: next.at });
      const second = await compute(next.key);
      const row = second.items.find((i: { sr: { id: string } }) => i.sr.id === srA.id);
      expect(row).toMatchObject({ baseP: 50_000, amountP: 0, adjustmentP: -500 });
      expect(row.adjustments).toHaveLength(1);
      expect(
        (
          await admin.agent.get('/v1/admin/sr/commission-adjustments?applied=false').expect(200)
        ).body.items.map((a: { amountP: number }) => a.amountP),
      ).toEqual([-500]);
      // same result when run again
      const again = (await compute(next.key)).items.find(
        (i: { sr: { id: string } }) => i.sr.id === srA.id,
      );
      expect(again).toMatchObject({ id: row.id, amountP: 0, adjustmentP: -500 });
      expect(
        (await admin.agent.get('/v1/admin/sr/commission-adjustments?applied=false').expect(200))
          .body.total,
      ).toBe(1);

      // the month after: 1,000 earned, remaining 500 deducted
      const later = monthAfter(2);
      await approved(srA.agent, 100_000, { at: later.at });
      const third = (await compute(later.key)).items.find(
        (i: { sr: { id: string } }) => i.sr.id === srA.id,
      );
      expect(third).toMatchObject({ amountP: 500, adjustmentP: -500 });
      expect(
        (await admin.agent.get('/v1/admin/sr/commission-adjustments?applied=false').expect(200))
          .body.total,
      ).toBe(0);
      const listed = (
        await admin.agent.get(`/v1/admin/sr/commissions?month=${later.key}`).expect(200)
      ).body;
      expect(listed.items[0].adjustments).toHaveLength(1);
      // the paid row of the original month never changed
      const paidRow = await prisma.srCommission.findFirstOrThrow({
        where: { month, srStaffId: srA.id },
      });
      expect(paidRow).toMatchObject({ amountP: 1000, status: 'paid' });
    });

    it('no adjustment while the month is still pending, or when nothing was paid at sale', async () => {
      const a = await approved(srA.agent, 100_000);
      await compute(month); // pending
      await admin.agent
        .post(`/v1/admin/sr/sales/${a.id}/reverse`)
        .send({ reason: 'x' })
        .expect(200);
      expect(await prisma.srCommissionAdjustment.count()).toBe(0);
      const row = await prisma.srCommission.findFirstOrThrow({ where: { srStaffId: srA.id } });
      await admin.agent.post(`/v1/admin/sr/commissions/${row.id}/approve`).expect(200);
      const b = await approved(srA.agent, 0);
      await admin.agent
        .post(`/v1/admin/sr/sales/${b.id}/reverse`)
        .send({ reason: 'x' })
        .expect(200);
      expect(await prisma.srCommissionAdjustment.count()).toBe(0);
    });

    it('collections cannot be confirmed by whoever recorded them', async () => {
      const both = await actor(['sr.portal', 'sr.approve'], true);
      const v = await makeVariant(5);
      const shopId = await makeShop(both.agent);
      const s = (await submit(both.agent, shopId, v, { qty: 1, unitPriceP: 100_000 })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${s.id}/approve`).expect(200);
      const col = (
        await both.agent
          .post('/v1/portal/sr/collections')
          .send({ b2bShopId: shopId, amountP: 1000, method: 'cash' })
          .expect(201)
      ).body;
      const res = await both.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(403);
      expect(res.body.code).toBe('SELF_CONFIRM');
      await admin.agent.post(`/v1/admin/b2b/ledger/${col.id}/confirm`).expect(200);
    });

    it('refuses a shop balance outside the int range instead of wrapping', async () => {
      const shopId = await makeShop();
      const adj = (amountP: number) =>
        admin.agent.post(`/v1/admin/b2b/shops/${shopId}/adjust`).send({ amountP, note: 'x' });
      await adj(2_000_000_000).expect(200);
      const over = await adj(2_000_000_000).expect(409);
      expect(over.body.code).toBe('LEDGER_OVERFLOW');
      expect(await shopDue(shopId)).toBe(2_000_000_000);
      expect(await prisma.b2bLedger.count({ where: { b2bShopId: shopId } })).toBe(1);
    });

    it('keeps staff notes away from SRs', async () => {
      const shopId = await makeShop();
      await admin.agent
        .patch(`/v1/admin/b2b/shops/${shopId}`)
        .send({ notes: 'slow payer' })
        .expect(200);
      const one = (await srA.agent.get(`/v1/portal/sr/shops/${shopId}`).expect(200)).body;
      const list = (await srB.agent.get('/v1/portal/sr/shops').expect(200)).body.items[0];
      const created = (
        await srA.agent
          .post('/v1/portal/sr/shops')
          .send({ name: 'N', phone: '01800000000', address: 'x' })
          .expect(201)
      ).body;
      for (const shop of [one, list, created]) expect(shop).not.toHaveProperty('notes');
      expect((await admin.agent.get(`/v1/admin/b2b/shops/${shopId}`).expect(200)).body.notes).toBe(
        'slow payer',
      );
    });

    it('caps the number of open submitted sales per SR', async () => {
      const v = await makeVariant(10);
      const shopId = await makeShop();
      await prisma.srSale.createMany({
        data: Array.from({ length: 50 }, (_, i) => ({
          memoNo: `SR-TEST-${i}`,
          srStaffId: srA.id,
          b2bShopId: shopId,
          totalP: 100,
          dueP: 100,
        })),
      });
      const res = await submit(srA.agent, shopId, v, { qty: 1 });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('TOO_MANY_OPEN_SALES');
      expect((await submit(srB.agent, shopId, v, { qty: 1 })).status).toBe(201);
    });

    it('public memo keeps working in maintenance mode', async () => {
      const request = (await import('supertest')).default;
      const v = await makeVariant(5);
      const shopId = await makeShop();
      const sale = (await submit(srA.agent, shopId, v, { qty: 1 })).body;
      await admin.agent.post(`/v1/admin/sr/sales/${sale.id}/approve`).expect(200);
      const link = (await srA.agent.post(`/v1/portal/sr/sales/${sale.id}/memo-link`).expect(200))
        .body;
      await prisma.setting.upsert({
        where: { key: 'maintenance_mode' },
        create: {
          key: 'maintenance_mode',
          value: { enabled: true, message: { en: 'x', bn: 'x' } },
        },
        update: { value: { enabled: true, message: { en: 'x', bn: 'x' } } },
      });
      await app
        .get<import('ioredis').default>((await import('../src/redis/redis.module')).REDIS)
        .flushdb();
      await request(app.getHttpServer()).get('/v1/public/categories/tree').expect(503);
      await request(app.getHttpServer()).get(`/v1/public/memo/${link.token}`).expect(200);
    });

    it('filters admin sales by month and lists SRs for filters', async () => {
      const v = await makeVariant(10);
      const shopId = await makeShop();
      const old = (await submit(srA.agent, shopId, v, { qty: 1 })).body;
      await submit(srA.agent, shopId, v, { qty: 1 });
      const prev = monthAfter(-1);
      await prisma.srSale.update({ where: { id: old.id }, data: { submittedAt: prev.at } });
      const get = async (m: string) =>
        (await admin.agent.get(`/v1/admin/sr/sales?month=${m}`).expect(200)).body;
      expect((await get(month)).total).toBe(1);
      expect((await get(prev.key)).items.map((i: { id: string }) => i.id)).toEqual([old.id]);
      await admin.agent.get('/v1/admin/sr/sales?month=2026-99').expect(400);

      const list = (await admin.agent.get('/v1/admin/sr/list').expect(200)).body;
      expect(list.map((r: { staffId: string }) => r.staffId).sort()).toEqual(
        [srA.id, srB.id].sort(),
      );
      expect(list[0]).toHaveProperty('name');
      await srA.agent.get('/v1/admin/sr/list').expect(403);
    });

    it('ages dues oldest-first against collections', async () => {
      const day = 86_400_000;
      const { shopId } = await approved(srA.agent, 0); // 50,000 due, today
      const row = (amountP: number, daysAgo: number, extra: object = {}) => ({
        b2bShopId: shopId,
        type: 'sale_due' as const,
        amountP,
        recordedById: srA.id,
        at: new Date(Date.now() - daysAgo * day),
        ...extra,
      });
      await prisma.b2bLedger.createMany({
        data: [
          row(300_000, 100),
          row(200_000, 45),
          row(-250_000, 10, {
            type: 'collection',
            confirmedById: admin.id,
            confirmedAt: new Date(Date.now() - 10 * day),
          }),
          // pending and rejected collections do not count
          row(-999, 5, { type: 'collection' }),
          row(-998, 5, {
            type: 'collection',
            rejectedById: admin.id,
            rejectedAt: new Date(),
            rejectReason: 'x',
          }),
        ],
      });
      const res = (await admin.agent.get('/v1/admin/b2b/dues').expect(200)).body;
      expect(res.items).toHaveLength(1);
      const item = res.items.find((i: { shop: { id: string } }) => i.shop.id === shopId);
      // 250,000 of collections clear the 100-day-old 300,000 first
      expect(item.buckets).toEqual({ d0_30: 50_000, d31_60: 200_000, d61_90: 0, d90plus: 50_000 });
      expect(item.dueP).toBe(300_000);
      expect(item.srs.map((s: { id: string }) => s.id)).toEqual([srA.id]);
      expect(item.lastCollectionAt).not.toBeNull();
      expect(res.totals.dueP).toBe(
        res.items.reduce((s: number, i: { dueP: number }) => s + i.dueP, 0),
      );

      // as of 50 days ago only the old due existed
      const asOf = new Date(Date.now() - 50 * day).toISOString().slice(0, 10);
      const past = (await admin.agent.get(`/v1/admin/b2b/dues?asOf=${asOf}`).expect(200)).body;
      expect(past.items).toHaveLength(1);
      expect(past.items[0]).toMatchObject({
        dueP: 300_000,
        buckets: { d31_60: 300_000 },
        lastCollectionAt: null,
      });

      await admin.agent.get('/v1/admin/b2b/dues?asOf=yesterday').expect(400);
      await srA.agent.get('/v1/admin/b2b/dues').expect(403);
    });
  });
});
