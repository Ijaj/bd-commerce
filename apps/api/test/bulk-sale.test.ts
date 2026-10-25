import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { type Agent, createApp, createStaffWith, resetDb } from './helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const HOUR = 3_600_000;

describe('bulk sale tool', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let nobody: Agent;
  let sellerId: string;
  let n = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(app);
    admin = (await createStaffWith(app, ['bulk_sales.manage'])).agent;
    nobody = (await createStaffWith(app, ['flash_sales.manage'])).agent;
    sellerId =
      (await prisma.seller.findFirst())?.id ??
      (await prisma.seller.create({ data: { name: 'S' } })).id;
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await prisma.saleBatch.deleteMany();
    await prisma.$executeRawUnsafe(
      'TRUNCATE product_categories, products, categories, brands CASCADE',
    );
  });

  async function category(parent?: { id: string; path: string }) {
    const id = randomUUID();
    const path = `${parent?.path ?? '/'}${id}/`;
    await prisma.category.create({
      data: {
        id,
        parentId: parent?.id ?? null,
        level: path.split('/').filter(Boolean).length,
        path,
        nameEn: `Cat ${++n}`,
        slug: `cat-${n}`,
      },
    });
    return { id, path };
  }

  async function product(
    cat: { id: string },
    prices: number[],
    o: { brandId?: string; sale?: number; extraCat?: { id: string } } = {},
  ) {
    n += 1;
    return prisma.product.create({
      data: {
        sellerId,
        primaryCategoryId: cat.id,
        brandId: o.brandId,
        titleEn: `Prod ${n}`,
        slug: `prod-${n}`,
        status: 'active',
        publishedAt: new Date(Date.now() - HOUR),
        categories: o.extraCat ? { create: [{ categoryId: o.extraCat.id }] } : undefined,
        variants: {
          create: prices.map((priceP, i) => ({
            sku: `sku-${n}-${i}`,
            priceP,
            salePriceP: o.sale,
            sort: i,
            inventory: { create: { onHand: 5 } },
          })),
        },
      },
      include: { variants: { orderBy: { sort: 'asc' } } },
    });
  }

  const preview = (body: Record<string, unknown>) =>
    admin.post('/v1/admin/bulk-sales/preview').send(body);
  const apply = (body: Record<string, unknown>) =>
    admin.post('/v1/admin/bulk-sales').send({ name: 'Eid sale', ...body });
  const variant = (id: string) => prisma.variant.findUniqueOrThrow({ where: { id } });

  it('requires bulk_sales.manage and a scope', async () => {
    await nobody.get('/v1/admin/bulk-sales').expect(403);
    await request(app.getHttpServer()).get('/v1/admin/bulk-sales').expect(401);
    await preview({ mode: 'percent', value: 1000, scope: {} }).expect(400);
    await preview({ mode: 'percent', value: 10_000, scope: { productIds: [randomUUID()] } }).expect(
      400,
    );
    await preview({
      mode: 'percent',
      value: 1000,
      scope: { productIds: [randomUUID()] },
      startsAt: new Date(Date.now() + HOUR).toISOString(),
      endsAt: new Date().toISOString(),
    }).expect(400);
  });

  it('previews percent and fixed prices, with skipped variants and a sample', async () => {
    const cat = await category();
    const p = await product(cat, [10_000, 150, 12_345]);
    const pct = await preview({
      mode: 'percent',
      value: 1500,
      scope: { productIds: [p.id] },
    }).expect(200);
    // 10000 -> 8500, 150 -> 128 (floor of 22.5 = 22), 12345 -> 12345 - 1851 = 10494
    expect(pct.body).toMatchObject({ count: 3, skipped: 0, tooMany: false, limit: 5000 });
    expect(pct.body.sample.map((s: { newSalePriceP: number }) => s.newSalePriceP)).toEqual([
      8500, 128, 10_494,
    ]);
    expect(pct.body.sample[0]).toMatchObject({
      variantId: p.variants[0]?.id,
      sku: p.variants[0]?.sku,
      title: p.titleEn,
      priceP: 10_000,
      currentSalePriceP: null,
    });
    // fixed 100.00 off: the 150-paisa variant would drop below 1 taka -> skipped
    const fixed = await preview({
      mode: 'fixed',
      value: 100,
      scope: { productIds: [p.id] },
    }).expect(200);
    expect(fixed.body).toMatchObject({ count: 2, skipped: 1, skippedPrice: 1 });
    // nothing is written by a preview
    expect((await variant(p.variants[0]?.id ?? '')).salePriceP).toBeNull();
    // a discount that makes no change in price (fixed 0 not allowed; tiny percent floors to 0)
    const tiny = await preview({ mode: 'percent', value: 1, scope: { productIds: [p.id] } }).expect(
      200,
    );
    expect(tiny.body.count).toBe(2); // 150 * 1/10000 floors to 0 -> not below price -> skipped
    expect(tiny.body.skippedPrice).toBe(1);
  });

  it('resolves scope by product, brand and category including descendants and extra categories', async () => {
    const root = await category();
    const child = await category(root);
    const other = await category();
    const brand = await prisma.brand.create({ data: { slug: 'acme', nameEn: 'Acme' } });
    const inRoot = await product(root, [1000]);
    const inChild = await product(child, [1000]);
    const extra = await product(other, [1000], { extraCat: child });
    const branded = await product(other, [1000], { brandId: brand.id });
    const lone = await product(other, [1000]);
    const count = async (scope: Record<string, unknown>) =>
      (await preview({ mode: 'percent', value: 1000, scope }).expect(200)).body.count;
    expect(await count({ categoryIds: [root.id] })).toBe(3); // root, child, extra (via extra category)
    expect(await count({ categoryIds: [child.id] })).toBe(2);
    expect(await count({ brandIds: [brand.id] })).toBe(1);
    expect(await count({ productIds: [lone.id] })).toBe(1);
    expect(
      await count({ productIds: [lone.id], brandIds: [brand.id], categoryIds: [child.id] }),
    ).toBe(4);
    expect(inRoot.id && inChild.id && extra.id && branded.id).toBeTruthy();
  });

  it('applies sale prices with the window, logs previous values, and skips existing sales on request', async () => {
    const cat = await category();
    const plain = await product(cat, [10_000]);
    const onSale = await product(cat, [20_000], { sale: 15_000 });
    const startsAt = new Date(Date.now() - HOUR).toISOString();
    const endsAt = new Date(Date.now() + 24 * HOUR).toISOString();

    const skipped = await apply({
      mode: 'percent',
      value: 2000,
      scope: { categoryIds: [cat.id] },
      skipExistingSales: true,
      startsAt,
      endsAt,
    }).expect(201);
    expect(skipped.body).toMatchObject({
      name: 'Eid sale',
      itemCount: 1,
      mode: 'percent',
      value: 2000,
    });
    const a = await variant(plain.variants[0]?.id ?? '');
    expect(a).toMatchObject({ salePriceP: 8000 });
    expect(a.saleStartsAt?.toISOString()).toBe(startsAt);
    expect(a.saleEndsAt?.toISOString()).toBe(endsAt);
    expect((await variant(onSale.variants[0]?.id ?? '')).salePriceP).toBe(15_000);

    await prisma.saleBatch.deleteMany();
    await prisma.variant.updateMany({
      data: { salePriceP: null, saleStartsAt: null, saleEndsAt: null },
    });
    await prisma.variant.update({
      where: { id: onSale.variants[0]?.id },
      data: { salePriceP: 15_000 },
    });
    const all = await apply({
      mode: 'fixed',
      value: 1000,
      scope: { categoryIds: [cat.id] },
    }).expect(201);
    expect(all.body.itemCount).toBe(2);
    const b = all.body.items.find(
      (i: { variantId: string }) => i.variantId === onSale.variants[0]?.id,
    );
    expect(b).toMatchObject({ priceP: 20_000, prevSalePriceP: 15_000, newSalePriceP: 19_000 });
    // the storefront price follows
    const detail = await request(app.getHttpServer())
      .get(`/v1/public/products/${plain.slug}`)
      .expect(200);
    expect(detail.body.variants[0]).toMatchObject({ priceP: 9000, compareAtP: 10_000 });
  });

  it('refuses more than 5000 variants with 422', async () => {
    const cat = await category();
    const p = await product(cat, [1000]);
    const rows = Array.from({ length: 5001 }, (_, i) => ({
      productId: p.id,
      sku: `bulk-${i}`,
      priceP: 1000,
      sort: i + 1,
    }));
    await prisma.variant.createMany({ data: rows });
    const pv = await preview({
      mode: 'percent',
      value: 1000,
      scope: { productIds: [p.id] },
    }).expect(200);
    expect(pv.body).toMatchObject({ count: 5002, tooMany: true });
    const res = await apply({ mode: 'percent', value: 1000, scope: { productIds: [p.id] } }).expect(
      422,
    );
    expect(res.body.code).toBe('BULK_SALE_TOO_MANY');
    expect(await prisma.saleBatch.count()).toBe(0);
    expect(await prisma.variant.count({ where: { salePriceP: { not: null } } })).toBe(0);
  });

  it('lists batches and pages the items', async () => {
    const cat = await category();
    await product(cat, [1000, 2000, 3000]);
    const created = await apply({
      mode: 'percent',
      value: 1000,
      scope: { categoryIds: [cat.id] },
    }).expect(201);
    await apply({
      name: 'Second',
      mode: 'fixed',
      value: 100,
      scope: { categoryIds: [cat.id] },
    }).expect(201);
    const list = await admin.get('/v1/admin/bulk-sales').expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((b: { name: string }) => b.name)).toEqual(['Second', 'Eid sale']);
    expect(list.body.items[1]).toMatchObject({
      itemCount: 3,
      undoneAt: null,
      createdByName: 'Staff Member',
    });
    const page = await admin
      .get(`/v1/admin/bulk-sales/${created.body.id}?pageSize=2&page=2`)
      .expect(200);
    expect(page.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page.body.items).toHaveLength(1);
    await admin.get(`/v1/admin/bulk-sales/${randomUUID()}`).expect(404);
  });

  it('undoes a batch, restoring previous sales but not variants edited since', async () => {
    const cat = await category();
    const keep = await product(cat, [10_000], { sale: 9000 });
    const edited = await product(cat, [10_000]);
    const untouched = await product(cat, [10_000]);
    const created = await apply({
      mode: 'percent',
      value: 2000,
      scope: { categoryIds: [cat.id] },
    }).expect(201);
    expect(created.body.itemCount).toBe(3);
    expect((await variant(keep.variants[0]?.id ?? '')).salePriceP).toBe(8000);
    // staff changes one variant's sale after the batch
    await prisma.variant.update({
      where: { id: edited.variants[0]?.id },
      data: { salePriceP: 7000 },
    });

    const undo = await admin.post(`/v1/admin/bulk-sales/${created.body.id}/undo`).expect(200);
    expect(undo.body).toEqual({ restored: 2, skippedChanged: 1 });
    expect((await variant(keep.variants[0]?.id ?? '')).salePriceP).toBe(9000);
    expect((await variant(untouched.variants[0]?.id ?? '')).salePriceP).toBeNull();
    expect((await variant(edited.variants[0]?.id ?? '')).salePriceP).toBe(7000);
    const detail = await admin.get(`/v1/admin/bulk-sales/${created.body.id}`).expect(200);
    expect(detail.body.undoneAt).not.toBeNull();
    const again = await admin.post(`/v1/admin/bulk-sales/${created.body.id}/undo`).expect(409);
    expect(again.body.code).toBe('BULK_SALE_UNDONE');
    await admin.post(`/v1/admin/bulk-sales/${randomUUID()}/undo`).expect(404);
  });
});
