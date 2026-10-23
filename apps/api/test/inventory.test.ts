import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, createStaffWith, resetDb } from './helpers';

describe('inventory', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inventory: InventoryService;
  let categoryId: string;
  let seq = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    inventory = app.get(InventoryService);
  });
  beforeEach(async () => {
    await resetDb(app);
    categoryId = randomUUID();
    await prisma.category.create({
      data: { id: categoryId, level: 1, path: `/${categoryId}/`, nameEn: 'Root', slug: 'root' },
    });
  });
  afterAll(() => app.close());

  async function makeProduct(
    titleEn: string,
    opts: { fulfillment?: 'stock' | 'dropship'; categoryId?: string; skus?: string[] } = {},
  ) {
    seq += 1;
    const cat = opts.categoryId ?? categoryId;
    const seller = await prisma.seller.findFirstOrThrow();
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        primaryCategoryId: cat,
        titleEn,
        slug: `p-${seq}`,
        fulfillment: opts.fulfillment ?? 'stock',
        categories: { create: { categoryId: cat } },
        variants: {
          create: (opts.skus ?? [`SKU-${seq}`]).map((sku) => ({ sku, priceP: 10000 })),
        },
      },
      include: { variants: true },
    });
    return product;
  }

  const move = (variantId: string, qtyDelta: number, reservedDelta = 0) =>
    prisma.$transaction((tx) =>
      inventory.move(tx, { variantId, qtyDelta, reservedDelta, reason: 'adjust' }),
    );

  it('move creates the row, applies deltas and writes append-only ledger rows', async () => {
    const [v] = (await makeProduct('Shirt')).variants;
    const variantId = v?.id as string;
    const staff = await prisma.staff.findFirst();

    expect(await move(variantId, 10)).toEqual({ onHand: 10, reserved: 0, available: 10 });
    expect(await move(variantId, 0, 4)).toEqual({ onHand: 10, reserved: 4, available: 6 });
    await prisma.$transaction((tx) =>
      inventory.move(tx, {
        variantId,
        qtyDelta: -4,
        reservedDelta: -4,
        reason: 'ship',
        refType: 'order',
        refId: 'o-1',
        staffId: staff?.id,
        note: 'shipped',
      }),
    );

    const rows = await prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: { at: 'asc' },
    });
    expect(rows.map((r) => [r.qtyDelta, r.reservedDelta, r.reason])).toEqual([
      [10, 0, 'adjust'],
      [0, 4, 'adjust'],
      [-4, -4, 'ship'],
    ]);
    expect(rows[2]).toMatchObject({ refType: 'order', refId: 'o-1', note: 'shipped' });
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).toMatchObject({
      onHand: 6,
      reserved: 0,
    });
  });

  it('rejects moves that break stock rules and leaves no trace', async () => {
    const [v] = (await makeProduct('Shirt')).variants;
    const variantId = v?.id as string;
    await move(variantId, 5);
    await expect(move(variantId, -6)).rejects.toMatchObject({ status: 409 });
    await expect(move(variantId, 0, 6)).rejects.toThrow('Not enough stock');
    await expect(move(variantId, 0, -1)).rejects.toMatchObject({ status: 409 });
    await move(variantId, 0, 5);
    await expect(move(variantId, -1)).rejects.toMatchObject({ status: 409 });
    await expect(move(randomUUID(), 1)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.stockMovement.count({ where: { variantId } })).toBe(2);

    // zero moves leave no ledger row, except stocktake 'adjust'
    await prisma.$transaction((tx) =>
      inventory.move(tx, { variantId, qtyDelta: 0, reservedDelta: 0, reason: 'ship' }),
    );
    expect(await prisma.stockMovement.count({ where: { variantId } })).toBe(2);
    await move(variantId, 0);
    expect(await prisma.stockMovement.count({ where: { variantId } })).toBe(3);
  });

  it('allows reserving beyond on-hand for dropship products', async () => {
    const [v] = (await makeProduct('Dropped', { fulfillment: 'dropship' })).variants;
    expect(await move(v?.id as string, 0, 3)).toEqual({ onHand: 0, reserved: 3, available: -3 });
  });

  it('concurrent adjustments are all applied', async () => {
    const { agent } = await createOwner(app);
    const [v] = (await makeProduct('Busy')).variants;
    const variantId = v?.id as string;
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        agent
          .post(`/v1/admin/inventory/${variantId}/adjust`)
          .send({ mode: 'delta', qty: i + 1, note: `batch ${i}` })
          .expect(200),
      ),
    );
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).toMatchObject({
      onHand: 55,
    });
    expect(await prisma.stockMovement.count({ where: { variantId } })).toBe(10);

    // concurrent withdrawals: exactly the available quantity succeeds
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        agent
          .post(`/v1/admin/inventory/${variantId}/adjust`)
          .send({ mode: 'delta', qty: -5, note: 'out' }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(11);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).toMatchObject({
      onHand: 0,
    });
  });

  it('adjust supports delta and set, validates the note and records the actor', async () => {
    const { agent } = await createOwner(app);
    const [v] = (await makeProduct('Shirt')).variants;
    const url = `/v1/admin/inventory/${v?.id}/adjust`;

    const first = await agent
      .post(url)
      .send({ mode: 'delta', qty: 12, note: 'Opening stock' })
      .expect(200);
    expect(first.body).toMatchObject({ onHand: 12, reserved: 0, available: 12 });
    const set = await agent.post(url).send({ mode: 'set', qty: 7, note: 'Recount' }).expect(200);
    expect(set.body.onHand).toBe(7);
    await agent.post(url).send({ mode: 'set', qty: 7, note: 'Same again' }).expect(200);
    await agent.post(url).send({ mode: 'delta', qty: -8, note: 'Too many' }).expect(409);
    await agent.post(url).send({ mode: 'set', qty: -1, note: 'Negative' }).expect(409);
    await agent.post(url).send({ mode: 'delta', qty: 1 }).expect(400);
    await agent.post(url).send({ mode: 'delta', qty: 1, note: '  ' }).expect(400);
    await agent.post(url).send({ mode: 'bogus', qty: 1, note: 'x' }).expect(400);
    await agent
      .post(`/v1/admin/inventory/${randomUUID()}/adjust`)
      .send({ mode: 'delta', qty: 1, note: 'x' })
      .expect(404);

    const movements = await agent.get(`/v1/admin/inventory/${v?.id}/movements`).expect(200);
    expect(movements.body.total).toBe(3);
    expect(movements.body.items.map((m: { qtyDelta: number }) => m.qtyDelta)).toEqual([0, -5, 12]);
    expect(movements.body.items[0]).toMatchObject({ reason: 'adjust', note: 'Same again' });
    expect(movements.body.items[1]).toMatchObject({
      reason: 'adjust',
      note: 'Recount',
      staff: { name: 'Owner One' },
    });
    const paged = await agent
      .get(`/v1/admin/inventory/${v?.id}/movements?page=3&pageSize=1`)
      .expect(200);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.items[0].note).toBe('Opening stock');
  });

  it('lists variants with filters, thresholds and the low-stock badge count', async () => {
    const { agent } = await createOwner(app);
    const child = randomUUID();
    await prisma.category.create({
      data: {
        id: child,
        parentId: categoryId,
        level: 2,
        path: `/${categoryId}/${child}/`,
        nameEn: 'Child',
        slug: 'child',
      },
    });
    const other = randomUUID();
    await prisma.category.create({
      data: { id: other, level: 1, path: `/${other}/`, nameEn: 'Other', slug: 'other' },
    });

    const shirt = await makeProduct('Blue Shirt', { skus: ['SH-S', 'SH-M'], categoryId: child });
    const mug = await makeProduct('Mug', { skus: ['MUG-1'], categoryId: other });
    const drop = await makeProduct('Drop Lamp', { fulfillment: 'dropship', skus: ['LAMP-1'] });
    const [s, m] = shirt.variants.sort((a, b) => a.sku.localeCompare(b.sku));
    const mugId = mug.variants[0]?.id as string;
    const lampId = drop.variants[0]?.id as string;

    await move(s?.id as string, 3);
    await move(m?.id as string, 20);
    await move(mugId, 5, 2);

    const all = await agent.get('/v1/admin/inventory').expect(200);
    expect(all.body.total).toBe(4);
    const mugRow = all.body.items.find((r: { sku: string }) => r.sku === 'MUG-1');
    expect(mugRow).toMatchObject({
      onHand: 5,
      reserved: 2,
      available: 3,
      isLow: false,
      fulfillment: 'stock',
    });
    const lampRow = all.body.items.find((r: { sku: string }) => r.sku === 'LAMP-1');
    expect(lampRow).toMatchObject({ onHand: 0, fulfillment: 'dropship' });

    // thresholds
    await agent.patch(`/v1/admin/inventory/${s?.id}`).send({ lowStockThreshold: 5 }).expect(200);
    await agent.patch(`/v1/admin/inventory/${m?.id}`).send({ lowStockThreshold: 5 }).expect(200);
    const mugPatch = await agent
      .patch(`/v1/admin/inventory/${mugId}`)
      .send({ lowStockThreshold: 3 })
      .expect(200);
    expect(mugPatch.body).toMatchObject({ lowStockThreshold: 3, isLow: true });
    // threshold on a variant without an inventory row creates it
    await agent.patch(`/v1/admin/inventory/${lampId}`).send({ lowStockThreshold: 0 }).expect(200);
    await agent.patch(`/v1/admin/inventory/${lampId}`).send({ lowStockThreshold: -1 }).expect(400);
    await agent
      .patch(`/v1/admin/inventory/${randomUUID()}`)
      .send({ lowStockThreshold: 1 })
      .expect(404);

    const low = await agent.get('/v1/admin/inventory?lowStock=true').expect(200);
    expect(low.body.items.map((r: { sku: string }) => r.sku)).toEqual(['SH-M', 'LAMP-1', 'MUG-1']);
    expect((await agent.get('/v1/admin/inventory/low-stock-count').expect(200)).body).toEqual({
      count: 3,
    });

    // clearing a threshold removes it from the low list
    await agent
      .patch(`/v1/admin/inventory/${lampId}`)
      .send({ lowStockThreshold: null })
      .expect(200);
    expect((await agent.get('/v1/admin/inventory/low-stock-count')).body.count).toBe(2);

    // option labels
    const color = await prisma.productOption.create({
      data: {
        productId: shirt.id,
        position: 1,
        nameEn: 'Size',
        values: { create: [{ valueEn: 'Small', valueBn: 'ছোট' }] },
      },
      include: { values: true },
    });
    await prisma.variant.update({
      where: { id: s?.id as string },
      data: { optionValue1Id: color.values[0]?.id },
    });

    const byQ = await agent.get('/v1/admin/inventory?q=shirt').expect(200);
    expect(byQ.body.total).toBe(2);
    expect(byQ.body.items[0].optionLabels).toEqual([{ en: 'Small', bn: 'ছোট' }]);
    expect((await agent.get('/v1/admin/inventory?q=mug-1')).body.total).toBe(1);
    expect((await agent.get('/v1/admin/inventory?q=%25')).body.total).toBe(0);

    // category filter includes descendants
    expect((await agent.get(`/v1/admin/inventory?categoryId=${categoryId}`)).body.total).toBe(3);
    expect((await agent.get(`/v1/admin/inventory?categoryId=${child}`)).body.total).toBe(2);
    expect((await agent.get(`/v1/admin/inventory?categoryId=${other}`)).body.total).toBe(1);

    const drops = await agent.get('/v1/admin/inventory?fulfillment=dropship').expect(200);
    expect(drops.body.items.map((r: { sku: string }) => r.sku)).toEqual(['LAMP-1']);

    const page = await agent.get('/v1/admin/inventory?pageSize=2&page=2').expect(200);
    expect(page.body).toMatchObject({ total: 4, page: 2, pageSize: 2 });
    expect(page.body.items).toHaveLength(2);
    await agent.get('/v1/admin/inventory?pageSize=1000').expect(400);
  });

  it('excludes archived products from the low-stock count', async () => {
    const { agent } = await createOwner(app);
    const p = await makeProduct('Old');
    await agent
      .patch(`/v1/admin/inventory/${p.variants[0]?.id}`)
      .send({ lowStockThreshold: 2 })
      .expect(200);
    expect((await agent.get('/v1/admin/inventory/low-stock-count')).body.count).toBe(1);
    await prisma.product.update({ where: { id: p.id }, data: { status: 'archived' } });
    expect((await agent.get('/v1/admin/inventory/low-stock-count')).body.count).toBe(0);
  });

  it('enforces view and adjust permissions', async () => {
    const [v] = (await makeProduct('Shirt')).variants;
    const id = v?.id as string;
    const viewer = await createStaffWith(app, ['inventory.view']);
    await viewer.agent.get('/v1/admin/inventory').expect(200);
    await viewer.agent.get('/v1/admin/inventory/low-stock-count').expect(200);
    await viewer.agent.get(`/v1/admin/inventory/${id}/movements`).expect(200);
    await viewer.agent
      .post(`/v1/admin/inventory/${id}/adjust`)
      .send({ mode: 'delta', qty: 1, note: 'x' })
      .expect(403);
    await viewer.agent
      .patch(`/v1/admin/inventory/${id}`)
      .send({ lowStockThreshold: 1 })
      .expect(403);

    const adjuster = await createStaffWith(app, ['inventory.adjust']);
    await adjuster.agent
      .post(`/v1/admin/inventory/${id}/adjust`)
      .send({ mode: 'delta', qty: 1, note: 'x' })
      .expect(200);
    await adjuster.agent.get('/v1/admin/inventory').expect(403);
  });
});
