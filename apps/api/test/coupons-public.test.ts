import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { makeProduct, resetCommerce, signupCustomer } from './cart-fixtures';
import { dbCoupon, inDays, makeOrder } from './coupons-fixtures';
import { type Agent, createApp } from './helpers';

vi.setConfig({ testTimeout: 60_000 });

describe('coupons: public offers and customer wallet', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let phones = 0;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetCommerce(app);
  }, 90_000);
  afterAll(() => app.close());

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE coupons, orders, customers CASCADE');
  });

  async function customer() {
    const agent = request.agent(app.getHttpServer());
    const c = await signupCustomer(
      app,
      agent,
      `0171${String(4_000_000 + ++phones).padStart(7, '0')}`,
    );
    return { agent: agent as Agent, id: c.id };
  }
  const anon = () => request(app.getHttpServer());
  const pub = { visibility: 'public' } as const;

  describe('GET /public/coupons', () => {
    it('lists only public, active, current or soon coupons, hiding bulk codes', async () => {
      await dbCoupon(app, { ...pub, name: 'Live', code: 'LIVE10' });
      await dbCoupon(app, { ...pub, name: 'Soon', code: 'SOON10', startsAt: inDays(3) });
      await dbCoupon(app, {
        ...pub,
        name: 'Auto',
        kind: 'auto',
        code: null,
        type: 'fixed',
        value: 500,
      });
      await dbCoupon(app, { ...pub, name: 'Bulk', code: null, isBulk: true });
      await dbCoupon(app, { name: 'Hidden', code: 'HID10' });
      await dbCoupon(app, { ...pub, name: 'Draft', code: 'DRF10', status: 'draft' });
      await dbCoupon(app, { ...pub, name: 'Paused', code: 'PAU10', status: 'paused' });
      await dbCoupon(app, { ...pub, name: 'Far', code: 'FAR10', startsAt: inDays(10) });
      await dbCoupon(app, {
        ...pub,
        name: 'Expired',
        code: 'EXP10',
        startsAt: inDays(-5),
        endsAt: inDays(-1),
      });
      await dbCoupon(app, { ...pub, name: 'Maxed', code: 'MAX10', maxUsesTotal: 1, usesCount: 1 });

      const res = await anon().get('/v1/public/coupons').expect(200);
      const byName = Object.fromEntries(res.body.items.map((i: { name: string }) => [i.name, i]));
      expect(Object.keys(byName).sort()).toEqual(['Auto', 'Bulk', 'Live', 'Soon']);
      expect(byName.Live).toMatchObject({
        code: 'LIVE10',
        kind: 'code',
        type: 'percent',
        value: 1000,
        isCollectable: false,
      });
      expect(byName.Live).not.toHaveProperty('collected');
      expect(byName.Auto.code).toBeNull();
      expect(byName.Bulk.code).toBeNull();
      expect(byName.Soon.startsAt).not.toBeNull();
      expect(res.headers['cache-control']).toMatch(/public/);
    });

    it('adds the collected flag, privately, for a signed-in customer', async () => {
      const c = await customer();
      const a = await dbCoupon(app, { ...pub, name: 'A', code: 'AAA', isCollectable: true });
      await dbCoupon(app, { ...pub, name: 'B', code: 'BBB', isCollectable: true });
      await c.agent.post(`/v1/customer/coupons/${a.id}/collect`).expect(200);
      const res = await c.agent.get('/v1/public/coupons').expect(200);
      expect(res.headers['cache-control']).toMatch(/no-store/);
      const flags = Object.fromEntries(
        res.body.items.map((i: { name: string; collected: boolean }) => [i.name, i.collected]),
      );
      expect(flags).toEqual({ A: true, B: false });
    });
  });

  describe('GET /public/products/:slug/coupons', () => {
    async function category(parentId: string | null = null, parentPath = '/') {
      const id = randomUUID();
      return prisma.category.create({
        data: {
          id,
          parentId,
          level: parentId ? 2 : 1,
          path: `${parentPath}${id}/`,
          nameEn: `Cat ${id.slice(0, 4)}`,
          slug: `cat-${id}`,
        },
      });
    }
    const target = (targetType: string, targetId: string, mode = 'include') => ({
      targetType,
      targetId,
      mode,
    });
    const withTargets = (...t: ReturnType<typeof target>[]) => ({ targets: { create: t } });

    it('returns coupons whose scope covers the product', async () => {
      const root = await category();
      const child = await category(root.id, root.path);
      const other = await category();
      const brand = await prisma.brand.create({
        data: { nameEn: 'Acme', slug: `acme-${randomUUID()}` },
      });
      const p = await makeProduct(app);
      const q = await makeProduct(app);
      await prisma.product.update({
        where: { id: p.product.id },
        data: { primaryCategoryId: child.id, brandId: brand.id },
      });
      await prisma.product.update({
        where: { id: q.product.id },
        data: { primaryCategoryId: other.id },
      });

      await dbCoupon(app, { ...pub, name: 'All' });
      await dbCoupon(app, {
        ...pub,
        name: 'ByProduct',
        ...withTargets(target('product', p.product.id)),
      });
      await dbCoupon(app, {
        ...pub,
        name: 'ByAncestorCategory',
        ...withTargets(target('category', root.id)),
      });
      await dbCoupon(app, { ...pub, name: 'ByBrand', ...withTargets(target('brand', brand.id)) });
      await dbCoupon(app, {
        ...pub,
        name: 'OtherCategory',
        ...withTargets(target('category', other.id)),
      });
      await dbCoupon(app, {
        ...pub,
        name: 'Excluded',
        ...withTargets(target('category', root.id), target('product', p.product.id, 'exclude')),
      });
      await dbCoupon(app, {
        ...pub,
        name: 'ExcludesBrandOnly',
        ...withTargets(target('brand', brand.id, 'exclude')),
      });
      await dbCoupon(app, { name: 'HiddenOne' });
      await dbCoupon(app, {
        ...pub,
        name: 'BundleWithP',
        type: 'bundle',
        value: 0,
        config: {
          items: [
            { productId: p.product.id, qty: 1 },
            { productId: q.product.id, qty: 1 },
          ],
          priceP: 1000,
        },
      });
      await dbCoupon(app, {
        ...pub,
        name: 'BundleWithoutP',
        type: 'bundle',
        value: 0,
        config: {
          items: [
            { productId: q.product.id, qty: 1 },
            { productId: q.product.id, qty: 2 },
          ],
          priceP: 1000,
        },
      });

      const names = async (slug: string) =>
        (
          (await anon().get(`/v1/public/products/${slug}/coupons`).expect(200)).body.items as {
            name: string;
          }[]
        )
          .map((i) => i.name)
          .sort();
      expect(await names(p.product.slug)).toEqual([
        'All',
        'BundleWithP',
        'ByAncestorCategory',
        'ByBrand',
        'ByProduct',
      ]);
      expect(await names(q.product.slug)).toEqual([
        'All',
        'BundleWithP',
        'BundleWithoutP',
        'ExcludesBrandOnly',
        'OtherCategory',
      ]);
    });

    it('404s for unknown or unpublished products', async () => {
      const draft = await makeProduct(app, { status: 'draft' });
      await anon().get('/v1/public/products/nope-nope/coupons').expect(404);
      await anon().get(`/v1/public/products/${draft.product.slug}/coupons`).expect(404);
    });
  });

  describe('customer wallet', () => {
    it('needs a signed-in customer', async () => {
      const c = await dbCoupon(app, { ...pub, isCollectable: true });
      await anon().get('/v1/customer/coupons').expect(401);
      await anon().post(`/v1/customer/coupons/${c.id}/collect`).expect(401);
      await anon().delete(`/v1/customer/coupons/${c.id}`).expect(401);
    });

    it('collects idempotently, lists it with its state, and removes it again', async () => {
      const me = await customer();
      const c = await dbCoupon(app, {
        ...pub,
        name: 'Collect me',
        code: 'GRAB10',
        isCollectable: true,
        minOrderP: 50_000,
        maxDiscountP: 10_000,
        termsEn: 'Terms',
        endsAt: inDays(5),
      });
      const first = await me.agent.post(`/v1/customer/coupons/${c.id}/collect`).expect(200);
      expect(first.body).toMatchObject({
        couponId: c.id,
        name: 'Collect me',
        code: 'GRAB10',
        type: 'percent',
        value: 1000,
        minOrderP: 50_000,
        maxDiscountP: 10_000,
        termsEn: 'Terms',
        state: 'usable',
        source: 'collected',
      });
      await me.agent.post(`/v1/customer/coupons/${c.id}/collect`).expect(200);
      expect(await prisma.couponWallet.count()).toBe(1);
      const list = await me.agent.get('/v1/customer/coupons').expect(200);
      expect(list.headers['cache-control']).toMatch(/no-store/);
      expect(list.body.items).toHaveLength(1);
      await me.agent.delete(`/v1/customer/coupons/${c.id}`).expect(204);
      await me.agent.delete(`/v1/customer/coupons/${c.id}`).expect(204);
      expect((await me.agent.get('/v1/customer/coupons').expect(200)).body.items).toEqual([]);
    });

    it('refuses what cannot be collected', async () => {
      const me = await customer();
      const notCollectable = await dbCoupon(app, { ...pub });
      const hidden = await dbCoupon(app, { isCollectable: true });
      const paused = await dbCoupon(app, { ...pub, isCollectable: true, status: 'paused' });
      const expired = await dbCoupon(app, {
        ...pub,
        isCollectable: true,
        startsAt: inDays(-3),
        endsAt: inDays(-1),
      });
      const future = await dbCoupon(app, { ...pub, isCollectable: true, startsAt: inDays(2) });
      const maxed = await dbCoupon(app, {
        ...pub,
        isCollectable: true,
        maxUsesTotal: 1,
        usesCount: 1,
      });
      const collect = (id: string) => me.agent.post(`/v1/customer/coupons/${id}/collect`);
      for (const c of [notCollectable, hidden, paused]) {
        expect((await collect(c.id).expect(404)).body.code).toBe('COUPON_NOT_FOUND');
      }
      for (const c of [expired, future, maxed]) {
        expect((await collect(c.id).expect(409)).body.code).toBe('COUPON_NOT_ACTIVE');
      }
      await collect('0198a000-0000-7000-8000-000000000000').expect(404);
      await collect('not-a-uuid').expect(400);
      expect(await prisma.couponWallet.count()).toBe(0);
    });

    it('merges collected coupons, assigned coupons and assigned bulk codes with their states', async () => {
      const me = await customer();
      const someone = await customer();
      const collected = await dbCoupon(app, {
        ...pub,
        name: '1 collected',
        code: 'COL',
        isCollectable: true,
      });
      await prisma.couponWallet.create({ data: { customerId: me.id, couponId: collected.id } });

      const assigned = await dbCoupon(app, {
        name: '2 assigned',
        code: 'ASG',
        segment: 'specific',
      });
      await prisma.couponCustomer.create({ data: { customerId: me.id, couponId: assigned.id } });
      // Also collected: shows once.
      await prisma.couponWallet.create({ data: { customerId: me.id, couponId: assigned.id } });

      const bulk = await dbCoupon(app, {
        name: '3 bulk',
        code: null,
        isBulk: true,
        segment: 'specific',
      });
      await prisma.couponCode.createMany({
        data: [
          { couponId: bulk.id, code: 'MINE-1', assignedCustomerId: me.id },
          { couponId: bulk.id, code: 'MINE-2', assignedCustomerId: me.id, usedAt: new Date() },
          { couponId: bulk.id, code: 'THEIRS', assignedCustomerId: someone.id },
          { couponId: bulk.id, code: 'FREE' },
        ],
      });

      const perCustomer = await dbCoupon(app, {
        name: '4 per customer',
        code: 'PER',
        maxPerCustomer: 1,
      });
      await prisma.couponWallet.create({ data: { customerId: me.id, couponId: perCustomer.id } });
      const order = await makeOrder(app, { customerId: me.id });
      await prisma.couponRedemption.create({
        data: { couponId: perCustomer.id, orderId: order.id, customerId: me.id, discountP: 100 },
      });

      const future = await dbCoupon(app, {
        name: '5 not started',
        code: 'FUT',
        startsAt: inDays(2),
      });
      const expired = await dbCoupon(app, {
        name: '6 expired',
        code: 'OLD',
        startsAt: inDays(-4),
        endsAt: inDays(-1),
      });
      const longGone = await dbCoupon(app, {
        name: '7 long gone',
        code: 'GONE',
        startsAt: inDays(-90),
        endsAt: inDays(-60),
      });
      const maxed = await dbCoupon(app, {
        name: '8 maxed',
        code: 'MXD',
        maxUsesTotal: 1,
        usesCount: 1,
      });
      const paused = await dbCoupon(app, { name: '9 paused', code: 'PAU', status: 'paused' });
      for (const c of [future, expired, longGone, maxed, paused]) {
        await prisma.couponWallet.create({ data: { customerId: me.id, couponId: c.id } });
      }

      const res = await me.agent.get('/v1/customer/coupons').expect(200);
      const rows = res.body.items as {
        name: string;
        code: string | null;
        state: string;
        source: string;
        collected: boolean;
      }[];
      const find = (name: string, code?: string) =>
        rows.find((r) => r.name === name && (code === undefined || r.code === code));
      expect(rows).toHaveLength(8);
      expect(find('1 collected')).toMatchObject({
        code: 'COL',
        state: 'usable',
        source: 'collected',
        collected: true,
      });
      expect(rows.filter((r) => r.name === '2 assigned')).toHaveLength(1);
      expect(find('2 assigned')).toMatchObject({ code: 'ASG', state: 'usable' });
      expect(find('3 bulk', 'MINE-1')).toMatchObject({
        state: 'usable',
        source: 'bulk_code',
        collected: false,
      });
      expect(find('3 bulk', 'MINE-2')).toMatchObject({ state: 'used_up' });
      expect(rows.some((r) => r.code === 'THEIRS' || r.code === 'FREE')).toBe(false);
      expect(find('4 per customer')).toMatchObject({ state: 'used_up' });
      expect(find('5 not started')).toMatchObject({ state: 'not_started' });
      expect(find('6 expired')).toMatchObject({ state: 'expired' });
      expect(find('8 maxed')).toMatchObject({ state: 'used_up' });
      expect(find('7 long gone')).toBeUndefined();
      expect(find('9 paused')).toBeUndefined();
      // Usable first, expired last.
      expect(rows[0]?.state).toBe('usable');
      expect(rows.at(-1)?.state).toBe('expired');
      // Another customer sees none of it.
      expect(
        (await someone.agent.get('/v1/customer/coupons').expect(200)).body.items.map(
          (r: { code: string }) => r.code,
        ),
      ).toEqual(['THEIRS']);
    });
  });
});
