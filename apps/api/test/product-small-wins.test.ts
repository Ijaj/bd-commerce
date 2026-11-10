import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { type Agent, createApp, createOwner, createStaffWith, resetDb } from './helpers';

const P = '/v1/admin/products';

describe('product tags, warranty, dimensions and scheduled publish (C7, C8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let categoryId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    owner = (await createOwner(app)).agent;
    const id = randomUUID();
    categoryId = (
      await prisma.category.create({
        data: { id, level: 1, path: `/${id}/`, nameEn: 'Toys', slug: `toys-${id}` },
      })
    ).id;
  });
  afterAll(() => app.close());

  const pub = (url: string) => request(app.getHttpServer()).get(url);

  async function create(extra: object = {}, sku = 'T-1') {
    const res = await owner
      .post(P)
      .send({
        titleEn: 'Teddy Bear',
        primaryCategoryId: categoryId,
        variants: [{ sku, priceP: 1500, isActive: true, optionValueRefs: [] }],
        ...extra,
      })
      .expect(201);
    return res.body as { id: string; slug: string; publishedAt: string | null };
  }

  it('stores tags (normalized), warranty and dimensions and shows them on the public page', async () => {
    const p = await create({
      tags: [' Cotton ', 'cotton', 'Summer'],
      warrantyEn: '1 year',
      warrantyBn: '১ বছর',
      lengthMm: 300,
      widthMm: 200,
      heightMm: 100,
    });
    const admin = await owner.get(`${P}/${p.id}`).expect(200);
    expect(admin.body).toMatchObject({
      tags: ['cotton', 'summer'],
      warrantyEn: '1 year',
      warrantyBn: '১ বছর',
      lengthMm: 300,
      widthMm: 200,
      heightMm: 100,
    });
    await owner.post(`${P}/${p.id}/publish`).expect(200);
    const detail = await pub(`/v1/public/products/${p.slug}`).expect(200);
    expect(detail.body).toMatchObject({
      tags: ['cotton', 'summer'],
      warrantyEn: '1 year',
      lengthMm: 300,
      heightMm: 100,
    });
  });

  it('patches the new fields, clears them with null and rejects bad dimensions', async () => {
    const p = await create({ tags: ['a'], warrantyEn: 'x', lengthMm: 5 });
    const res = await owner
      .patch(`${P}/${p.id}`)
      .send({ tags: [], warrantyEn: null, lengthMm: null, widthMm: 7 })
      .expect(200);
    expect(res.body).toMatchObject({ tags: [], warrantyEn: null, lengthMm: null, widthMm: 7 });
    await owner.patch(`${P}/${p.id}`).send({ lengthMm: 0 }).expect(400);
    await owner
      .patch(`${P}/${p.id}`)
      .send({ tags: ['x'.repeat(41)] })
      .expect(400);
  });

  it('storefront search finds a product by an exact tag', async () => {
    const p = await create({ tags: ['giftidea'] });
    await owner.post(`${P}/${p.id}/publish`).expect(200);
    const res = await pub('/v1/public/products?q=GiftIdea').expect(200);
    expect(res.body.items.map((i: { slug: string }) => i.slug)).toEqual([p.slug]);
  });

  it('duplicate keeps tags, warranty and dimensions', async () => {
    const p = await create({ tags: ['a'], warrantyEn: 'w', heightMm: 9 });
    const copy = await owner.post(`${P}/${p.id}/duplicate`).expect(201);
    expect(copy.body).toMatchObject({ tags: ['a'], warrantyEn: 'w', heightMm: 9 });
  });

  it('a future publishedAt keeps an active product hidden until then; no job needed', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const p = await create({ publishedAt: future });
    expect(p.publishedAt).toBe(future);
    await owner.post(`${P}/${p.id}/publish`).expect(200);
    const detail = await owner.get(`${P}/${p.id}`).expect(200);
    expect(detail.body).toMatchObject({ status: 'active', publishedAt: future });
    const list = await owner.get(`${P}?status=active`).expect(200);
    expect(list.body.items[0].publishedAt).toBe(future);
    await pub(`/v1/public/products/${p.slug}`).expect(404);
    expect((await pub('/v1/public/products').expect(200)).body.items).toHaveLength(0);

    // the time passes: visible with no state change
    await prisma.product.update({
      where: { id: p.id },
      data: { publishedAt: new Date(Date.now() - 1000) },
    });
    await pub(`/v1/public/products/${p.slug}`).expect(200);
  });

  it('clearing the time on an active scheduled product makes it visible now', async () => {
    const p = await create({ publishedAt: new Date(Date.now() + 3_600_000).toISOString() });
    await owner.post(`${P}/${p.id}/publish`).expect(200);
    const res = await owner.patch(`${P}/${p.id}`).send({ publishedAt: null }).expect(200);
    expect(new Date(res.body.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());
    await pub(`/v1/public/products/${p.slug}`).expect(200);
  });

  it('publishing a draft without a time stamps it now', async () => {
    const p = await create();
    expect(p.publishedAt).toBeNull();
    const res = await owner.post(`${P}/${p.id}/publish`).expect(200);
    expect(res.body.publishedAt).not.toBeNull();
  });

  it('needs products.edit to change the fields', async () => {
    const p = await create();
    const viewer = await createStaffWith(app, ['products.view']);
    await viewer.agent
      .patch(`${P}/${p.id}`)
      .send({ tags: ['x'] })
      .expect(403);
  });
});
