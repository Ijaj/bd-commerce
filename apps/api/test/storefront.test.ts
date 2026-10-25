import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, createOwner, resetDb } from './helpers';

interface ProductSpec {
  slug: string;
  title: string;
  cat: string;
  extraCats?: string[];
  brand?: string;
  price?: number;
  compareAt?: number;
  sale?: { price: number; startsAt?: Date; endsAt?: Date };
  /** one entry per variant; default one variant */
  stocks?: number[];
  status?: 'draft' | 'active' | 'archived';
  publishedAt?: Date | null;
  preorder?: boolean;
  upcoming?: boolean;
  sold?: number;
  rating?: number;
  ratingCount?: number;
  short?: string;
  html?: string;
  optionIds?: string[];
  image?: boolean;
  pinned?: boolean;
}

const DAY = 86_400_000;

describe('public storefront api', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sellerId: string;
  const cats = new Map<string, { id: string; path: string }>();
  const brands = new Map<string, string>();

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    cats.clear();
    brands.clear();
    sellerId =
      (await prisma.seller.findFirst())?.id ??
      (await prisma.seller.create({ data: { name: 'S' } })).id;
  });
  afterAll(() => app.close());

  const get = (url: string) => request(app.getHttpServer()).get(url);

  async function cat(
    slug: string,
    parent?: string,
    extra: { isActive?: boolean; showOnHome?: boolean } = {},
  ) {
    const p = parent ? cats.get(parent) : undefined;
    const id = randomUUID();
    const path = `${p?.path ?? '/'}${id}/`;
    await prisma.category.create({
      data: {
        id,
        parentId: parent ? (p?.id ?? null) : null,
        level: path.split('/').filter(Boolean).length,
        path,
        nameEn: slug.replace(/-/g, ' '),
        slug,
        sort: cats.size,
        ...extra,
      },
    });
    cats.set(slug, { id, path });
    return id;
  }

  async function brand(slug: string, nameEn = slug, active = true) {
    const b = await prisma.brand.create({ data: { slug, nameEn, active } });
    brands.set(slug, b.id);
  }

  async function media() {
    return prisma.media.create({
      data: {
        storageKey: `media/2026/10/${randomUUID()}.jpg`,
        mime: 'image/jpeg',
        width: 800,
        height: 600,
        bytes: 1000,
      },
    });
  }

  async function product(s: ProductSpec) {
    const c = cats.get(s.cat);
    if (!c) throw new Error(`no category ${s.cat}`);
    const image = s.image ? await media() : null;
    const stocks = s.stocks ?? [10];
    return prisma.product.create({
      data: {
        sellerId,
        primaryCategoryId: c.id,
        brandId: s.brand ? brands.get(s.brand) : null,
        titleEn: s.title,
        slug: s.slug,
        shortDescriptionEn: s.short,
        descriptionHtmlEn: s.html,
        status: s.status ?? 'active',
        publishedAt: s.publishedAt === undefined ? new Date(Date.now() - 30 * DAY) : s.publishedAt,
        isPreorder: s.preorder ?? false,
        isUpcoming: s.upcoming ?? false,
        isPinned: s.pinned ?? false,
        soldCount: s.sold ?? 0,
        ratingAvg: s.rating ?? 0,
        ratingCount: s.ratingCount ?? (s.rating ? 5 : 0),
        categories: {
          create: [s.cat, ...(s.extraCats ?? [])].map((slug) => ({
            categoryId: cats.get(slug)?.id ?? '',
          })),
        },
        attributeValues: s.optionIds?.length
          ? {
              create: await Promise.all(
                s.optionIds.map(async (optionId) => {
                  const o = await prisma.attributeOption.findUniqueOrThrow({
                    where: { id: optionId },
                  });
                  return { attributeId: o.attributeId, optionId };
                }),
              ),
            }
          : undefined,
        images: image ? { create: [{ mediaId: image.id, sort: 0 }] } : undefined,
        variants: {
          create: stocks.map((onHand, i) => ({
            sku: `${s.slug}-${i}`,
            priceP: (s.price ?? 1000) + i * 100,
            compareAtP: s.compareAt,
            salePriceP: s.sale?.price,
            saleStartsAt: s.sale?.startsAt,
            saleEndsAt: s.sale?.endsAt,
            sort: i,
            inventory: { create: { onHand } },
          })),
        },
      },
    });
  }

  async function attribute(
    catSlug: string,
    key: string,
    options: string[],
    opts: { type?: 'select' | 'boolean'; filterable?: boolean } = {},
  ) {
    const a = await prisma.categoryAttribute.create({
      data: {
        categoryId: cats.get(catSlug)?.id ?? '',
        key,
        nameEn: key,
        type: opts.type ?? 'select',
        isFilterable: opts.filterable ?? true,
        options: { create: options.map((valueEn, sort) => ({ valueEn, sort })) },
      },
      include: { options: true },
    });
    return { id: a.id, options: Object.fromEntries(a.options.map((o) => [o.valueEn, o.id])) };
  }

  const slugs = (res: request.Response) => res.body.items.map((i: { slug: string }) => i.slug);

  describe('categories and listing', () => {
    beforeEach(async () => {
      await cat('electronics', undefined, { showOnHome: true });
      await cat('phones', 'electronics');
      await cat('smartphones', 'phones');
      await cat('fashion', undefined, { showOnHome: true });
      await brand('acme', 'Acme');
      await brand('globex', 'Globex');
    });

    it('serves the category tree without inactive subtrees', async () => {
      await cat('hidden', undefined, { isActive: false });
      await cat('hidden-child', 'hidden');
      const res = await get('/v1/public/categories/tree').expect(200);
      expect(res.headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=300');
      const roots = res.body.map((n: { slug: string }) => n.slug);
      expect(roots).toEqual(['electronics', 'fashion']);
      const phones = res.body[0].children[0];
      expect(phones.slug).toBe('phones');
      expect(phones.children[0]).toMatchObject({ slug: 'smartphones', level: 3, children: [] });
    });

    it('lists only public products', async () => {
      await product({ slug: 'ok', title: 'Ok', cat: 'phones' });
      await product({ slug: 'draft', title: 'Draft', cat: 'phones', status: 'draft' });
      await product({ slug: 'archived', title: 'Archived', cat: 'phones', status: 'archived' });
      await product({
        slug: 'future',
        title: 'Future',
        cat: 'phones',
        publishedAt: new Date(Date.now() + DAY),
      });
      await product({
        slug: 'unpublished',
        title: 'Unpublished',
        cat: 'phones',
        publishedAt: null,
      });
      await cat('off', undefined, { isActive: false });
      await product({ slug: 'in-hidden-cat', title: 'Hidden', cat: 'off' });
      await cat('under-off', 'off');
      await product({ slug: 'in-hidden-subtree', title: 'Hidden sub', cat: 'under-off' });
      const res = await get('/v1/public/products').expect(200);
      expect(slugs(res)).toEqual(['ok']);
      expect(res.body.total).toBe(1);
      await get('/v1/public/products/draft').expect(404);
      await get('/v1/public/products/future').expect(404);
      await get('/v1/public/products/in-hidden-subtree').expect(404);
    });

    it('includes descendants and secondary categories, and 404s on unknown categories', async () => {
      await product({ slug: 'a', title: 'A', cat: 'smartphones' });
      await product({ slug: 'b', title: 'B', cat: 'phones' });
      await product({ slug: 'c', title: 'C', cat: 'fashion', extraCats: ['phones'] });
      await product({ slug: 'd', title: 'D', cat: 'fashion' });
      const top = await get('/v1/public/products?category=electronics&sort=newest').expect(200);
      expect(slugs(top).sort()).toEqual(['a', 'b', 'c']);
      const leaf = await get('/v1/public/products?category=smartphones').expect(200);
      expect(slugs(leaf)).toEqual(['a']);
      expect(leaf.body.category.breadcrumb.map((c: { slug: string }) => c.slug)).toEqual([
        'electronics',
        'phones',
        'smartphones',
      ]);
      expect(top.body.category.children[0].slug).toBe('phones');
      await get('/v1/public/products?category=nope').expect(404);
    });

    it('filters by brand, price, rating and availability', async () => {
      await product({
        slug: 'cheap',
        title: 'Cheap',
        cat: 'phones',
        brand: 'acme',
        price: 500,
        rating: 4.5,
      });
      await product({
        slug: 'mid',
        title: 'Mid',
        cat: 'phones',
        brand: 'globex',
        price: 1500,
        rating: 3,
      });
      await product({
        slug: 'dear',
        title: 'Dear',
        cat: 'phones',
        brand: 'acme',
        price: 5000,
        stocks: [0],
      });
      await product({ slug: 'pre', title: 'Pre', cat: 'phones', preorder: true, stocks: [0] });
      await product({ slug: 'soon', title: 'Soon', cat: 'phones', upcoming: true, stocks: [0] });
      const q = async (qs: string) =>
        slugs(await get(`/v1/public/products?sort=price_asc&${qs}`).expect(200));
      expect(await q('brand=acme')).toEqual(['cheap', 'dear']);
      expect(await q('brand=acme,globex&minPrice=1000')).toEqual(['mid', 'dear']);
      expect((await q('maxPrice=1500&minPrice=600')).sort()).toEqual(['mid', 'pre', 'soon']);
      expect(await q('maxPrice=1500&minPrice=1200')).toEqual(['mid']);
      expect(await q('rating=4')).toEqual(['cheap']);
      expect(await q('availability=in_stock')).toEqual(['cheap', 'mid']);
      expect(await q('availability=preorder')).toEqual(['pre']);
      expect(await q('availability=upcoming')).toEqual(['soon']);
      expect((await q('availability=preorder,upcoming')).sort()).toEqual(['pre', 'soon']);
    });

    it('filters by attribute options and boolean attributes', async () => {
      const ram = await attribute('electronics', 'ram', ['4 GB', '8 GB', '16 GB']);
      const wifi = await attribute('phones', 'wifi', [], { type: 'boolean' });
      await product({
        slug: 'p4',
        title: 'P4',
        cat: 'smartphones',
        optionIds: [ram.options['4 GB'] as string],
      });
      await product({
        slug: 'p8',
        title: 'P8',
        cat: 'smartphones',
        optionIds: [ram.options['8 GB'] as string],
      });
      await product({
        slug: 'p16',
        title: 'P16',
        cat: 'phones',
        optionIds: [ram.options['16 GB'] as string],
      });
      const w = await product({ slug: 'pw', title: 'PW', cat: 'phones' });
      await prisma.productAttributeValue.create({
        data: { productId: w.id, attributeId: wifi.id, valueBool: true },
      });
      const base = '/v1/public/products?category=phones&sort=newest';
      const res = await get(
        `${base}&attr.ram=${ram.options['4 GB']},${ram.options['16 GB']}`,
      ).expect(200);
      expect(slugs(res).sort()).toEqual(['p16', 'p4']);
      const bool = await get(`${base}&attr.wifi=true`).expect(200);
      expect(slugs(bool)).toEqual(['pw']);
      // junk values are ignored rather than breaking the query
      await get(`${base}&attr.ram=not-a-uuid`).expect(200);
    });

    it('sorts', async () => {
      await product({
        slug: 'old',
        title: 'Old',
        cat: 'phones',
        price: 300,
        sold: 50,
        rating: 2,
        publishedAt: new Date(Date.now() - 90 * DAY),
      });
      await product({
        slug: 'new',
        title: 'New',
        cat: 'phones',
        price: 900,
        sold: 5,
        rating: 5,
        publishedAt: new Date(Date.now() - DAY),
      });
      await product({
        slug: 'mid',
        title: 'Mid',
        cat: 'phones',
        price: 600,
        sold: 20,
        rating: 4,
        publishedAt: new Date(Date.now() - 20 * DAY),
      });
      const q = async (sort: string) =>
        slugs(await get(`/v1/public/products?sort=${sort}`).expect(200));
      expect(await q('newest')).toEqual(['new', 'mid', 'old']);
      expect(await q('price_asc')).toEqual(['old', 'mid', 'new']);
      expect(await q('price_desc')).toEqual(['new', 'mid', 'old']);
      expect(await q('popular')).toEqual(['old', 'mid', 'new']);
      expect(await q('rating')).toEqual(['new', 'mid', 'old']);
      expect(slugs(await get('/v1/public/products').expect(200))).toEqual(['old', 'mid', 'new']); // default without q = popular
      await get('/v1/public/products?sort=bogus').expect(400);
    });

    it('paginates and caps the limit', async () => {
      for (let i = 0; i < 5; i++)
        await product({ slug: `p${i}`, title: `P${i}`, cat: 'phones', sold: 10 - i });
      const p1 = await get('/v1/public/products?limit=2&page=1').expect(200);
      const p3 = await get('/v1/public/products?limit=2&page=3').expect(200);
      expect(slugs(p1)).toEqual(['p0', 'p1']);
      expect(slugs(p3)).toEqual(['p4']);
      expect(p1.body).toMatchObject({ total: 5, page: 1, limit: 2 });
      await get('/v1/public/products?limit=61').expect(400);
    });

    it('computes facets over the filtered set, ignoring each facet own filter', async () => {
      const ram = await attribute('electronics', 'ram', ['4 GB', '8 GB']);
      await attribute('electronics', 'hidden-filter', ['x'], { filterable: false });
      const r4 = ram.options['4 GB'] as string;
      const r8 = ram.options['8 GB'] as string;
      await product({
        slug: 'a1',
        title: 'A1',
        cat: 'phones',
        brand: 'acme',
        price: 500,
        optionIds: [r4],
      });
      await product({
        slug: 'a2',
        title: 'A2',
        cat: 'phones',
        brand: 'acme',
        price: 700,
        optionIds: [r8],
      });
      await product({
        slug: 'g1',
        title: 'G1',
        cat: 'phones',
        brand: 'globex',
        price: 2000,
        optionIds: [r8],
      });
      await product({
        slug: 'pre',
        title: 'Pre',
        cat: 'phones',
        brand: 'globex',
        price: 3000,
        preorder: true,
        stocks: [0],
      });

      const all = await get('/v1/public/products?category=phones').expect(200);
      expect(all.body.facets.brands).toEqual([
        { slug: 'acme', nameEn: 'Acme', nameBn: null, count: 2 },
        { slug: 'globex', nameEn: 'Globex', nameBn: null, count: 2 },
      ]);
      expect(all.body.facets.price).toEqual({ min: 500, max: 3000 });
      expect(all.body.facets.availability).toEqual({ in_stock: 3, preorder: 1, upcoming: 0 });
      expect(all.body.facets.attributes).toHaveLength(1);
      expect(all.body.facets.attributes[0].options).toMatchObject([
        { id: r4, count: 1 },
        { id: r8, count: 2 },
      ]);

      // brand filter active: items narrowed, brand facet still shows the other brand, price/attrs follow brand
      const acme = await get('/v1/public/products?category=phones&brand=acme').expect(200);
      expect(slugs(acme).sort()).toEqual(['a1', 'a2']);
      expect(
        acme.body.facets.brands
          .map((b: { slug: string; count: number }) => [b.slug, b.count])
          .sort(),
      ).toEqual([
        ['acme', 2],
        ['globex', 2],
      ]);
      expect(acme.body.facets.price).toEqual({ min: 500, max: 700 });
      expect(acme.body.facets.availability.in_stock).toBe(2);

      // attribute filter: the attribute's own facet keeps both options, brands follow the filter
      const r8only = await get(`/v1/public/products?category=phones&attr.ram=${r8}`).expect(200);
      expect(slugs(r8only).sort()).toEqual(['a2', 'g1']);
      expect(
        r8only.body.facets.attributes[0].options.map((o: { count: number }) => o.count),
      ).toEqual([1, 2]);
      expect(r8only.body.facets.brands.map((b: { count: number }) => b.count)).toEqual([1, 1]);

      // price filter: price facet ignores it
      const cheap = await get('/v1/public/products?category=phones&maxPrice=800').expect(200);
      expect(cheap.body.total).toBe(2);
      expect(cheap.body.facets.price).toEqual({ min: 500, max: 3000 });

      // availability filter: availability counts ignore it
      const pre = await get('/v1/public/products?category=phones&availability=preorder').expect(
        200,
      );
      expect(pre.body.total).toBe(1);
      expect(pre.body.facets.availability).toEqual({ in_stock: 3, preorder: 1, upcoming: 0 });
      expect(pre.body.facets.brands).toHaveLength(1);
    });

    it('inherits attribute facets from ancestors only', async () => {
      const ram = await attribute('electronics', 'ram', ['4 GB']);
      await attribute('fashion', 'size', ['M']);
      await product({
        slug: 'a',
        title: 'A',
        cat: 'smartphones',
        optionIds: [ram.options['4 GB'] as string],
      });
      const res = await get('/v1/public/products?category=smartphones').expect(200);
      expect(res.body.facets.attributes.map((a: { key: string }) => a.key)).toEqual(['ram']);
      const noCat = await get('/v1/public/products').expect(200);
      expect(noCat.body.facets.attributes).toEqual([]);
      expect(noCat.body.category).toBeNull();
    });

    it('hides inactive brands from facets and filters', async () => {
      await brand('old', 'Old Brand', false);
      await product({ slug: 'x', title: 'X', cat: 'phones', brand: 'old' });
      const res = await get('/v1/public/products').expect(200);
      expect(res.body.facets.brands).toEqual([]);
      expect(slugs(res)).toEqual(['x']);
      const detail = await get('/v1/public/products/x').expect(200);
      expect(detail.body.brand).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await cat('phones');
      await brand('samsung', 'Samsung');
      await brand('acme', 'Acme');
    });

    it('ranks full-text matches by relevance', async () => {
      await product({
        slug: 'lamp',
        title: 'Desk lamp with USB charger',
        cat: 'phones',
        sold: 100,
      });
      await product({
        slug: 'charger',
        title: 'Fast charger 65W',
        cat: 'phones',
        short: 'Charger for laptops and phones',
        sold: 1,
      });
      await product({
        slug: 'cable',
        title: 'Cable',
        cat: 'phones',
        short: 'Works with any charger',
        sold: 50,
      });
      await product({ slug: 'other', title: 'Rice cooker', cat: 'phones' });
      const res = await get('/v1/public/products?q=charger').expect(200);
      expect(slugs(res)[0]).toBe('charger');
      expect(slugs(res).sort()).toEqual(['cable', 'charger', 'lamp']);
      expect(res.body.total).toBe(3);
      expect(slugs(await get('/v1/public/products?q=65w').expect(200))).toEqual(['charger']);
    });

    it('tolerates typos and matches brand names', async () => {
      await product({ slug: 'galaxy', title: 'Galaxy A55 phone', cat: 'phones', brand: 'samsung' });
      await product({ slug: 'cooker', title: 'Rice cooker', cat: 'phones', brand: 'acme' });
      expect(slugs(await get('/v1/public/products?q=galxy').expect(200))).toEqual(['galaxy']);
      expect(slugs(await get('/v1/public/products?q=samsung').expect(200))).toEqual(['galaxy']);
      expect(slugs(await get('/v1/public/products?q=samsng').expect(200))).toEqual(['galaxy']);
      expect(slugs(await get('/v1/public/products?q=zzzzqq').expect(200))).toEqual([]);
    });

    it('is injection safe and combines with filters', async () => {
      await product({ slug: 'a', title: 'Blue shirt', cat: 'phones', price: 500 });
      await product({ slug: 'b', title: 'Blue jeans', cat: 'phones', price: 1500 });
      const res = await get(`/v1/public/products?q=blue&maxPrice=1000`).expect(200);
      expect(slugs(res)).toEqual(['a']);
      await get(`/v1/public/products?q=${encodeURIComponent("'; DROP TABLE products; --")}`).expect(
        200,
      );
      expect(await prisma.product.count()).toBe(2);
    });

    it('suggests products, categories and brands', async () => {
      await cat('phone-cases', 'phones');
      await product({
        slug: 'galaxy',
        title: 'Galaxy phone',
        cat: 'phones',
        brand: 'samsung',
        image: true,
        price: 4200,
      });
      await product({ slug: 'case', title: 'Phone case', cat: 'phone-cases', sold: 5 });
      await product({ slug: 'draft', title: 'Phone draft', cat: 'phones', status: 'draft' });
      const res = await get('/v1/public/search/suggest?q=phon').expect(200);
      expect(res.body.products.map((p: { slug: string }) => p.slug).sort()).toEqual([
        'case',
        'galaxy',
      ]);
      const galaxy = res.body.products.find((p: { slug: string }) => p.slug === 'galaxy');
      expect(galaxy.priceP).toBe(4200);
      expect(galaxy.image.url320).toContain('/rs:fit:320:0/');
      expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual([
        'phones',
        'phone-cases',
      ]);
      const brandRes = await get('/v1/public/search/suggest?q=sams').expect(200);
      expect(brandRes.body.brands).toEqual([{ slug: 'samsung', nameEn: 'Samsung', nameBn: null }]);
      await get('/v1/public/search/suggest?q=a').expect(400);
      // LIKE wildcards are literal
      const wild = await get('/v1/public/search/suggest?q=%25%25').expect(200);
      expect(wild.body.products).toEqual([]);
    });
  });

  describe('cards', () => {
    beforeEach(async () => {
      await cat('phones');
    });

    it('prices from the cheapest active variant and the sale window', async () => {
      const now = Date.now();
      await product({
        slug: 'sale',
        title: 'Sale',
        cat: 'phones',
        price: 1000,
        compareAt: 1500,
        sale: { price: 800, startsAt: new Date(now - DAY), endsAt: new Date(now + DAY) },
      });
      await product({
        slug: 'expired',
        title: 'Expired',
        cat: 'phones',
        price: 1000,
        compareAt: 1000,
        sale: { price: 800, startsAt: new Date(now - 2 * DAY), endsAt: new Date(now - DAY) },
      });
      await product({
        slug: 'upcoming-sale',
        title: 'Later',
        cat: 'phones',
        price: 1000,
        sale: { price: 800, startsAt: new Date(now + DAY) },
      });
      await product({ slug: 'was', title: 'Was', cat: 'phones', price: 1000, compareAt: 1250 });
      await product({
        slug: 'lowcompare',
        title: 'Low',
        cat: 'phones',
        price: 1000,
        compareAt: 900,
      });
      await product({
        slug: 'sale-nocompare',
        title: 'SNC',
        cat: 'phones',
        price: 1000,
        sale: { price: 750 },
      });
      const bySlug: Record<
        string,
        { priceP: number; compareAtP: number | null; discountPct: number | null }
      > = {};
      const res = await get('/v1/public/products').expect(200);
      for (const i of res.body.items) bySlug[i.slug] = i;
      expect(bySlug.sale).toMatchObject({ priceP: 800, compareAtP: 1500, discountPct: 47 });
      expect(bySlug.expired).toMatchObject({ priceP: 1000, compareAtP: null, discountPct: null });
      expect(bySlug['upcoming-sale']).toMatchObject({ priceP: 1000, compareAtP: null });
      expect(bySlug.was).toMatchObject({ priceP: 1000, compareAtP: 1250, discountPct: 20 });
      expect(bySlug.lowcompare).toMatchObject({ priceP: 1000, compareAtP: null });
      expect(bySlug['sale-nocompare']).toMatchObject({
        priceP: 750,
        compareAtP: 1000,
        discountPct: 25,
      });
      // price sort uses the same effective price
      const asc = await get('/v1/public/products?sort=price_asc&maxPrice=800').expect(200);
      expect(slugs(asc)).toEqual(['sale-nocompare', 'sale']);
    });

    it('sets badges, image and counters', async () => {
      await product({
        slug: 'fresh',
        title: 'Fresh',
        cat: 'phones',
        publishedAt: new Date(Date.now() - DAY),
        image: true,
        rating: 4.25,
        sold: 7,
      });
      await product({ slug: 'gone', title: 'Gone', cat: 'phones', stocks: [0, 0] });
      await product({ slug: 'pre', title: 'Pre', cat: 'phones', preorder: true, stocks: [0] });
      await product({ slug: 'soon', title: 'Soon', cat: 'phones', upcoming: true, stocks: [0] });
      await product({ slug: 'one-left', title: 'One', cat: 'phones', stocks: [0, 3] });
      const res = await get('/v1/public/products?sort=newest').expect(200);
      const by = Object.fromEntries(res.body.items.map((i: { slug: string }) => [i.slug, i]));
      expect(by.fresh.badges).toEqual({
        isNew: true,
        isPreorder: false,
        isUpcoming: false,
        outOfStock: false,
      });
      expect(by.fresh.image).toMatchObject({ width: 800, height: 600 });
      expect(by.fresh.image.url1200).toContain('/rs:fit:1200:0/');
      expect(by.fresh.image.url640).toContain('.webp');
      expect(by.fresh).toMatchObject({ ratingAvg: 4.25, soldCount: 7 });
      expect(by.gone.badges).toMatchObject({ isNew: false, outOfStock: true });
      expect(by.gone.image).toBeNull();
      expect(by.pre.badges).toMatchObject({ isPreorder: true, outOfStock: false });
      expect(by.soon.badges).toMatchObject({ isUpcoming: true, outOfStock: false });
      expect(by['one-left'].badges.outOfStock).toBe(false);
    });

    it('skips products without an active variant', async () => {
      const p = await product({ slug: 'novar', title: 'No variant', cat: 'phones' });
      await prisma.variant.updateMany({ where: { productId: p.id }, data: { isActive: false } });
      expect(slugs(await get('/v1/public/products').expect(200))).toEqual([]);
      await get('/v1/public/products/novar').expect(404);
    });

    it('returns cards in the requested order and drops non-public ids', async () => {
      const a = await product({ slug: 'a', title: 'A', cat: 'phones' });
      const b = await product({ slug: 'b', title: 'B', cat: 'phones' });
      const d = await product({ slug: 'd', title: 'D', cat: 'phones', status: 'draft' });
      const ids = [b.id, d.id, randomUUID(), a.id, b.id].join(',');
      const res = await get(`/v1/public/products/cards?ids=${ids}`).expect(200);
      expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(['b', 'a', 'b']);
      await get('/v1/public/products/cards?ids=nope').expect(400);
      const many = Array.from({ length: 31 }, () => randomUUID()).join(',');
      await get(`/v1/public/products/cards?ids=${many}`).expect(400);
    });
  });

  describe('flash prices', () => {
    beforeEach(async () => {
      await prisma.flashSale.deleteMany();
      await cat('phones');
    });

    /** Puts the product's variant(s) into a flash sale with the given window and stock. */
    async function flash(
      slug: string,
      flashPriceP: number,
      o: {
        startsAt?: Date;
        endsAt?: Date;
        isActive?: boolean;
        qtyLimit?: number;
        qtySold?: number;
        variant?: number;
      } = {},
    ) {
      const variants = await prisma.variant.findMany({
        where: { product: { slug } },
        orderBy: { sort: 'asc' },
      });
      const sale = await prisma.flashSale.create({
        data: {
          nameEn: `Flash ${slug}`,
          startsAt: o.startsAt ?? new Date(Date.now() - DAY),
          endsAt: o.endsAt ?? new Date(Date.now() + DAY),
          isActive: o.isActive ?? true,
          items: {
            create: {
              variantId: variants[o.variant ?? 0]?.id ?? '',
              flashPriceP,
              qtyLimit: o.qtyLimit ?? 5,
              qtySold: o.qtySold ?? 0,
            },
          },
        },
      });
      return sale;
    }

    it('uses a live flash price on cards, listing sort/filter and the feed discount', async () => {
      await product({ slug: 'plain', title: 'Plain', cat: 'phones', price: 900 });
      await product({ slug: 'fl', title: 'Fl', cat: 'phones', price: 1000, compareAt: 1200 });
      const sale = await flash('fl', 600);
      const res = await get('/v1/public/products').expect(200);
      const card = res.body.items.find((i: { slug: string }) => i.slug === 'fl');
      expect(card).toMatchObject({ priceP: 600, compareAtP: 1200, discountPct: 50 });
      expect(card.flashEndsAt).toBe(sale.endsAt.toISOString());
      const plain = res.body.items.find((i: { slug: string }) => i.slug === 'plain');
      expect(plain.flashEndsAt).toBeNull();
      expect(slugs(await get('/v1/public/products?sort=price_asc').expect(200))).toEqual([
        'fl',
        'plain',
      ]);
      expect(slugs(await get('/v1/public/products?maxPrice=700').expect(200))).toEqual(['fl']);
      expect((await get('/v1/public/products').expect(200)).body.facets.price).toEqual({
        min: 600,
        max: 900,
      });
      const feed = await get('/v1/public/feed?seed=1&limit=10').expect(200);
      expect(feed.body.items.find((i: { slug: string }) => i.slug === 'fl').priceP).toBe(600);
    });

    it('keeps the lower of a sale price and a flash price', async () => {
      await product({
        slug: 'both',
        title: 'Both',
        cat: 'phones',
        price: 1000,
        sale: { price: 500 },
      });
      await flash('both', 700);
      const res = await get('/v1/public/products').expect(200);
      expect(res.body.items[0]).toMatchObject({ priceP: 500, flashEndsAt: null });
      const detail = await get('/v1/public/products/both').expect(200);
      expect(detail.body.variants[0]).toMatchObject({ priceP: 500, flash: null });
    });

    it('falls back to the normal price when the flash is over, not started, sold out or inactive', async () => {
      const now = Date.now();
      await product({ slug: 'ended', title: 'E', cat: 'phones', price: 1000 });
      await product({ slug: 'future', title: 'F', cat: 'phones', price: 1000 });
      await product({ slug: 'soldout', title: 'S', cat: 'phones', price: 1000 });
      await product({ slug: 'off', title: 'O', cat: 'phones', price: 1000 });
      await flash('ended', 500, { startsAt: new Date(now - 2 * DAY), endsAt: new Date(now - DAY) });
      await flash('future', 500, {
        startsAt: new Date(now + DAY),
        endsAt: new Date(now + 2 * DAY),
      });
      await flash('soldout', 500, { qtyLimit: 3, qtySold: 3 });
      await flash('off', 500, { isActive: false });
      const res = await get('/v1/public/products').expect(200);
      for (const i of res.body.items) {
        expect(i).toMatchObject({ priceP: 1000, compareAtP: null, flashEndsAt: null });
      }
      const detail = await get('/v1/public/products/soldout').expect(200);
      expect(detail.body.variants[0].flash).toBeNull();
    });

    it('prices each variant on the detail page and the card shows the cheapest', async () => {
      await product({ slug: 'two', title: 'Two', cat: 'phones', price: 1000, stocks: [5, 5] });
      const sale = await flash('two', 400, { variant: 1, qtyLimit: 4, qtySold: 1 });
      const detail = await get('/v1/public/products/two').expect(200);
      const [v0, v1] = detail.body.variants;
      expect(v0).toMatchObject({ priceP: 1000, flash: null });
      expect(v1).toMatchObject({ priceP: 400, compareAtP: 1100, discountPct: 64 });
      expect(v1.flash).toEqual({
        endsAt: sale.endsAt.toISOString(),
        remaining: 3,
        perCustomerLimit: null,
      });
      const list = await get('/v1/public/products').expect(200);
      expect(list.body.items[0]).toMatchObject({
        priceP: 400,
        flashEndsAt: sale.endsAt.toISOString(),
      });
      const cards = await get(`/v1/public/products/cards?ids=${list.body.items[0].id}`).expect(200);
      expect(cards.body[0].priceP).toBe(400);
    });
  });

  describe('feed', () => {
    beforeEach(async () => {
      await cat('phones');
      for (let i = 0; i < 40; i++) {
        await product({
          slug: `p${String(i).padStart(2, '0')}`,
          title: `P${i}`,
          cat: 'phones',
          sold: i,
          stocks: [i % 5 === 0 ? 0 : 10],
          rating: i % 3 ? 4 : 0,
          pinned: i === 7,
        });
      }
      await product({ slug: 'draft', title: 'Draft', cat: 'phones', status: 'draft' });
    });

    async function walk(seed: number, limit: number) {
      const out: string[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 20; guard++) {
        const qs: string = `seed=${seed}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
        const res: request.Response = await get(`/v1/public/feed?${qs}`).expect(200);
        out.push(...slugs(res));
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      return out;
    }

    it('is deterministic per seed, complete and duplicate free across pages', async () => {
      const a = await walk(42, 7);
      const again = await walk(42, 7);
      const bigPages = await walk(42, 25);
      expect(a).toHaveLength(40);
      expect(new Set(a).size).toBe(40);
      expect(a).not.toContain('draft');
      expect(again).toEqual(a);
      expect(bigPages).toEqual(a);
      const other = await walk(43, 7);
      expect(other).not.toEqual(a);
      expect([...other].sort()).toEqual([...a].sort());
    });

    it('ranks out-of-stock items last when the penalty is zero', async () => {
      const { agent } = await createOwner(app);
      const current = (await agent.get('/v1/admin/settings').expect(200)).body.find(
        (s: { key: string }) => s.key === 'home_feed',
      ).value;
      await agent
        .put('/v1/admin/settings/home_feed')
        .send({ value: { ...current, outOfStockPenalty: 0 } })
        .expect(204);
      const order = await walk(5, 40);
      const outOfStock = new Set(['p00', 'p05', 'p10', 'p15', 'p20', 'p25', 'p30', 'p35']);
      expect(order.slice(-8).every((s) => outOfStock.has(s))).toBe(true);
    });

    it('rejects a bad cursor and caps limit', async () => {
      await get('/v1/public/feed?seed=1&cursor=garbage').expect(400);
      await get('/v1/public/feed?seed=1&limit=100').expect(400);
      const res = await get('/v1/public/feed?seed=1&limit=3').expect(200);
      expect(res.body.items).toHaveLength(3);
      expect(res.body.nextCursor).toEqual(expect.any(String));
    });
  });

  describe('product detail', () => {
    it('returns the full product, sanitizes html again and clamps availability', async () => {
      await cat('electronics');
      await cat('phones', 'electronics');
      await brand('acme', 'Acme');
      const ram = await attribute('electronics', 'ram', ['8 GB']);
      const p = await product({
        slug: 'phone-x',
        title: 'Phone X',
        cat: 'phones',
        brand: 'acme',
        price: 2000,
        stocks: [5, 0],
        image: true,
        html: '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
        optionIds: [ram.options['8 GB'] as string],
        preorder: true,
      });
      await prisma.product.update({
        where: { id: p.id },
        data: { preorderExpectedDate: new Date('2026-12-01'), youtubeUrl: 'https://youtu.be/abc' },
      });
      const opt = await prisma.productOption.create({
        data: {
          productId: p.id,
          position: 1,
          nameEn: 'Color',
          values: { create: [{ valueEn: 'Black', swatchHex: '#000000' }] },
        },
        include: { values: true },
      });
      const variants = await prisma.variant.findMany({
        where: { productId: p.id },
        orderBy: { sort: 'asc' },
      });
      await prisma.variant.update({
        where: { id: variants[0]?.id },
        data: { optionValue1Id: opt.values[0]?.id },
      });
      await prisma.inventory.update({
        where: { variantId: variants[0]?.id },
        data: { reserved: 9 },
      });

      const res = await get('/v1/public/products/phone-x').expect(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
      const b = res.body;
      expect(b).toMatchObject({
        id: p.id,
        titleEn: 'Phone X',
        brand: { slug: 'acme', nameEn: 'Acme' },
        isPreorder: true,
        preorderExpectedDate: '2026-12-01',
        youtubeUrl: 'https://youtu.be/abc',
      });
      expect(b.descriptionHtmlEn).not.toContain('script');
      expect(b.descriptionHtmlEn).not.toContain('onerror');
      expect(b.descriptionHtmlEn).toContain('<p>ok</p>');
      expect(b.breadcrumb.map((c: { slug: string }) => c.slug)).toEqual(['electronics', 'phones']);
      expect(b.images).toHaveLength(1);
      expect(b.images[0]).toMatchObject({ variantId: null, width: 800 });
      expect(b.options[0]).toMatchObject({
        position: 1,
        nameEn: 'Color',
        values: [{ valueEn: 'Black', swatchHex: '#000000' }],
      });
      expect(
        b.variants.map((v: { available: number; priceP: number }) => [v.available, v.priceP]),
      ).toEqual([
        [0, 2000],
        [0, 2100],
      ]);
      expect(b.variants[0].optionValue1Id).toBe(opt.values[0]?.id);
      expect(b.specs).toEqual([
        { nameEn: 'ram', nameBn: null, unit: null, valueEn: '8 GB', valueBn: null },
      ]);
      expect(b.badges.outOfStock).toBe(false); // pre-order is never "out of stock"
      expect(new Date(b.updatedAt).toString()).not.toBe('Invalid Date');
      await get('/v1/public/products/missing').expect(404);
    });

    it('lists similar products: same category first, then siblings, never itself', async () => {
      await cat('electronics');
      await cat('phones', 'electronics');
      await cat('tablets', 'electronics');
      await cat('fashion');
      await product({ slug: 'self', title: 'Self', cat: 'phones' });
      await product({ slug: 'same1', title: 'S1', cat: 'phones', sold: 1 });
      await product({ slug: 'same2', title: 'S2', cat: 'phones', sold: 9 });
      await product({ slug: 'sib', title: 'Sib', cat: 'tablets', sold: 100 });
      await product({ slug: 'far', title: 'Far', cat: 'fashion', sold: 100 });
      await product({ slug: 'draft', title: 'D', cat: 'phones', status: 'draft' });
      const res = await get('/v1/public/products/self/similar').expect(200);
      expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(['same2', 'same1', 'sib']);
      const limited = await get('/v1/public/products/self/similar?limit=1').expect(200);
      expect(limited.body).toHaveLength(1);
      expect((await get('/v1/public/products/nope/similar').expect(200)).body).toEqual([]);
    });

    it('serves a sitemap of public products and categories only', async () => {
      await cat('phones');
      await cat('off', undefined, { isActive: false });
      await product({ slug: 'a', title: 'A', cat: 'phones' });
      await product({ slug: 'd', title: 'D', cat: 'phones', status: 'draft' });
      const res = await get('/v1/public/sitemap').expect(200);
      expect(res.body.products.map((p: { slug: string }) => p.slug)).toEqual(['a']);
      expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['phones']);
      expect(new Date(res.body.products[0].updatedAt).toString()).not.toBe('Invalid Date');
    });
  });

  it('answers 503 in maintenance mode like the other public routes', async () => {
    const { agent } = await createOwner(app);
    await agent
      .put('/v1/admin/settings/maintenance_mode')
      .send({ value: { enabled: true, message: { en: 'brb', bn: 'brb' } } })
      .expect(204);
    await get('/v1/public/categories/tree').expect(503);
    await get('/v1/public/site').expect(200);
  });
});
