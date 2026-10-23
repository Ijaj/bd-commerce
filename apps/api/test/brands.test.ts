import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, createStaffWith, resetDb } from './helpers';

describe('brands', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  async function category() {
    const id = randomUUID();
    return prisma.category.create({
      data: { id, level: 1, path: `/${id}/`, nameEn: 'Cat', slug: `cat-${id}` },
    });
  }

  it('creates with an auto slug, keeps slugs unique, lists with product counts', async () => {
    const { agent } = await createOwner(app);
    const a = await agent.post('/v1/admin/brands').send({ nameEn: 'Acme Toys' }).expect(201);
    expect(a.body).toMatchObject({
      slug: 'acme-toys',
      active: true,
      productCount: 0,
      logoUrl: null,
    });
    const b = await agent.post('/v1/admin/brands').send({ nameEn: 'Acme Toys' }).expect(201);
    expect(b.body.slug).toBe('acme-toys-2');
    await agent.post('/v1/admin/brands').send({ nameEn: 'X', slug: 'acme-toys' }).expect(409);

    const cat = await category();
    const seller = await prisma.seller.create({ data: { name: 'S' } });
    await prisma.product.create({
      data: {
        sellerId: seller.id,
        brandId: a.body.id,
        primaryCategoryId: cat.id,
        titleEn: 'P',
        slug: 'p',
      },
    });
    const list = await agent.get('/v1/admin/brands').expect(200);
    expect(list.body.find((x: { id: string }) => x.id === a.body.id).productCount).toBe(1);
  });

  it('returns a signed logo url', async () => {
    const { agent } = await createOwner(app);
    const media = await prisma.media.create({
      data: {
        storageKey: `media/2026/10/${randomUUID()}.png`,
        mime: 'image/png',
        width: 10,
        height: 10,
        bytes: 100,
      },
    });
    const res = await agent
      .post('/v1/admin/brands')
      .send({ nameEn: 'Logo', logoMediaId: media.id })
      .expect(201);
    expect(res.body.logoUrl).toContain('/rs:fill:200:200/');
    await agent
      .post('/v1/admin/brands')
      .send({ nameEn: 'Bad', logoMediaId: randomUUID() })
      .expect(400);
  });

  it('patches name, slug and active', async () => {
    const { agent } = await createOwner(app);
    const a = await agent.post('/v1/admin/brands').send({ nameEn: 'Old' }).expect(201);
    const res = await agent
      .patch(`/v1/admin/brands/${a.body.id}`)
      .send({ nameEn: 'New', nameBn: 'নতুন', slug: 'new-brand', active: false })
      .expect(200);
    expect(res.body).toMatchObject({
      nameEn: 'New',
      nameBn: 'নতুন',
      slug: 'new-brand',
      active: false,
    });
    await agent.patch(`/v1/admin/brands/${randomUUID()}`).send({ nameEn: 'x' }).expect(404);
  });

  it('refuses to delete a brand in use unless forced, then detaches products', async () => {
    const { agent } = await createOwner(app);
    const a = await agent.post('/v1/admin/brands').send({ nameEn: 'Used' }).expect(201);
    const cat = await category();
    const seller = await prisma.seller.create({ data: { name: 'S' } });
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        brandId: a.body.id,
        primaryCategoryId: cat.id,
        titleEn: 'P',
        slug: 'p',
      },
    });
    await agent.delete(`/v1/admin/brands/${a.body.id}`).expect(409);
    await agent.delete(`/v1/admin/brands/${a.body.id}?force=true`).expect(204);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).brandId,
    ).toBeNull();
    await agent.delete(`/v1/admin/brands/${a.body.id}`).expect(404);

    const empty = await agent.post('/v1/admin/brands').send({ nameEn: 'Empty' }).expect(201);
    await agent.delete(`/v1/admin/brands/${empty.body.id}`).expect(204);
  });

  it('enforces permissions', async () => {
    const viewer = await createStaffWith(app, ['products.view']);
    await viewer.agent.get('/v1/admin/brands').expect(200);
    await viewer.agent.post('/v1/admin/brands').send({ nameEn: 'x' }).expect(403);
    const none = await createStaffWith(app, ['settings.view']);
    await none.agent.get('/v1/admin/brands').expect(403);
  });
});
