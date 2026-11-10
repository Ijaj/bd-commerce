import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedPages } from '../src/cli/seed-pages';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, createStaffWith, resetDb } from './helpers';

const SEEDED = ['about', 'contact', 'privacy', 'terms', 'returns', 'faq'];

describe('static pages', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  // resetDb does not touch pages: put them back to the migration's draft state.
  beforeEach(async () => {
    await resetDb(app);
    await prisma.page.deleteMany({ where: { slug: { notIn: SEEDED } } });
    await prisma.page.updateMany({
      data: { isPublished: false, bodyHtmlEn: null, bodyHtmlBn: null, titleBn: null },
    });
  });
  afterAll(() => app.close());

  const pub = () => request(app.getHttpServer());

  it('has the six seeded drafts, unpublished, footer-flagged', async () => {
    const { agent } = await createOwner(app);
    const res = await agent.get('/v1/admin/pages').expect(200);
    const slugs = res.body.items.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(SEEDED));
    for (const p of res.body.items) {
      expect(p).toMatchObject({ isPublished: false, showInFooter: true });
    }
  });

  it('creates, reads, patches and deletes a page', async () => {
    const { agent } = await createOwner(app);
    const created = await agent
      .post('/v1/admin/pages')
      .send({ slug: 'shipping-info', titleEn: 'Shipping', bodyHtmlEn: '<p>Hi</p>', sortOrder: 7 })
      .expect(201);
    expect(created.body).toMatchObject({
      slug: 'shipping-info',
      titleEn: 'Shipping',
      titleBn: null,
      bodyHtmlEn: '<p>Hi</p>',
      bodyHtmlBn: null,
      isPublished: false,
      showInFooter: false,
      sortOrder: 7,
    });
    const id = created.body.id;

    const patched = await agent
      .patch(`/v1/admin/pages/${id}`)
      .send({ titleBn: 'শিপিং', isPublished: true, seoTitle: 'Ship' })
      .expect(200);
    expect(patched.body).toMatchObject({
      titleBn: 'শিপিং',
      isPublished: true,
      seoTitle: 'Ship',
      titleEn: 'Shipping',
    });
    const got = await agent.get(`/v1/admin/pages/${id}`).expect(200);
    expect(got.body.seoTitle).toBe('Ship');

    await agent.delete(`/v1/admin/pages/${id}`).expect(204);
    const gone = await agent.get(`/v1/admin/pages/${id}`).expect(404);
    expect(gone.body.code).toBe('PAGE_NOT_FOUND');
    await agent.delete(`/v1/admin/pages/${id}`).expect(404);
  });

  it('orders the admin list by sortOrder then title', async () => {
    const { agent } = await createOwner(app);
    await agent
      .post('/v1/admin/pages')
      .send({ slug: 'zz', titleEn: 'ZZ', sortOrder: 0 })
      .expect(201);
    await agent
      .post('/v1/admin/pages')
      .send({ slug: 'aa', titleEn: 'AA', sortOrder: 0 })
      .expect(201);
    const res = await agent.get('/v1/admin/pages').expect(200);
    const titles = res.body.items.map((p: { titleEn: string }) => p.titleEn);
    expect(titles.indexOf('AA')).toBeLessThan(titles.indexOf('ZZ'));
    expect(res.body.items[res.body.items.length - 1].sortOrder).toBeGreaterThanOrEqual(0);
  });

  it('validates slugs, uniqueness and reserved words', async () => {
    const { agent } = await createOwner(app);
    for (const slug of ['Bad Slug', 'UPPER', 'a--b', '-lead', 'trail-', '']) {
      await agent.post('/v1/admin/pages').send({ slug, titleEn: 'X' }).expect(400);
    }
    await agent
      .post('/v1/admin/pages')
      .send({ slug: 'a'.repeat(61), titleEn: 'X' })
      .expect(400);
    for (const slug of ['new', 'edit']) {
      const res = await agent.post('/v1/admin/pages').send({ slug, titleEn: 'X' }).expect(422);
      expect(res.body.code).toBe('PAGE_SLUG_RESERVED');
    }
    await agent.post('/v1/admin/pages').send({ slug: 'one', titleEn: 'One' }).expect(201);
    const dup = await agent
      .post('/v1/admin/pages')
      .send({ slug: 'one', titleEn: 'Two' })
      .expect(409);
    expect(dup.body.code).toBe('PAGE_SLUG_TAKEN');
    const two = await agent
      .post('/v1/admin/pages')
      .send({ slug: 'two', titleEn: 'Two' })
      .expect(201);
    const clash = await agent
      .patch(`/v1/admin/pages/${two.body.id}`)
      .send({ slug: 'one' })
      .expect(409);
    expect(clash.body.code).toBe('PAGE_SLUG_TAKEN');
    const reserved = await agent
      .patch(`/v1/admin/pages/${two.body.id}`)
      .send({ slug: 'new' })
      .expect(422);
    expect(reserved.body.code).toBe('PAGE_SLUG_RESERVED');
    await agent
      .patch('/v1/admin/pages/00000000-0000-4000-8000-000000000000')
      .send({ titleEn: 'x' })
      .expect(404);
  });

  it('sanitizes bodies on create and update, and rejects oversized ones', async () => {
    const { agent } = await createOwner(app);
    const evil = '<p onclick="x()">ok</p><script>alert(1)</script><img src=x onerror=alert(1)>';
    const created = await agent
      .post('/v1/admin/pages')
      .send({ slug: 'evil', titleEn: 'Evil', bodyHtmlEn: evil, bodyHtmlBn: evil })
      .expect(201);
    for (const k of ['bodyHtmlEn', 'bodyHtmlBn']) {
      expect(created.body[k]).toContain('ok');
      expect(created.body[k]).not.toMatch(/script|onclick|onerror|alert/);
    }
    const patched = await agent
      .patch(`/v1/admin/pages/${created.body.id}`)
      .send({ bodyHtmlEn: '<p>fine</p><iframe src="https://evil.test"></iframe>' })
      .expect(200);
    expect(patched.body.bodyHtmlEn).toBe('<p>fine</p>');
    // empty after sanitising -> null
    const cleared = await agent
      .patch(`/v1/admin/pages/${created.body.id}`)
      .send({ bodyHtmlEn: '<script>x</script>' })
      .expect(200);
    expect(cleared.body.bodyHtmlEn).toBeNull();
    // the global JSON body limit (100 KB) trips before the 200 KB schema cap
    await agent
      .patch(`/v1/admin/pages/${created.body.id}`)
      .send({ bodyHtmlEn: `<p>${'a'.repeat(200 * 1024)}</p>` })
      .expect(413);
  });

  it('public list shows only published footer pages, public get only published', async () => {
    const { agent } = await createOwner(app);
    const mk = (b: object) => agent.post('/v1/admin/pages').send(b).expect(201);
    await mk({
      slug: 'live',
      titleEn: 'Live',
      titleBn: 'লাইভ',
      isPublished: true,
      showInFooter: true,
      sortOrder: 1,
    });
    await mk({
      slug: 'hidden-footer',
      titleEn: 'NoFooter',
      isPublished: true,
      showInFooter: false,
    });
    await mk({ slug: 'draft', titleEn: 'Draft', isPublished: false, showInFooter: true });
    await mk({
      slug: 'first',
      titleEn: 'First',
      isPublished: true,
      showInFooter: true,
      sortOrder: 0,
      bodyHtmlEn: '<p>Body</p>',
      seoDescription: 'desc',
    });

    const list = await pub().get('/v1/public/pages').expect(200);
    expect(list.headers['cache-control']).toContain('max-age');
    expect(list.body.items).toEqual([
      { slug: 'first', titleEn: 'First', titleBn: null },
      { slug: 'live', titleEn: 'Live', titleBn: 'লাইভ' },
    ]);

    const one = await pub().get('/v1/public/pages/first').expect(200);
    expect(one.body).toMatchObject({
      slug: 'first',
      bodyHtmlEn: '<p>Body</p>',
      bodyHtmlBn: null,
      seoDescription: 'desc',
    });
    // published but not in the footer is still reachable by slug
    await pub().get('/v1/public/pages/hidden-footer').expect(200);
    const draft = await pub().get('/v1/public/pages/draft').expect(404);
    expect(draft.body.code).toBe('PAGE_NOT_FOUND');
    await pub().get('/v1/public/pages/unknown').expect(404);
  });

  it('needs content.manage for every admin route', async () => {
    const { agent } = await createOwner(app);
    const page = await agent.post('/v1/admin/pages').send({ slug: 'x1', titleEn: 'X' }).expect(201);
    const viewer = await createStaffWith(app, ['products.view']);
    await viewer.agent.get('/v1/admin/pages').expect(403);
    await viewer.agent.get(`/v1/admin/pages/${page.body.id}`).expect(403);
    await viewer.agent.post('/v1/admin/pages').send({ slug: 'x2', titleEn: 'X' }).expect(403);
    await viewer.agent.patch(`/v1/admin/pages/${page.body.id}`).send({ titleEn: 'Y' }).expect(403);
    await viewer.agent.delete(`/v1/admin/pages/${page.body.id}`).expect(403);
    await request(app.getHttpServer()).get('/v1/admin/pages').expect(401);
    const editor = await createStaffWith(app, ['content.manage']);
    await editor.agent.get('/v1/admin/pages').expect(200);
  });

  it('seed-pages fills empty drafts once and keeps edited text', async () => {
    await prisma.page.update({ where: { slug: 'faq' }, data: { bodyHtmlEn: '<p>mine</p>' } });
    const first = await seedPages(prisma, true);
    expect(first).toEqual(expect.arrayContaining(SEEDED));
    const faq = await prisma.page.findUniqueOrThrow({ where: { slug: 'faq' } });
    expect(faq.bodyHtmlEn).toBe('<p>mine</p>');
    expect(faq.bodyHtmlBn).toBeTruthy();
    expect(faq.isPublished).toBe(true);
    expect(await seedPages(prisma, true)).toEqual([]);
    // without --publish the pages stay drafts
    await prisma.page.updateMany({
      data: { isPublished: false, bodyHtmlEn: null, bodyHtmlBn: null },
    });
    await seedPages(prisma, false);
    expect((await prisma.page.findUniqueOrThrow({ where: { slug: 'about' } })).isPublished).toBe(
      false,
    );
  });
});
