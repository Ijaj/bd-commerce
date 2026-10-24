import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { escapeHtml, memoMoney } from '../src/sr/sr-memo.service';
import { type Agent, createApp, createStaffWith, resetDb } from './helpers';

const EVIL = `<script>alert("x")</script> & 'q'`;

describe('SR memo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sr: Agent;
  let admin: Agent;
  let saleId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const a = await createStaffWith(app, ['sr.portal']);
    const b = await createStaffWith(app, ['sr.approve', 'b2b.view']);
    sr = a.agent;
    admin = b.agent;
    const staff = await prisma.staff.findUniqueOrThrow({ where: { email: a.email } });
    await prisma.srProfile.create({ data: { staffId: staff.id } });
    await prisma.staff.update({ where: { id: staff.id }, data: { name: `Rep ${EVIL}` } });

    const categoryId = randomUUID();
    await prisma.category.create({
      data: { id: categoryId, level: 1, path: `/${categoryId}/`, nameEn: 'Root', slug: 'root' },
    });
    const seller = await prisma.seller.findFirstOrThrow();
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        primaryCategoryId: categoryId,
        titleEn: `Shirt ${EVIL}`,
        titleBn: 'শার্ট',
        slug: 'memo-shirt',
        status: 'active',
        categories: { create: { categoryId } },
        variants: { create: [{ sku: 'MEMO-1', priceP: 100_000 }] },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]?.id as string;
    await prisma.$transaction((tx) =>
      app
        .get(InventoryService)
        .move(tx, { variantId, qtyDelta: 50, reservedDelta: 0, reason: 'adjust' }),
    );
    const shop = await sr
      .post('/v1/portal/sr/shops')
      .send({
        name: `Shop ${EVIL}`,
        ownerName: EVIL,
        phone: '01711111111',
        address: `Road ${EVIL}`,
        area: 'Mirpur',
      })
      .expect(201);
    const sale = await sr
      .post('/v1/portal/sr/sales')
      .send({
        b2bShopId: shop.body.id,
        items: [{ variantId, qty: 12, unitPriceP: 1_234_550 }],
        paidAtSaleP: 5_000_000,
        note: EVIL,
      })
      .expect(201);
    saleId = sale.body.id;
  });

  it('is only available once the sale is approved', async () => {
    const res = await sr.get(`/v1/portal/sr/sales/${saleId}/memo`).expect(409);
    expect(res.body.code).toBe('NOT_APPROVED');
    await admin.get(`/v1/admin/sr/sales/${saleId}/memo`).expect(409);
  });

  it('renders escaped printable HTML in English and Bangla', async () => {
    await admin.post(`/v1/admin/sr/sales/${saleId}/approve`).expect(200);
    const memoNo = (await sr.get(`/v1/portal/sr/sales/${saleId}`).expect(200)).body
      .memoNo as string;

    for (const [name, agent, path] of [
      ['portal', sr, `/v1/portal/sr/sales/${saleId}/memo`],
      ['admin', admin, `/v1/admin/sr/sales/${saleId}/memo`],
    ] as const) {
      const en = await agent.get(path).expect(200);
      expect(en.headers['content-type'], name).toMatch(/text\/html/);
      expect(en.headers['content-security-policy']).toContain("default-src 'none'");
      expect(en.text).toContain('<!doctype html>');
      expect(en.text).toContain(memoNo);
      expect(en.text).toContain('Sales memo');
      expect(en.text).toContain('MEMO-1');
      // total 12 x 12,345.50 = 1,48,146.00; paid 50,000; due 98,146
      expect(en.text).toContain('৳1,48,146');
      expect(en.text).toContain('৳50,000');
      expect(en.text).toContain('৳98,146');
      expect(en.text).toContain('৳12,345.50');
      // user text is escaped everywhere
      expect(en.text).not.toContain('<script>');
      expect(en.text).not.toContain('alert("x")');
      expect(en.text).toContain('&#60;script&#62;');
      expect(en.text).toContain('@media print');
    }

    const bn = await sr.get(`/v1/portal/sr/sales/${saleId}/memo?lang=bn`).expect(200);
    expect(bn.text).toContain('lang="bn"');
    expect(bn.text).toContain('বিক্রয় মেমো');
    expect(bn.text).toContain('শার্ট');
    expect(bn.text).toContain('৳১,৪৮,১৪৬');
    expect(bn.text).toContain('বাকি');
    expect(bn.text).not.toContain('<script>');

    await sr.get(`/v1/portal/sr/sales/${saleId}/memo?lang=fr`).expect(400);
  });

  it('formats money and escapes', () => {
    expect(memoMoney(0, 'en')).toBe('৳0');
    expect(memoMoney(12_500_000, 'en')).toBe('৳1,25,000');
    expect(memoMoney(150, 'bn')).toBe('৳১.৫০');
    expect(escapeHtml(`<a href="x">&'</a>`)).not.toMatch(/[<>"']/);
  });
});
