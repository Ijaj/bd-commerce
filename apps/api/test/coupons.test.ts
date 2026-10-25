import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { makeProduct, resetCommerce, signupCustomer } from './cart-fixtures';
import { DAY, dbCoupon, inDays, makeOrder } from './coupons-fixtures';
import { type Agent, createApp, createStaffWith } from './helpers';

vi.setConfig({ testTimeout: 60_000 });

describe('coupons admin', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mgr: Agent;
  let viewer: Agent;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetCommerce(app);
    mgr = (await createStaffWith(app, ['coupons.view', 'coupons.manage'])).agent;
    viewer = (await createStaffWith(app, ['coupons.view'])).agent;
  }, 90_000);
  afterAll(() => app.close());

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE coupons, orders, customers CASCADE');
  });

  const base = { name: 'Eid 10', kind: 'code', code: 'eid10', type: 'percent', value: 1000 };
  const post = (body: object) => mgr.post('/v1/admin/coupons').send({ ...base, ...body });

  describe('create + validation', () => {
    it('stores the code upper-case and returns the full detail', async () => {
      const res = await post({
        minOrderP: 50_000,
        maxDiscountP: 20_000,
        platform: 'web',
        paymentMethods: ['cod'],
        maxPerCustomer: 2,
      }).expect(201);
      expect(res.body).toMatchObject({
        name: 'Eid 10',
        code: 'EID10',
        status: 'draft',
        phase: 'draft',
        type: 'percent',
        value: 1000,
        minOrderP: 50_000,
        platform: 'web',
        paymentMethods: ['cod'],
        usesCount: 0,
        targets: [],
        zones: [],
        tiers: [],
        customers: [],
        codeStats: { total: 0, used: 0, assigned: 0 },
      });
    });

    it('refuses a duplicate code, case-insensitively, and a code equal to a bulk code', async () => {
      await post({}).expect(201);
      const dup = await post({ code: 'Eid10' }).expect(409);
      expect(dup.body.code).toBe('COUPON_CODE_TAKEN');
      const bulk = await post({ code: null, isBulk: true, name: 'bulk' }).expect(201);
      await mgr
        .post(`/v1/admin/coupons/${bulk.body.id}/codes/generate`)
        .send({ count: 1 })
        .expect(201);
      const code = (await prisma.couponCode.findFirstOrThrow()).code;
      await post({ code }).expect(409);
    });

    const invalid: [string, object][] = [
      ['percent value 0', { value: 0 }],
      ['percent over 100%', { value: 10_001 }],
      ['fixed value 0', { type: 'fixed', value: 0 }],
      ['free_delivery with a value', { type: 'free_delivery', value: 500 }],
      ['tiered without tiers', { type: 'tiered', value: 0 }],
      [
        'tiered with equal minimums',
        {
          type: 'tiered',
          value: 0,
          tiers: [
            { minSpendP: 1000, discountP: 10 },
            { minSpendP: 1000, discountP: 20 },
          ],
        },
      ],
      ['tiers on a percent coupon', { tiers: [{ minSpendP: 1000, discountP: 10 }] }],
      ['bxgy without config', { type: 'bxgy', value: 0 }],
      [
        'bxgy free items from other products but none listed',
        {
          type: 'bxgy',
          value: 0,
          config: { buyQty: 1, getQty: 1, getPctBp: 10_000, getSame: false },
        },
      ],
      ['bundle without config', { type: 'bundle', value: 0 }],
      ['auto coupon with a code', { kind: 'auto' }],
      ['code coupon without code', { code: null }],
      ['bulk coupon with a code', { isBulk: true }],
      ['collectable but hidden', { isCollectable: true, visibility: 'hidden' }],
      ['collectable auto', { kind: 'auto', code: null, isCollectable: true, visibility: 'public' }],
      [
        'end before start',
        { startsAt: new Date(Date.now() + DAY).toISOString(), endsAt: new Date().toISOString() },
      ],
      ['inactive_days without days', { segment: 'inactive_days' }],
      ['segmentParam on all', { segmentParam: 5 }],
    ];
    it.each(invalid)('rejects %s with 422', async (_n, body) => {
      const res = await post(body).expect(422);
      expect(res.body.code).toBe('COUPON_CONFIG_INVALID');
      expect(res.body.issues.length).toBeGreaterThan(0);
    });

    it('rejects malformed fields with 400', async () => {
      await post({ code: 'a b' }).expect(400);
      await post({ code: 'ab' }).expect(400);
      await post({ type: 'nope' }).expect(400);
      await post({ maxUsesTotal: 0 }).expect(400);
      await mgr.post('/v1/admin/coupons').send({ name: 'x' }).expect(400);
    });

    it('rejects unknown product, category, brand, zone and customer ids', async () => {
      const ghost = '0198a000-0000-7000-8000-000000000000';
      for (const body of [
        { targets: [{ targetType: 'product', targetId: ghost, mode: 'include' }] },
        { targets: [{ targetType: 'category', targetId: ghost, mode: 'include' }] },
        { targets: [{ targetType: 'brand', targetId: ghost, mode: 'exclude' }] },
        { zoneIds: [ghost] },
        { segment: 'specific', customerIds: [ghost] },
      ]) {
        const res = await post(body).expect(422);
        expect(res.body.code).toBe('COUPON_TARGET_NOT_FOUND');
      }
    });

    it('accepts every coupon type and normalizes the stored config', async () => {
      const a = await makeProduct(app);
      const b = await makeProduct(app);
      const zone = await prisma.deliveryZone.findFirstOrThrow();
      const tiered = await post({
        code: 'TIER',
        type: 'tiered',
        value: 0,
        tiers: [
          { minSpendP: 200_000, discountP: 30_000 },
          { minSpendP: 100_000, discountP: 10_000 },
        ],
      }).expect(201);
      expect(tiered.body.tiers).toEqual([
        { minSpendP: 100_000, discountP: 10_000 },
        { minSpendP: 200_000, discountP: 30_000 },
      ]);
      await post({ code: 'FIX', type: 'fixed', value: 5000 }).expect(201);
      const fd = await post({
        code: 'FREEDEL',
        type: 'free_delivery',
        value: 0,
        zoneIds: [zone.id],
      }).expect(201);
      expect(fd.body.zones).toEqual([{ id: zone.id, name: zone.nameEn }]);
      const bxgy = await post({
        code: 'BXGY',
        type: 'bxgy',
        value: 0,
        config: { buyQty: 2, getQty: 1, getPctBp: 5000, getSame: true, junk: 1 },
        targets: [{ targetType: 'product', targetId: a.product.id, mode: 'include' }],
      }).expect(201);
      expect(bxgy.body.config).toEqual({
        buyQty: 2,
        getQty: 1,
        getPctBp: 5000,
        getSame: true,
        getProductIds: [],
      });
      expect(bxgy.body.targets).toEqual([
        {
          targetType: 'product',
          targetId: a.product.id,
          mode: 'include',
          label: a.product.titleEn,
        },
      ]);
      const bundle = await post({
        code: 'BUN',
        type: 'bundle',
        value: 0,
        config: {
          items: [
            { productId: a.product.id, qty: 1 },
            { productId: b.product.id, variantId: b.variant.id, qty: 2 },
          ],
          priceP: 150_000,
        },
      }).expect(201);
      expect(bundle.body.config.priceP).toBe(150_000);
      const auto = await post({ kind: 'auto', code: null, name: 'Auto 5', value: 500 }).expect(201);
      expect(auto.body.code).toBeNull();
    });

    it('needs permissions: view-only staff can read, not write; anonymous gets 401', async () => {
      const made = await post({}).expect(201);
      await viewer.get('/v1/admin/coupons').expect(200);
      await viewer.get(`/v1/admin/coupons/${made.body.id}`).expect(200);
      await viewer
        .post('/v1/admin/coupons')
        .send({ ...base, code: 'X1X' })
        .expect(403);
      await viewer.patch(`/v1/admin/coupons/${made.body.id}`).send({ name: 'z' }).expect(403);
      await viewer.post(`/v1/admin/coupons/${made.body.id}/activate`).expect(403);
      await viewer.get(`/v1/admin/coupons/${made.body.id}/codes`).expect(403);
      await request(app.getHttpServer()).get('/v1/admin/coupons').expect(401);
    });
  });

  describe('list + phases', () => {
    it('computes phase and filters', async () => {
      const past = inDays(-10);
      await dbCoupon(app, { name: 'A draft', status: 'draft' });
      await dbCoupon(app, { name: 'B live' });
      await dbCoupon(app, { name: 'C scheduled', startsAt: inDays(2) });
      await dbCoupon(app, { name: 'D expired', startsAt: past, endsAt: inDays(-1) });
      await dbCoupon(app, { name: 'E paused', status: 'paused' });
      await dbCoupon(app, { name: 'F maxed', maxUsesTotal: 3, usesCount: 3 });
      await dbCoupon(app, { name: 'G budget', budgetCapP: 1000, discountGivenP: 1000 });
      await dbCoupon(app, { name: 'H auto', kind: 'auto', code: null, type: 'fixed', value: 100 });

      const all = await mgr.get('/v1/admin/coupons?limit=100').expect(200);
      expect(all.body.total).toBe(8);
      const phases = Object.fromEntries(
        all.body.items.map((i: { name: string; phase: string }) => [i.name, i.phase]),
      );
      expect(phases).toEqual({
        'A draft': 'draft',
        'B live': 'live',
        'C scheduled': 'scheduled',
        'D expired': 'expired',
        'E paused': 'paused',
        'F maxed': 'exhausted',
        'G budget': 'exhausted',
        'H auto': 'live',
      });

      const names = async (qs: string) =>
        ((await mgr.get(`/v1/admin/coupons?${qs}`).expect(200)).body.items as { name: string }[])
          .map((i) => i.name)
          .sort();
      expect(await names('phase=live')).toEqual(['B live', 'H auto']);
      expect(await names('phase=exhausted')).toEqual(['F maxed', 'G budget']);
      expect(await names('phase=draft')).toEqual(['A draft']);
      expect(await names('phase=paused')).toEqual(['E paused']);
      expect(await names('kind=auto')).toEqual(['H auto']);
      expect(await names('type=fixed')).toEqual(['H auto']);
      expect(await names('status=paused')).toEqual(['E paused']);
      expect(await names('status=draft&phase=live')).toEqual([]);
      expect(await names('q=sched')).toEqual(['C scheduled']);
      const byCode = await dbCoupon(app, { name: 'Z', code: 'SUMMER25' });
      expect(await names('q=summer')).toEqual([byCode.name]);
    });

    it('pages, newest first, and reports the total', async () => {
      for (let i = 0; i < 5; i++) await dbCoupon(app, { name: `P${i}` });
      const res = await mgr.get('/v1/admin/coupons?limit=2&page=2').expect(200);
      expect(res.body).toMatchObject({ total: 5, page: 2, limit: 2 });
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['P2', 'P1']);
      const live = await mgr.get('/v1/admin/coupons?phase=live&limit=2&page=3').expect(200);
      expect(live.body).toMatchObject({ total: 5 });
      expect(live.body.items).toHaveLength(1);
    });
  });

  describe('update, lifecycle, delete', () => {
    it('patches fields and replaces target/zone/tier/customer lists only when sent', async () => {
      const a = await makeProduct(app);
      const zone = await prisma.deliveryZone.findFirstOrThrow();
      const made = await post({
        targets: [{ targetType: 'product', targetId: a.product.id, mode: 'include' }],
        zoneIds: [zone.id],
      }).expect(201);
      const id = made.body.id;
      const r1 = await mgr
        .patch(`/v1/admin/coupons/${id}`)
        .send({ name: 'Renamed', value: 2000 })
        .expect(200);
      expect(r1.body).toMatchObject({ name: 'Renamed', value: 2000, code: 'EID10' });
      expect(r1.body.targets).toHaveLength(1);
      expect(r1.body.zones).toHaveLength(1);
      const r2 = await mgr
        .patch(`/v1/admin/coupons/${id}`)
        .send({ targets: [], zoneIds: [], endsAt: null })
        .expect(200);
      expect(r2.body.targets).toEqual([]);
      expect(r2.body.zones).toEqual([]);
      const cust = await prisma.customer.create({ data: { name: 'Rahim', phone: '01711111111' } });
      const r3 = await mgr
        .patch(`/v1/admin/coupons/${id}`)
        .send({ segment: 'specific', customerIds: [cust.id] })
        .expect(200);
      expect(r3.body.customers).toEqual([
        { id: cust.id, name: 'Rahim', phone: '01711111111', email: null },
      ]);
      await mgr.get('/v1/admin/coupons/0198a000-0000-7000-8000-000000000000').expect(404);
      await mgr.patch(`/v1/admin/coupons/${id}`).send({ code: 'EID10-2' }).expect(200);
    });

    it('validates the merged result on patch (422) and on a code clash (409)', async () => {
      const a = (await post({}).expect(201)).body;
      const b = (await post({ code: 'OTHER' }).expect(201)).body;
      await mgr.patch(`/v1/admin/coupons/${a.id}`).send({ type: 'fixed' }).expect(200);
      await mgr.patch(`/v1/admin/coupons/${a.id}`).send({ type: 'tiered', value: 0 }).expect(422);
      await mgr.patch(`/v1/admin/coupons/${a.id}`).send({ code: 'other' }).expect(409);
      await mgr
        .patch(`/v1/admin/coupons/${b.id}`)
        .send({ endsAt: new Date(0).toISOString(), startsAt: new Date().toISOString() })
        .expect(422);
    });

    it('activates a valid coupon, pauses it, and refuses to activate a broken one', async () => {
      const made = (await post({}).expect(201)).body;
      const act = await mgr.post(`/v1/admin/coupons/${made.id}/activate`).expect(200);
      expect(act.body).toMatchObject({ status: 'active', phase: 'live' });
      await mgr.post(`/v1/admin/coupons/${made.id}/activate`).expect(200);
      const paused = await mgr.post(`/v1/admin/coupons/${made.id}/pause`).expect(200);
      expect(paused.body).toMatchObject({ status: 'paused', phase: 'paused' });
      await mgr.post(`/v1/admin/coupons/${made.id}/pause`).expect(200);

      const draft = (await post({ code: 'DRAFTY' }).expect(201)).body;
      await mgr.post(`/v1/admin/coupons/${draft.id}/pause`).expect(409);
      // A copy of a code coupon has no code yet, so it cannot go live until one is set.
      const copy = (await mgr.post(`/v1/admin/coupons/${made.id}/duplicate`).expect(201)).body;
      expect(copy).toMatchObject({
        name: 'Eid 10 (copy)',
        status: 'draft',
        code: null,
        usesCount: 0,
      });
      await mgr.post(`/v1/admin/coupons/${copy.id}/activate`).expect(422);
      await mgr.patch(`/v1/admin/coupons/${copy.id}`).send({ code: 'COPY1' }).expect(200);
      await mgr.post(`/v1/admin/coupons/${copy.id}/activate`).expect(200);

      const specific = (await post({ code: 'SPEC', segment: 'specific' }).expect(201)).body;
      const res = await mgr.post(`/v1/admin/coupons/${specific.id}/activate`).expect(422);
      expect(res.body.issues[0]).toMatch(/customer/);
    });

    it('duplicates targets, tiers and customers', async () => {
      const a = await makeProduct(app);
      const made = (
        await post({
          type: 'tiered',
          value: 0,
          tiers: [{ minSpendP: 1000, discountP: 100 }],
          targets: [{ targetType: 'product', targetId: a.product.id, mode: 'exclude' }],
        }).expect(201)
      ).body;
      const copy = (await mgr.post(`/v1/admin/coupons/${made.id}/duplicate`).expect(201)).body;
      expect(copy.tiers).toHaveLength(1);
      expect(copy.targets).toHaveLength(1);
      expect(copy.id).not.toBe(made.id);
    });

    it('deletes an unused coupon; a redeemed one is locked and cannot be deleted', async () => {
      const gone = (await post({ code: 'GONE' }).expect(201)).body;
      await mgr.delete(`/v1/admin/coupons/${gone.id}`).expect(204);
      await mgr.get(`/v1/admin/coupons/${gone.id}`).expect(404);
      await mgr.delete(`/v1/admin/coupons/${gone.id}`).expect(404);

      const used = (await post({ code: 'USED' }).expect(201)).body;
      const order = await makeOrder(app);
      await prisma.couponRedemption.create({
        data: { couponId: used.id, orderId: order.id, discountP: 500, phone: '01799999999' },
      });
      const del = await mgr.delete(`/v1/admin/coupons/${used.id}`).expect(409);
      expect(del.body.code).toBe('COUPON_REDEEMED');
      const lock = await mgr
        .patch(`/v1/admin/coupons/${used.id}`)
        .send({ code: 'NEWCODE' })
        .expect(409);
      expect(lock.body.code).toBe('COUPON_LOCKED');
      await mgr.patch(`/v1/admin/coupons/${used.id}`).send({ type: 'fixed', value: 5 }).expect(409);
      await mgr
        .patch(`/v1/admin/coupons/${used.id}`)
        .send({ name: 'still editable', value: 1500 })
        .expect(200);
    });

    it('looks customers up by phone, email or name', async () => {
      await prisma.customer.create({
        data: { name: 'Karima Akter', phone: '01755500001', email: 'karima@example.com' },
      });
      await prisma.customer.create({ data: { name: 'Other', phone: '01755500002' } });
      const by = async (q: string) =>
        (await mgr.get('/v1/admin/coupons/customer-lookup').query({ q }).expect(200)).body.items;
      expect(await by('0175550000')).toHaveLength(2);
      expect(await by('01755500001')).toEqual([expect.objectContaining({ name: 'Karima Akter' })]);
      expect(await by('KARIMA@')).toHaveLength(1);
      expect(await by('akter')).toHaveLength(1);
      await mgr.get('/v1/admin/coupons/customer-lookup?q=a').expect(400);
      await viewer.get('/v1/admin/coupons/customer-lookup?q=karima').expect(403);
    });
  });

  describe('bulk codes', () => {
    async function bulk(extra: object = {}) {
      return (await post({ code: null, isBulk: true, name: 'Bulk', ...extra }).expect(201)).body;
    }

    it('generates unique unambiguous codes with an optional prefix', async () => {
      const c = await bulk();
      await mgr
        .post(`/v1/admin/coupons/${c.id}/codes/generate`)
        .send({ count: 200, length: 6 })
        .expect(201);
      const res = await mgr
        .post(`/v1/admin/coupons/${c.id}/codes/generate`)
        .send({ count: 50, prefix: 'sum', length: 8 })
        .expect(201);
      expect(res.body).toEqual({ generated: 50, total: 250 });
      const rows = await prisma.couponCode.findMany({ where: { couponId: c.id } });
      expect(new Set(rows.map((r) => r.code)).size).toBe(250);
      const plain = rows.filter((r) => !r.code.startsWith('SUM-'));
      expect(plain).toHaveLength(200);
      for (const r of plain) expect(r.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      for (const r of rows.filter((r) => r.code.startsWith('SUM-')))
        expect(r.code).toMatch(/^SUM-[A-Z2-9]{8}$/);
      expect((await mgr.get(`/v1/admin/coupons/${c.id}`).expect(200)).body.codeStats).toEqual({
        total: 250,
        used: 0,
        assigned: 0,
      });
    });

    it('rejects bad generate input and non-bulk coupons', async () => {
      const c = await bulk();
      const gen = (body: object) => mgr.post(`/v1/admin/coupons/${c.id}/codes/generate`).send(body);
      await gen({ count: 0 }).expect(400);
      await gen({ count: 5001 }).expect(400);
      await gen({ count: 5, length: 5 }).expect(400);
      await gen({ count: 5, length: 13 }).expect(400);
      await gen({ count: 5, prefix: 'a b' }).expect(400);
      const single = (await post({ code: 'SINGLE' }).expect(201)).body;
      const res = await mgr
        .post(`/v1/admin/coupons/${single.id}/codes/generate`)
        .send({ count: 5 })
        .expect(409);
      expect(res.body.code).toBe('COUPON_NOT_BULK');
      await mgr.get(`/v1/admin/coupons/${single.id}/codes`).expect(409);
    });

    it('lists with status filter and paging, and exports CSV', async () => {
      const c = await bulk();
      await mgr.post(`/v1/admin/coupons/${c.id}/codes/generate`).send({ count: 12 }).expect(201);
      const [first] = await prisma.couponCode.findMany({
        where: { couponId: c.id },
        orderBy: { id: 'asc' },
      });
      const cust = await prisma.customer.create({ data: { name: 'Asma', phone: '01733333333' } });
      await prisma.couponCode.update({
        where: { id: first?.id ?? '' },
        data: { usedAt: new Date(), assignedCustomerId: cust.id },
      });

      const page1 = await mgr.get(`/v1/admin/coupons/${c.id}/codes?limit=5`).expect(200);
      expect(page1.body).toMatchObject({ total: 12, page: 1, limit: 5 });
      expect(page1.body.items).toHaveLength(5);
      expect(page1.body.items[0]).toMatchObject({
        code: first?.code,
        assignedCustomer: { name: 'Asma', phone: '01733333333' },
      });
      expect(
        (await mgr.get(`/v1/admin/coupons/${c.id}/codes?status=used`).expect(200)).body.total,
      ).toBe(1);
      expect(
        (await mgr.get(`/v1/admin/coupons/${c.id}/codes?status=unused&limit=50`).expect(200)).body
          .total,
      ).toBe(11);
      expect(
        (
          await mgr
            .get(`/v1/admin/coupons/${c.id}/codes?q=${first?.code.slice(0, 4).toLowerCase()}`)
            .expect(200)
        ).body.total,
      ).toBeGreaterThanOrEqual(1);

      const csv = await mgr.get(`/v1/admin/coupons/${c.id}/codes/export`).expect(200);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.headers['content-disposition']).toMatch(/attachment/);
      const lines = csv.text.trim().split('\n');
      expect(lines[0]).toBe('code,status,used_at,assigned_phone');
      expect(lines).toHaveLength(13);
      expect(lines.filter((l) => l.includes(',used,'))).toHaveLength(1);
      expect(lines.find((l) => l.startsWith(first?.code ?? ''))).toMatch(/01733333333$/);
    });

    it('assigns unused codes to a customer, all or nothing', async () => {
      const c = await bulk();
      await mgr.post(`/v1/admin/coupons/${c.id}/codes/generate`).send({ count: 5 }).expect(201);
      const cust = await prisma.customer.create({ data: { name: 'Asma', phone: '01733333333' } });
      const url = `/v1/admin/coupons/${c.id}/codes/assign`;
      const ok = await mgr.post(url).send({ customerId: cust.id, count: 3 }).expect(200);
      expect(ok.body.assigned).toBe(3);
      expect(ok.body.codes).toHaveLength(3);
      expect(await prisma.couponCode.count({ where: { assignedCustomerId: cust.id } })).toBe(3);
      const over = await mgr.post(url).send({ customerId: cust.id, count: 3 }).expect(409);
      expect(over.body).toMatchObject({ code: 'COUPON_NOT_ENOUGH_CODES', available: 2 });
      expect(await prisma.couponCode.count({ where: { assignedCustomerId: cust.id } })).toBe(3);
      await mgr
        .post(url)
        .send({ customerId: '0198a000-0000-7000-8000-000000000000', count: 1 })
        .expect(404);
      await mgr.post(url).send({ customerId: cust.id, count: 0 }).expect(400);
    });

    it('a bulk coupon cannot go live without codes', async () => {
      const c = await bulk();
      const res = await mgr.post(`/v1/admin/coupons/${c.id}/activate`).expect(422);
      expect(res.body.issues[0]).toMatch(/code/);
      await mgr.post(`/v1/admin/coupons/${c.id}/codes/generate`).send({ count: 2 }).expect(201);
      await mgr.post(`/v1/admin/coupons/${c.id}/activate`).expect(200);
    });
  });

  describe('report', () => {
    it('sums uses, revenue, discount, reversals, days and top customers', async () => {
      const c = await dbCoupon(app);
      const other = await dbCoupon(app);
      const agent = request.agent(app.getHttpServer());
      const rahim = await signupCustomer(app, agent, '01712300001');
      const karim = await prisma.customer.create({ data: { name: 'Karim', phone: '01712300002' } });

      const redeem = async (o: {
        cust?: string;
        phone?: string;
        total: number;
        discount: number;
        at?: Date;
        status?: 'applied' | 'reversed';
        coupon?: string;
      }) => {
        const order = await makeOrder(app, { customerId: o.cust ?? null, grandTotalP: o.total });
        await prisma.couponRedemption.create({
          data: {
            couponId: o.coupon ?? c.id,
            orderId: order.id,
            customerId: o.cust ?? null,
            phone: o.phone ?? null,
            discountP: o.discount,
            status: o.status ?? 'applied',
            ...(o.status === 'reversed' ? { reversedAt: new Date() } : {}),
            ...(o.at ? { createdAt: o.at } : {}),
          },
        });
      };
      const d1 = new Date('2026-03-10T08:00:00Z');
      const d2 = new Date('2026-03-12T08:00:00Z');
      await redeem({ cust: rahim.id, total: 100_000, discount: 10_000, at: d1 });
      await redeem({ cust: rahim.id, total: 50_000, discount: 5000, at: d2 });
      await redeem({ cust: karim.id, total: 80_000, discount: 8000, at: d2 });
      await redeem({ phone: '01788888888', total: 20_000, discount: 2000, at: d2 });
      await redeem({ cust: karim.id, total: 999_999, discount: 9999, at: d2, status: 'reversed' });
      await redeem({ cust: rahim.id, total: 777, discount: 77, at: d2, coupon: other.id });

      const r = (await mgr.get(`/v1/admin/coupons/${c.id}/report`).expect(200)).body;
      expect(r).toMatchObject({
        uses: 4,
        uniqueCustomers: 3,
        revenueP: 250_000,
        discountGivenP: 25_000,
        avgOrderP: 62_500,
        reversed: 1,
      });
      expect(r.daily).toEqual([
        { date: '2026-03-10', uses: 1, discountP: 10_000 },
        { date: '2026-03-12', uses: 3, discountP: 15_000 },
      ]);
      expect(r.topCustomers).toEqual([
        { customerId: rahim.id, name: 'Rahim', uses: 2, discountP: 15_000 },
        { customerId: karim.id, name: 'Karim', uses: 1, discountP: 8000 },
      ]);

      const ranged = (
        await mgr.get(`/v1/admin/coupons/${c.id}/report?from=2026-03-11&to=2026-03-12`).expect(200)
      ).body;
      expect(ranged).toMatchObject({ uses: 3, discountGivenP: 15_000, reversed: 1 });
      const first = (await mgr.get(`/v1/admin/coupons/${c.id}/report?to=2026-03-10`).expect(200))
        .body;
      expect(first).toMatchObject({ uses: 1, revenueP: 100_000, avgOrderP: 100_000 });
      const empty = (await mgr.get(`/v1/admin/coupons/${c.id}/report?from=2027-01-01`).expect(200))
        .body;
      expect(empty).toMatchObject({ uses: 0, avgOrderP: 0, daily: [], topCustomers: [] });
      await mgr.get(`/v1/admin/coupons/${c.id}/report?from=nope`).expect(400);
      await viewer.get(`/v1/admin/coupons/${c.id}/report`).expect(200);
    });
  });
});
