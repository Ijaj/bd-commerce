import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryObjectStorage, ObjectStorage } from '../src/media/object-storage';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, createStaffWith, resetDb } from './helpers';

async function png(width = 40, height = 20) {
  return sharp({ create: { width, height, channels: 3, background: '#4f46e5' } })
    .png()
    .toBuffer();
}

/** JPEG with EXIF orientation 6 (rotate 90 degrees) and a copyright tag. */
async function jpegWithExif() {
  return sharp({ create: { width: 40, height: 20, channels: 3, background: '#e11d48' } })

    .withExif({ IFD0: { Copyright: 'secret-owner' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}

describe('media', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: MemoryObjectStorage;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    storage = app.get<MemoryObjectStorage>(ObjectStorage);
  });
  beforeEach(async () => {
    await resetDb(app);
    storage.objects.clear();
  });
  afterAll(() => app.close());

  it('uploads a png and returns sizes and imgproxy urls', async () => {
    const { agent } = await createOwner(app);
    const res = await agent
      .post('/v1/admin/media')
      .field('alt', ' A blue box ')
      .attach('file', await png(), { filename: 'x.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body).toMatchObject({
      mime: 'image/png',
      width: 40,
      height: 20,
      alt: 'A blue box',
    });
    expect(res.body.url).toContain('/rs:fit:600:600/');
    expect(res.body.thumbUrl).toContain('/rs:fill:160:160/');

    const row = await prisma.media.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.storageKey).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(row.uploadedById).not.toBeNull();
    expect(await storage.head(row.storageKey)).toMatchObject({ contentType: 'image/png' });
    await agent.get(`/v1/admin/media/${res.body.id}`).expect(200);
  });

  it('detects the type by content, rotates by EXIF and strips metadata', async () => {
    const { agent } = await createOwner(app);
    const res = await agent
      .post('/v1/admin/media')
      // wrong client mime and extension on purpose
      .attach('file', await jpegWithExif(), { filename: 'x.txt', contentType: 'text/plain' })
      .expect(201);
    expect(res.body).toMatchObject({ mime: 'image/jpeg', width: 20, height: 40 });

    const row = await prisma.media.findUniqueOrThrow({ where: { id: res.body.id } });
    const stored = storage.objects.get(row.storageKey)?.body;
    expect(stored).toBeDefined();
    const meta = await sharp(stored).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(stored?.toString('latin1')).not.toContain('secret-owner');
  });

  it('rejects non-images, missing files and unsupported formats', async () => {
    const { agent } = await createOwner(app);
    await agent
      .post('/v1/admin/media')
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
        filename: 'x.svg',
        contentType: 'image/png',
      })
      .expect(400);
    await agent
      .post('/v1/admin/media')
      .attach('file', Buffer.from('hello'), { filename: 'a.png', contentType: 'image/png' })
      .expect(400);
    await agent.post('/v1/admin/media').field('alt', 'no file').expect(400);
    const tiff = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .tiff()
      .toBuffer();
    await agent
      .post('/v1/admin/media')
      .attach('file', tiff, { filename: 'a.tif', contentType: 'image/tiff' })
      .expect(400);
    expect(await prisma.media.count()).toBe(0);
  });

  it('rejects files over 10 MB', async () => {
    const { agent } = await createOwner(app);
    const res = await agent
      .post('/v1/admin/media')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1024), {
        filename: 'big.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(413);
    expect(await prisma.media.count()).toBe(0);
  });

  it('allows products.edit or categories.edit, nothing else', async () => {
    const buf = await png();
    const products = await createStaffWith(app, ['products.edit']);
    await products.agent.post('/v1/admin/media').attach('file', buf, 'a.png').expect(201);
    const categories = await createStaffWith(app, ['categories.edit']);
    await categories.agent.post('/v1/admin/media').attach('file', buf, 'a.png').expect(201);
    const viewer = await createStaffWith(app, ['products.view', 'categories.view']);
    await viewer.agent.post('/v1/admin/media').attach('file', buf, 'a.png').expect(403);
  });

  it('updates alt text and deletes unused media with its object', async () => {
    const { agent } = await createOwner(app);
    const up = await agent
      .post('/v1/admin/media')
      .attach('file', await png(), 'a.png')
      .expect(201);
    const patched = await agent
      .patch(`/v1/admin/media/${up.body.id}`)
      .send({ alt: 'New alt' })
      .expect(200);
    expect(patched.body.alt).toBe('New alt');
    const cleared = await agent
      .patch(`/v1/admin/media/${up.body.id}`)
      .send({ alt: '' })
      .expect(200);
    expect(cleared.body.alt).toBeNull();

    const row = await prisma.media.findUniqueOrThrow({ where: { id: up.body.id } });
    await agent.delete(`/v1/admin/media/${up.body.id}`).expect(204);
    expect(await storage.head(row.storageKey)).toBeNull();
    await agent.get(`/v1/admin/media/${up.body.id}`).expect(404);
    await agent.delete(`/v1/admin/media/${up.body.id}`).expect(404);
  });

  it('refuses to delete media used by a product image, brand or category', async () => {
    const { agent } = await createOwner(app);
    const upload = async () =>
      (
        await agent
          .post('/v1/admin/media')
          .attach('file', await png(), 'a.png')
          .expect(201)
      ).body.id as string;

    const seller = await prisma.seller.findFirstOrThrow();
    const categoryId = randomUUID();
    const imageId = await upload();
    await prisma.category.create({
      data: {
        id: categoryId,
        level: 1,
        path: `/${categoryId}/`,
        nameEn: 'Cat',
        slug: 'cat',
        imageMediaId: imageId,
      },
    });
    await agent.delete(`/v1/admin/media/${imageId}`).expect(409);

    const logoId = await upload();
    await prisma.brand.create({ data: { nameEn: 'B', slug: 'b', logoMediaId: logoId } });
    await agent.delete(`/v1/admin/media/${logoId}`).expect(409);

    const photoId = await upload();
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        primaryCategoryId: categoryId,
        titleEn: 'P',
        slug: 'p',
        variants: { create: { sku: 'P-1', priceP: 1000 } },
      },
    });
    await prisma.productImage.create({ data: { productId: product.id, mediaId: photoId } });
    await agent.delete(`/v1/admin/media/${photoId}`).expect(409);
    expect(await prisma.media.count()).toBe(3);

    await prisma.productImage.deleteMany();
    await agent.delete(`/v1/admin/media/${photoId}`).expect(204);
  });
});
