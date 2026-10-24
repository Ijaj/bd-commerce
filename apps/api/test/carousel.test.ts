import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, createStaffWith, resetDb } from './helpers';

const HOUR = 3_600_000;

describe('home carousel', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  async function media() {
    return prisma.media.create({
      data: {
        storageKey: `media/2026/10/${randomUUID()}.jpg`,
        mime: 'image/jpeg',
        width: 1600,
        height: 600,
        bytes: 1000,
      },
    });
  }

  const pub = () => request(app.getHttpServer()).get('/v1/public/home');

  it('creates, lists, updates and deletes slides', async () => {
    const { agent } = await createOwner(app);
    const [desktop, mobile] = [await media(), await media()];
    const created = await agent
      .post('/v1/admin/carousel')
      .send({
        title: 'Eid sale',
        imageDesktopMediaId: desktop.id,
        imageMobileMediaId: mobile.id,
        linkUrl: '/c/fashion',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      title: 'Eid sale',
      linkUrl: '/c/fashion',
      isActive: true,
      lang: 'all',
      sort: 0,
      startsAt: null,
      endsAt: null,
      imageDesktop: { id: desktop.id },
      imageMobile: { id: mobile.id },
    });
    expect(created.body.imageDesktop.url).toContain('/rs:fit:1200:0/');
    expect(created.body.imageDesktop.thumbUrl).toContain('/rs:fill:240:100/');

    const second = await agent
      .post('/v1/admin/carousel')
      .send({ title: 'Second', imageDesktopMediaId: desktop.id })
      .expect(201);
    expect(second.body).toMatchObject({ sort: 1, imageMobile: null, linkUrl: null });

    const patched = await agent
      .patch(`/v1/admin/carousel/${created.body.id}`)
      .send({ title: 'Eid sale 2', imageMobileMediaId: null, lang: 'bn', isActive: false })
      .expect(200);
    expect(patched.body).toMatchObject({
      title: 'Eid sale 2',
      imageMobile: null,
      lang: 'bn',
      isActive: false,
    });

    const list = await agent.get('/v1/admin/carousel').expect(200);
    expect(list.body.map((s: { title: string }) => s.title)).toEqual(['Eid sale 2', 'Second']);

    await agent.delete(`/v1/admin/carousel/${second.body.id}`).expect(204);
    await agent.delete(`/v1/admin/carousel/${second.body.id}`).expect(404);
    expect((await agent.get('/v1/admin/carousel').expect(200)).body).toHaveLength(1);
    await agent.patch(`/v1/admin/carousel/${randomUUID()}`).send({ title: 'x' }).expect(404);
  });

  it('validates input', async () => {
    const { agent } = await createOwner(app);
    const m = await media();
    const post = (body: object) => agent.post('/v1/admin/carousel').send(body);
    await post({ title: '', imageDesktopMediaId: m.id }).expect(400);
    await post({ title: 'x' }).expect(400);
    await post({ title: 'x', imageDesktopMediaId: randomUUID() }).expect(400);
    await post({ title: 'x', imageDesktopMediaId: m.id, imageMobileMediaId: randomUUID() }).expect(
      400,
    );
    await post({ title: 'x', imageDesktopMediaId: m.id, linkUrl: 'javascript:alert(1)' }).expect(
      400,
    );
    await post({ title: 'x', imageDesktopMediaId: m.id, linkUrl: '//evil.example' }).expect(400);
    await post({ title: 'x', imageDesktopMediaId: m.id, linkUrl: 'https://example.com/a' }).expect(
      201,
    );
    const t = new Date().toISOString();
    await post({ title: 'x', imageDesktopMediaId: m.id, startsAt: t, endsAt: t }).expect(400);
    const ok = await post({ title: 'x', imageDesktopMediaId: m.id, startsAt: t }).expect(201);
    await agent
      .patch(`/v1/admin/carousel/${ok.body.id}`)
      .send({ endsAt: new Date(Date.now() - HOUR).toISOString() })
      .expect(400);
  });

  it('reorders slides', async () => {
    const { agent } = await createOwner(app);
    const m = await media();
    const ids: string[] = [];
    for (const title of ['a', 'b', 'c']) {
      ids.push(
        (
          await agent
            .post('/v1/admin/carousel')
            .send({ title, imageDesktopMediaId: m.id })
            .expect(201)
        ).body.id,
      );
    }
    const [a, b, c] = ids as [string, string, string];
    await agent
      .put('/v1/admin/carousel/order')
      .send({ ids: [c, a, b] })
      .expect(204);
    const titles = async () =>
      (await agent.get('/v1/admin/carousel').expect(200)).body.map(
        (s: { title: string }) => s.title,
      );
    expect(await titles()).toEqual(['c', 'a', 'b']);
    await agent
      .put('/v1/admin/carousel/order')
      .send({ ids: [b] })
      .expect(204);
    expect(await titles()).toEqual(['b', 'c', 'a']);
    await agent
      .put('/v1/admin/carousel/order')
      .send({ ids: [a, a] })
      .expect(400);
    await agent
      .put('/v1/admin/carousel/order')
      .send({ ids: [randomUUID()] })
      .expect(400);
  });

  it('needs content.manage', async () => {
    const m = await media();
    const viewer = await createStaffWith(app, ['products.view']);
    await viewer.agent.get('/v1/admin/carousel').expect(403);
    await viewer.agent
      .post('/v1/admin/carousel')
      .send({ title: 'x', imageDesktopMediaId: m.id })
      .expect(403);
    await viewer.agent.put('/v1/admin/carousel/order').send({ ids: [] }).expect(403);
    await request(app.getHttpServer()).get('/v1/admin/carousel').expect(401);
    const editor = await createStaffWith(app, ['content.manage']);
    await editor.agent.get('/v1/admin/carousel').expect(200);
  });

  it('shows only active slides inside their window and language on /public/home', async () => {
    const { agent } = await createOwner(app);
    const m = await media();
    const mobile = await media();
    const now = Date.now();
    const add = async (title: string, extra: object = {}) =>
      (
        await agent
          .post('/v1/admin/carousel')
          .send({ title, imageDesktopMediaId: m.id, ...extra })
          .expect(201)
      ).body.id as string;
    await add('always', { imageMobileMediaId: mobile.id, linkUrl: '/p/x' });
    await add('inactive', { isActive: false });
    await add('expired', { endsAt: new Date(now - HOUR).toISOString() });
    await add('future', { startsAt: new Date(now + HOUR).toISOString() });
    await add('live', {
      startsAt: new Date(now - HOUR).toISOString(),
      endsAt: new Date(now + HOUR).toISOString(),
    });
    await add('only-en', { lang: 'en' });
    await add('only-bn', { lang: 'bn' });

    const all = await pub().expect(200);
    expect(all.headers['cache-control']).toContain('max-age=60');
    expect(all.body.slides.map((s: { title: string }) => s.title)).toEqual([
      'always',
      'live',
      'only-en',
      'only-bn',
    ]);
    expect(all.body.slides[0]).toMatchObject({ linkUrl: '/p/x', title: 'always' });
    expect(all.body.slides[0].desktop.url320).toContain('/rs:fit:320:0/');
    expect(all.body.slides[0].mobile.url1200).toContain('/rs:fit:1200:0/');
    expect(all.body.slides[1].mobile).toBeNull();

    const en = await pub().query({ lang: 'en' }).expect(200);
    expect(en.body.slides.map((s: { title: string }) => s.title)).toEqual([
      'always',
      'live',
      'only-en',
    ]);
    const bn = await pub().query({ lang: 'bn' }).expect(200);
    expect(bn.body.slides.map((s: { title: string }) => s.title)).toEqual([
      'always',
      'live',
      'only-bn',
    ]);
    await pub().query({ lang: 'fr' }).expect(400);
  });

  it('lists featured categories (showOnHome, active only, no children)', async () => {
    const seller = await prisma.seller.create({ data: { name: 'S' } });
    expect(seller.id).toBeTruthy();
    const mk = async (slug: string, extra: object) => {
      const id = randomUUID();
      await prisma.category.create({
        data: { id, level: 1, path: `/${id}/`, nameEn: slug, slug, ...extra },
      });
      return id;
    };
    const parent = await mk('featured', { showOnHome: true, sort: 1, chipColor: '#112233' });
    await mk('plain', { sort: 2 });
    await mk('hidden-featured', { showOnHome: true, isActive: false, sort: 3 });
    const child = randomUUID();
    await prisma.category.create({
      data: {
        id: child,
        parentId: parent,
        level: 2,
        path: `/${parent}/${child}/`,
        nameEn: 'kid',
        slug: 'kid',
        showOnHome: true,
      },
    });
    const res = await pub().expect(200);
    expect(res.body.featuredCategories.map((c: { slug: string }) => c.slug)).toEqual([
      'featured',
      'kid',
    ]);
    expect(res.body.featuredCategories[0]).toMatchObject({
      chipColor: '#112233',
      children: [],
      image: null,
    });
  });
});
