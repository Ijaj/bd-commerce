import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PermissionKey } from '../src/auth/permissions';
import { PrismaService } from '../src/prisma/prisma.service';
import { type Agent, createApp, createOwner, createStaffWith, resetDb } from './helpers';

const P = '/v1/admin/products';

describe('products', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Agent;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    owner = (await createOwner(app)).agent;
  });
  afterAll(() => app.close());

  async function category(parent?: { id: string; path: string; level: number }, active = true) {
    const id = randomUUID();
    return prisma.category.create({
      data: {
        id,
        parentId: parent?.id ?? null,
        level: (parent?.level ?? 0) + 1,
        path: `${parent?.path ?? '/'}${id}/`,
        nameEn: `Cat ${id.slice(0, 4)}`,
        slug: `cat-${id}`,
        isActive: active,
      },
    });
  }

  async function media() {
    return prisma.media.create({
      data: {
        storageKey: `media/2026/10/${randomUUID()}.jpg`,
        mime: 'image/jpeg',
        width: 100,
        height: 100,
        bytes: 1000,
      },
    });
  }

  const simpleVariant = (sku: string, priceP = 1000, extra: object = {}) => ({
    sku,
    priceP,
    isActive: true,
    optionValueRefs: [],
    ...extra,
  });

  async function createSimple(
    agent: Agent,
    categoryId: string,
    titleEn = 'Teddy Bear',
    sku = 'TB-1',
  ) {
    const res = await agent
      .post(P)
      .send({ titleEn, primaryCategoryId: categoryId, variants: [simpleVariant(sku, 1500)] })
      .expect(201);
    return res.body;
  }

  const matrix = {
    options: [
      {
        position: 1,
        nameEn: 'Color',
        values: [
          { valueEn: 'Red', swatchHex: '#ff0000' },
          { valueEn: 'Blue', swatchHex: '#0000ff' },
        ],
      },
      { position: 2, nameEn: 'Size', values: [{ valueEn: 'S' }, { valueEn: 'L' }] },
    ],
    variants: [
      { sku: 'M-RS', optionValueRefs: [0, 0], priceP: 1000, isActive: true },
      { sku: 'M-RL', optionValueRefs: [0, 1], priceP: 1200, isActive: true },
      { sku: 'M-BS', optionValueRefs: [1, 0], priceP: 1000, isActive: true },
      { sku: 'M-BL', optionValueRefs: [1, 1], priceP: 1200, isActive: true },
    ],
  };

  it('creates a simple product with slug, sanitized html and one zero-stock variant', async () => {
    const cat = await category();
    const body = {
      titleEn: 'Teddy Bear',
      titleBn: 'টেডি বিয়ার',
      primaryCategoryId: cat.id,
      descriptionHtmlEn: '<p>Soft</p><script>alert(1)</script><img src=x onerror=alert(1)>',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      variants: [simpleVariant('TB-1', 1500, { costP: 900 })],
    };
    const res = await owner.post(P).send(body).expect(201);
    expect(res.body).toMatchObject({
      slug: 'teddy-bear',
      status: 'draft',
      hasVariants: false,
      primaryCategoryId: cat.id,
      descriptionHtmlEn: '<p>Soft</p>',
    });
    expect(res.body.categories).toEqual([expect.objectContaining({ id: cat.id, isPrimary: true })]);
    expect(res.body.variants).toHaveLength(1);
    expect(res.body.variants[0]).toMatchObject({
      sku: 'TB-1',
      priceP: 1500,
      costP: 900,
      onHand: 0,
      available: 0,
    });
    expect(await prisma.stockMovement.count()).toBe(0);
    expect(await prisma.inventory.count()).toBe(1);
    // slug stays unique
    const again = await owner
      .post(P)
      .send({ titleEn: 'Teddy Bear', primaryCategoryId: cat.id, variants: [simpleVariant('TB-9')] })
      .expect(201);
    expect(again.body.slug).toBe('teddy-bear-2');
  });

  it('creates a default blank variant when none is given', async () => {
    const cat = await category();
    const res = await owner
      .post(P)
      .send({ titleEn: 'Bare', primaryCategoryId: cat.id })
      .expect(201);
    expect(res.body.variants).toHaveLength(1);
    expect(res.body.variants[0].priceP).toBe(0);
  });

  it('validates product fields', async () => {
    const cat = await category();
    const make = (extra: object) =>
      owner.post(P).send({ titleEn: 'X', primaryCategoryId: cat.id, ...extra });
    await make({ youtubeUrl: 'https://vimeo.com/123' }).expect(400);
    await make({ advancePercent: 0 }).expect(400);
    await make({ advancePercent: 101 }).expect(400);
    await make({ primaryCategoryId: randomUUID() }).expect(400);
    await make({ brandId: randomUUID() }).expect(400);
    await make({ slug: 'Bad Slug!' }).expect(400);
    await make({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).expect(201);
    await make({ youtubeUrl: 'https://youtube.com/shorts/abcDEF12345' }).expect(201);
  });

  it('updates fields, categories and sanitizes html on patch', async () => {
    const root = await category();
    const child = await category(root);
    const product = await createSimple(owner, root.id);
    const brand = await prisma.brand.create({ data: { nameEn: 'B', slug: 'b' } });
    const res = await owner
      .patch(`${P}/${product.id}`)
      .send({
        titleEn: 'Teddy Bear XL',
        brandId: brand.id,
        primaryCategoryId: child.id,
        categoryIds: [root.id],
        descriptionHtmlBn:
          '<b onclick="x()">বোল্ড</b><iframe src="https://evil.com/embed/1"></iframe>',
        isPreorder: true,
        preorderExpectedDate: '2026-12-01',
        advancePercent: 30,
        slug: 'my-bear',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      titleEn: 'Teddy Bear XL',
      slug: 'my-bear',
      brandId: brand.id,
      brand: { id: brand.id, nameEn: 'B' },
      primaryCategoryId: child.id,
      descriptionHtmlBn: '<b>বোল্ড</b>',
      isPreorder: true,
      preorderExpectedDate: '2026-12-01',
      advancePercent: 30,
    });
    expect(res.body.categories.map((c: { id: string }) => c.id).sort()).toEqual(
      [root.id, child.id].sort(),
    );
    expect(res.body.categories[0].isPrimary).toBe(true);
    const other = await createSimple(owner, root.id, 'Other', 'O-1');
    await owner.patch(`${P}/${other.id}`).send({ slug: 'my-bear' }).expect(409);
    await owner.patch(`${P}/${randomUUID()}`).send({ titleEn: 'x' }).expect(404);
  });

  it('builds a 2x2 variant matrix and reconciles later edits', async () => {
    const cat = await category();
    const product = await createSimple(owner, cat.id);
    const res = await owner.put(`${P}/${product.id}/variants`).send(matrix).expect(200);
    expect(res.body.hasVariants).toBe(true);
    expect(res.body.options).toHaveLength(2);
    expect(res.body.options[0].values.map((v: { valueEn: string }) => v.valueEn)).toEqual([
      'Red',
      'Blue',
    ]);
    expect(res.body.variants).toHaveLength(4);
    expect(
      res.body.variants.every((v: { optionValueIds: unknown[] }) =>
        v.optionValueIds.every(Boolean),
      ),
    ).toBe(true);
    // the original default variant had no stock history, so it was deleted
    expect(await prisma.variant.count({ where: { sku: 'TB-1' } })).toBe(0);
    expect(await prisma.inventory.count()).toBe(4);
    expect(await prisma.stockMovement.count()).toBe(0);

    // second pass: keep ids, refer by value id, add a Green colour, drop the Blue/L variant
    const [red, blue] = res.body.options[0].values;
    const [s, l] = res.body.options[1].values;
    const byId = (sku: string) => res.body.variants.find((v: { sku: string }) => v.sku === sku);
    const next = {
      options: [
        {
          position: 1,
          nameEn: 'Colour',
          values: [
            { id: red.id, valueEn: 'Red' },
            { id: blue.id, valueEn: 'Blue' },
            { valueEn: 'Green' },
          ],
        },
        {
          position: 2,
          nameEn: 'Size',
          values: [
            { id: s.id, valueEn: 'S' },
            { id: l.id, valueEn: 'L' },
          ],
        },
      ],
      variants: [
        {
          id: byId('M-RS').id,
          sku: 'M-RS',
          optionValueRefs: [red.id, s.id],
          priceP: 1000,
          isActive: true,
        },
        {
          id: byId('M-RL').id,
          sku: 'M-RL',
          optionValueRefs: [red.id, l.id],
          priceP: 1200,
          isActive: true,
        },
        {
          id: byId('M-BS').id,
          sku: 'M-BS',
          optionValueRefs: [blue.id, s.id],
          priceP: 1000,
          isActive: false,
        },
        { sku: 'M-GS', optionValueRefs: [2, s.id], priceP: 1100, isActive: true },
      ],
    };
    const res2 = await owner.put(`${P}/${product.id}/variants`).send(next).expect(200);
    expect(res2.body.options[0].nameEn).toBe('Colour');
    expect(res2.body.options[0].values).toHaveLength(3);
    expect(res2.body.variants.map((v: { sku: string }) => v.sku)).toEqual([
      'M-RS',
      'M-RL',
      'M-BS',
      'M-GS',
    ]);
    expect(res2.body.variants[2].isActive).toBe(false);
    expect(res2.body.variants[0].id).toBe(byId('M-RS').id);
    expect(await prisma.variant.count({ where: { sku: 'M-BL' } })).toBe(0);
  });

  it('rejects bad matrices', async () => {
    const cat = await category();
    const product = await createSimple(owner, cat.id);
    const put = (body: object) => owner.put(`${P}/${product.id}/variants`).send(body);
    // duplicate combination
    await put({
      options: matrix.options,
      variants: [
        { sku: 'A', optionValueRefs: [0, 0], priceP: 1, isActive: true },
        { sku: 'B', optionValueRefs: [0, 0], priceP: 1, isActive: true },
      ],
    }).expect(400);
    // wrong number of refs
    await put({
      options: matrix.options,
      variants: [{ sku: 'A', optionValueRefs: [0], priceP: 1, isActive: true }],
    }).expect(400);
    // out-of-range index
    await put({
      options: matrix.options,
      variants: [{ sku: 'A', optionValueRefs: [0, 5], priceP: 1, isActive: true }],
    }).expect(400);
    // duplicate option value (case-insensitive)
    await put({
      options: [{ position: 1, nameEn: 'C', values: [{ valueEn: 'Red' }, { valueEn: 'red' }] }],
      variants: [{ sku: 'A', optionValueRefs: [0], priceP: 1, isActive: true }],
    }).expect(400);
    // simple product needs exactly one variant
    await put({ options: [], variants: [simpleVariant('A'), simpleVariant('B')] }).expect(400);
    // duplicate sku in request
    await put({
      options: matrix.options,
      variants: [
        { sku: 'A', optionValueRefs: [0, 0], priceP: 1, isActive: true },
        { sku: 'A', optionValueRefs: [0, 1], priceP: 1, isActive: true },
      ],
    }).expect(409);
    // price rules
    await put({ options: [], variants: [simpleVariant('A', 1000, { salePriceP: 1000 })] }).expect(
      400,
    );
    await put({ options: [], variants: [simpleVariant('A', 1000, { compareAtP: 900 })] }).expect(
      400,
    );
    await put({
      options: [],
      variants: [
        simpleVariant('A', 1000, {
          salePriceP: 800,
          saleStartsAt: '2026-11-02T00:00:00.000Z',
          saleEndsAt: '2026-11-01T00:00:00.000Z',
        }),
      ],
    }).expect(400);
    await put({
      options: [],
      variants: [
        simpleVariant('A', 1000, {
          salePriceP: 800,
          compareAtP: 1200,
          saleStartsAt: '2026-11-01T00:00:00.000Z',
          saleEndsAt: '2026-11-02T00:00:00.000Z',
        }),
      ],
    }).expect(200);
  });

  it('returns 409 naming a SKU used by another product', async () => {
    const cat = await category();
    await createSimple(owner, cat.id, 'One', 'DUP-1');
    const two = await createSimple(owner, cat.id, 'Two', 'TWO-1');
    const res = await owner
      .put(`${P}/${two.id}/variants`)
      .send({ options: [], variants: [simpleVariant('DUP-1')] })
      .expect(409);
    expect(res.body.message).toContain('DUP-1');
    const create = await owner
      .post(P)
      .send({ titleEn: 'Three', primaryCategoryId: cat.id, variants: [simpleVariant('DUP-1')] })
      .expect(409);
    expect(create.body.message).toContain('DUP-1');
    // nothing half-created
    expect(await prisma.product.count()).toBe(2);
  });

  it('lets variants swap skus in one request', async () => {
    const cat = await category();
    const product = await createSimple(owner, cat.id);
    const res = await owner.put(`${P}/${product.id}/variants`).send(matrix).expect(200);
    const [a, b, c, d] = res.body.variants;
    const swapped = {
      options: res.body.options.map(
        (o: { position: number; nameEn: string; values: { id: string; valueEn: string }[] }) => ({
          position: o.position,
          nameEn: o.nameEn,
          values: o.values.map((v) => ({ id: v.id, valueEn: v.valueEn })),
        }),
      ),
      variants: [
        {
          id: a.id,
          sku: b.sku,
          optionValueRefs: a.optionValueIds,
          priceP: a.priceP,
          isActive: true,
        },
        {
          id: b.id,
          sku: a.sku,
          optionValueRefs: b.optionValueIds,
          priceP: b.priceP,
          isActive: true,
        },
        {
          id: c.id,
          sku: c.sku,
          optionValueRefs: c.optionValueIds,
          priceP: c.priceP,
          isActive: true,
        },
        {
          id: d.id,
          sku: d.sku,
          optionValueRefs: d.optionValueIds,
          priceP: d.priceP,
          isActive: true,
        },
      ],
    };
    const out = await owner.put(`${P}/${product.id}/variants`).send(swapped).expect(200);
    expect(out.body.variants[0].sku).toBe('M-RL');
    expect(out.body.variants[1].sku).toBe('M-RS');
  });

  it('retires a variant with stock history instead of deleting it', async () => {
    const cat = await category();
    const product = await createSimple(owner, cat.id);
    const res = await owner.put(`${P}/${product.id}/variants`).send(matrix).expect(200);
    const doomed = res.body.variants[3];
    await prisma.inventory.update({ where: { variantId: doomed.id }, data: { onHand: 5 } });
    await prisma.stockMovement.create({
      data: { variantId: doomed.id, qtyDelta: 5, reason: 'adjust' },
    });
    const keep = res.body.variants
      .slice(0, 3)
      .map((v: { id: string; sku: string; optionValueIds: string[]; priceP: number }) => ({
        id: v.id,
        sku: v.sku,
        optionValueRefs: v.optionValueIds,
        priceP: v.priceP,
        isActive: true,
      }));
    const opts = res.body.options.map(
      (o: { position: number; nameEn: string; values: { id: string; valueEn: string }[] }) => ({
        position: o.position,
        nameEn: o.nameEn,
        values: o.values.map((v) => ({ id: v.id, valueEn: v.valueEn })),
      }),
    );
    const out = await owner
      .put(`${P}/${product.id}/variants`)
      .send({ options: opts, variants: keep })
      .expect(200);
    const retired = out.body.variants.find((v: { id: string }) => v.id === doomed.id);
    expect(retired).toMatchObject({ isActive: false, onHand: 5 });
    // the combination can be reused by a new variant
    await owner
      .put(`${P}/${product.id}/variants`)
      .send({
        options: opts,
        variants: [
          ...keep,
          {
            sku: 'M-BL2',
            optionValueRefs: [opts[0].values[1].id, opts[1].values[1].id],
            priceP: 5,
            isActive: true,
          },
        ],
      })
      .expect(200);
  });

  describe('permissions', () => {
    const base: PermissionKey[] = ['products.view', 'products.create', 'products.edit'];

    it('needs products.edit_price to change prices, products.view_cost for cost', async () => {
      const cat = await category();
      const product = await createSimple(owner, cat.id);
      const staff = await createStaffWith(app, base);
      const current = product.variants[0];
      const same = {
        id: current.id,
        sku: current.sku,
        priceP: current.priceP,
        isActive: true,
        optionValueRefs: [],
      };
      // unchanged price, new barcode: fine
      await staff.agent
        .put(`${P}/${product.id}/variants`)
        .send({ options: [], variants: [{ ...same, barcode: '123' }] })
        .expect(200);
      // changed price: 403
      const denied = await staff.agent
        .put(`${P}/${product.id}/variants`)
        .send({ options: [], variants: [{ ...same, priceP: 2000 }] })
        .expect(403);
      expect(denied.body.message).toContain('products.edit_price');
      expect((await prisma.variant.findUniqueOrThrow({ where: { id: current.id } })).priceP).toBe(
        1500,
      );
      // cost change: 403 without view_cost
      await staff.agent
        .put(`${P}/${product.id}/variants`)
        .send({ options: [], variants: [{ ...same, costP: 100 }] })
        .expect(403);
      // allowed with the permissions
      const rich = await createStaffWith(app, [
        ...base,
        'products.edit_price',
        'products.view_cost',
      ]);
      const ok = await rich.agent
        .put(`${P}/${product.id}/variants`)
        .send({ options: [], variants: [{ ...same, priceP: 2000, costP: 700 }] })
        .expect(200);
      expect(ok.body.variants[0]).toMatchObject({ priceP: 2000, costP: 700 });
    });

    it('creating a priced variant needs edit_price, a blank draft does not', async () => {
      const cat = await category();
      const staff = await createStaffWith(app, base);
      await staff.agent.post(P).send({ titleEn: 'A', primaryCategoryId: cat.id }).expect(201);
      await staff.agent
        .post(P)
        .send({ titleEn: 'B', primaryCategoryId: cat.id, variants: [simpleVariant('B-1', 500)] })
        .expect(403);
      expect(await prisma.product.count({ where: { titleEn: 'B' } })).toBe(0);
    });

    it('hides cost price without products.view_cost and keeps it on save', async () => {
      const cat = await category();
      const res = await owner
        .post(P)
        .send({
          titleEn: 'Costly',
          primaryCategoryId: cat.id,
          variants: [simpleVariant('C-1', 1000, { costP: 600 })],
        })
        .expect(201);
      const id = res.body.id;
      expect(res.body.variants[0].costP).toBe(600);

      const staff = await createStaffWith(app, ['products.view', 'products.edit']);
      const view = await staff.agent.get(`${P}/${id}`).expect(200);
      expect(view.body.variants[0]).not.toHaveProperty('costP');
      // saving without costP keeps the stored cost
      await staff.agent
        .put(`${P}/${id}/variants`)
        .send({
          options: [],
          variants: [{ id: view.body.variants[0].id, ...simpleVariant('C-1', 1000), barcode: 'x' }],
        })
        .expect(200);
      expect((await owner.get(`${P}/${id}`)).body.variants[0].costP).toBe(600);
    });

    it('guards every route', async () => {
      const cat = await category();
      const product = await createSimple(owner, cat.id);
      const viewer = await createStaffWith(app, ['products.view']);
      await viewer.agent.get(P).expect(200);
      await viewer.agent.post(P).send({ titleEn: 'x', primaryCategoryId: cat.id }).expect(403);
      await viewer.agent.patch(`${P}/${product.id}`).send({ titleEn: 'y' }).expect(403);
      await viewer.agent.post(`${P}/${product.id}/publish`).expect(403);
      await viewer.agent.post(`${P}/${product.id}/archive`).expect(403);
      await viewer.agent.post(`${P}/${product.id}/duplicate`).expect(403);
      await viewer.agent.delete(`${P}/${product.id}`).expect(403);
    });
  });

  describe('list', () => {
    it('paginates, sorts and aggregates', async () => {
      const cat = await category();
      const brand = await prisma.brand.create({ data: { nameEn: 'Brandy', slug: 'brandy' } });
      for (const [i, name] of ['Alpha', 'Bravo', 'Charlie'].entries()) {
        await owner
          .post(P)
          .send({
            titleEn: name,
            primaryCategoryId: cat.id,
            brandId: i === 0 ? brand.id : undefined,
            variants: [simpleVariant(`${name}-1`, 1000 * (3 - i))],
          })
          .expect(201);
      }
      const first = await owner.get(`${P}?pageSize=2`).expect(200);
      expect(first.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(first.body.items.map((i: { titleEn: string }) => i.titleEn)).toEqual([
        'Charlie',
        'Bravo',
      ]);
      const second = await owner.get(`${P}?pageSize=2&page=2`).expect(200);
      expect(second.body.items).toHaveLength(1);

      const byTitle = await owner.get(`${P}?sort=title`).expect(200);
      expect(byTitle.body.items.map((i: { titleEn: string }) => i.titleEn)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);
      const byPrice = await owner.get(`${P}?sort=price`).expect(200);
      expect(byPrice.body.items.map((i: { titleEn: string }) => i.titleEn)).toEqual([
        'Charlie',
        'Bravo',
        'Alpha',
      ]);
      await owner.get(`${P}?pageSize=101`).expect(400);

      const alpha = byTitle.body.items[0];
      expect(alpha).toMatchObject({
        brand: { id: brand.id, nameEn: 'Brandy' },
        primaryCategory: { id: cat.id },
        variantCount: 1,
        minP: 3000,
        maxP: 3000,
        totalAvailable: 0,
        thumbnailUrl: null,
        status: 'draft',
      });
      expect((await owner.get(`${P}?brandId=${brand.id}`)).body.total).toBe(1);
    });

    it('filters by q, status, category descendants, flags and low stock', async () => {
      const root = await category();
      const child = await category(root);
      const grandchild = await category(child);
      const sibling = await category();
      const media1 = await media();

      const bear = await createSimple(owner, grandchild.id, 'Teddy Bear', 'BEAR-001');
      const car = await createSimple(owner, sibling.id, 'Race Car', 'CAR-001');
      await owner
        .patch(`${P}/${car.id}`)
        .send({ titleBn: 'রেস কার', isUpcoming: true, fulfillment: 'dropship' })
        .expect(200);
      await owner
        .patch(`${P}/${bear.id}`)
        .send({ isPreorder: true, categoryIds: [sibling.id] })
        .expect(200);
      await owner
        .put(`${P}/${bear.id}/images`)
        .send({ images: [{ mediaId: media1.id }] })
        .expect(200);

      const ids = async (qs: string) =>
        (await owner.get(`${P}?${qs}`).expect(200)).body.items
          .map((i: { id: string }) => i.id)
          .sort();

      expect(await ids(`categoryId=${root.id}`)).toEqual([bear.id]);
      expect(await ids(`categoryId=${child.id}`)).toEqual([bear.id]);
      // bear is also in sibling as a secondary category
      expect(await ids(`categoryId=${sibling.id}`)).toEqual([bear.id, car.id].sort());
      expect(await ids('q=teddy')).toEqual([bear.id]);
      expect(await ids('q=BEAR-0')).toEqual([bear.id]);
      expect(await ids(`q=${encodeURIComponent('রেস')}`)).toEqual([car.id]);
      expect(await ids('q=race-car')).toEqual([car.id]);
      expect(await ids('q=%25')).toEqual([]);
      expect(await ids('isUpcoming=true')).toEqual([car.id]);
      expect(await ids('isPreorder=true')).toEqual([bear.id]);
      expect(await ids('fulfillment=dropship')).toEqual([car.id]);
      expect(await ids('status=active')).toEqual([]);
      expect(await ids('status=draft')).toEqual([bear.id, car.id].sort());

      const list = await owner.get(`${P}?q=teddy`).expect(200);
      expect(list.body.items[0].thumbnailUrl).toContain('/rs:fill:160:160/');

      // low stock: available <= threshold
      const bearVariant = bear.variants[0].id;
      await prisma.inventory.update({
        where: { variantId: bearVariant },
        data: { onHand: 5, reserved: 1, lowStockThreshold: 4 },
      });
      expect(await ids('lowStock=true')).toEqual([bear.id]);
      await prisma.inventory.update({ where: { variantId: bearVariant }, data: { onHand: 20 } });
      expect(await ids('lowStock=true')).toEqual([]);
      const row = (await owner.get(`${P}?q=teddy`)).body.items[0];
      expect(row.totalAvailable).toBe(19);
    });
  });

  describe('attributes', () => {
    async function setup() {
      const root = await category();
      const child = await category(root);
      const color = await prisma.categoryAttribute.create({
        data: {
          categoryId: root.id,
          key: 'color',
          nameEn: 'Colour',
          type: 'select',
          isRequired: true,
          options: { create: [{ valueEn: 'Red' }, { valueEn: 'Blue' }] },
        },
        include: { options: true },
      });
      const tags = await prisma.categoryAttribute.create({
        data: {
          categoryId: child.id,
          key: 'tags',
          nameEn: 'Tags',
          type: 'multiselect',
          options: { create: [{ valueEn: 'A' }, { valueEn: 'B' }] },
        },
        include: { options: true },
      });
      const age = await prisma.categoryAttribute.create({
        data: { categoryId: root.id, key: 'age', nameEn: 'Age', type: 'number' },
      });
      const note = await prisma.categoryAttribute.create({
        data: { categoryId: root.id, key: 'note', nameEn: 'Note', type: 'text' },
      });
      const gift = await prisma.categoryAttribute.create({
        data: { categoryId: root.id, key: 'gift', nameEn: 'Gift', type: 'boolean' },
      });
      const foreign = await prisma.categoryAttribute.create({
        data: { categoryId: (await category()).id, key: 'other', nameEn: 'Other', type: 'text' },
      });
      return { root, child, color, tags, age, note, gift, foreign };
    }

    it('validates types, options and inheritance, and stores values', async () => {
      const { root, child, color, tags, age, note, gift, foreign } = await setup();
      const make = (attributes: object[]) =>
        owner.post(P).send({
          titleEn: 'Attr',
          primaryCategoryId: child.id,
          attributes,
          variants: [simpleVariant(`A-${randomUUID().slice(0, 6)}`)],
        });
      const red = color.options[0]?.id as string;
      const [ta, tb] = tags.options.map((o) => o.id);

      await make([{ attributeId: foreign.id, valueText: 'x' }]).expect(400);
      await make([{ attributeId: age.id, valueText: 'ten' }]).expect(400);
      await make([{ attributeId: note.id, valueNumber: 3 }]).expect(400);
      await make([{ attributeId: gift.id, valueText: 'yes' }]).expect(400);
      await make([{ attributeId: color.id, optionIds: [randomUUID()] }]).expect(400);
      await make([{ attributeId: color.id, optionIds: [ta] }]).expect(400);
      await make([{ attributeId: color.id, optionIds: color.options.map((o) => o.id) }]).expect(
        400,
      );
      await make([{ attributeId: tags.id, optionIds: [] }]).expect(400);
      await make([{ attributeId: note.id, valueText: '   ' }]).expect(400);
      await make([
        { attributeId: age.id, valueNumber: 1 },
        { attributeId: age.id, valueNumber: 2 },
      ]).expect(400);
      expect(await prisma.product.count()).toBe(0);

      const res = await make([
        { attributeId: color.id, optionIds: [red] },
        { attributeId: tags.id, optionIds: [ta, tb] },
        { attributeId: age.id, valueNumber: 4.5 },
        { attributeId: note.id, valueText: 'hello' },
        { attributeId: gift.id, valueBool: false },
      ]).expect(201);
      const byAttr = Object.fromEntries(
        res.body.attributeValues.map((v: { attributeId: string }) => [v.attributeId, v]),
      );
      expect(byAttr[color.id].optionIds).toEqual([red]);
      expect(byAttr[tags.id].optionIds.sort()).toEqual([ta, tb].sort());
      expect(byAttr[age.id].valueNumber).toBe(4.5);
      expect(byAttr[note.id].valueText).toBe('hello');
      expect(byAttr[gift.id].valueBool).toBe(false);

      // patch replaces; moving to a category that lacks 'tags' drops its values
      const patched = await owner
        .patch(`${P}/${res.body.id}`)
        .send({ primaryCategoryId: root.id, categoryIds: [] })
        .expect(200);
      expect(
        patched.body.attributeValues.map((v: { attributeId: string }) => v.attributeId),
      ).not.toContain(tags.id);
      expect(patched.body.attributeValues).toHaveLength(4);
      const replaced = await owner
        .patch(`${P}/${res.body.id}`)
        .send({ attributes: [{ attributeId: color.id, optionIds: [color.options[1]?.id] }] })
        .expect(200);
      expect(replaced.body.attributeValues).toHaveLength(1);
    });

    it('enforces required attributes only when publishing', async () => {
      const { child, color } = await setup();
      const res = await owner
        .post(P)
        .send({
          titleEn: 'Needs colour',
          primaryCategoryId: child.id,
          variants: [simpleVariant('N-1')],
        })
        .expect(201);
      const denied = await owner.post(`${P}/${res.body.id}/publish`).expect(400);
      expect(denied.body.problems).toEqual(['Required attribute "Colour" is missing']);
      await owner
        .patch(`${P}/${res.body.id}`)
        .send({ attributes: [{ attributeId: color.id, optionIds: [color.options[0]?.id] }] })
        .expect(200);
      await owner.post(`${P}/${res.body.id}/publish`).expect(200);
    });
  });

  describe('status', () => {
    it('validates before publishing, then publishes, unpublishes and archives', async () => {
      const cat = await category();
      const inactive = await category(undefined, false);
      const blank = await owner
        .post(P)
        .send({ titleEn: 'Blank', primaryCategoryId: cat.id })
        .expect(201);
      const denied = await owner.post(`${P}/${blank.body.id}/publish`).expect(400);
      expect(denied.body.problems[0]).toContain('active variant');

      const hidden = await createSimple(owner, inactive.id, 'Hidden', 'H-1');
      const noCat = await owner.post(`${P}/${hidden.id}/publish`).expect(400);
      expect(noCat.body.problems).toEqual(['Primary category is not active']);

      const product = await createSimple(owner, cat.id);
      expect(product.publishedAt).toBeNull();
      const live = await owner.post(`${P}/${product.id}/publish`).expect(200);
      expect(live.body.status).toBe('active');
      expect(live.body.publishedAt).not.toBeNull();
      const stamp = live.body.publishedAt;

      const draft = await owner.post(`${P}/${product.id}/unpublish`).expect(200);
      expect(draft.body.status).toBe('draft');
      const again = await owner.post(`${P}/${product.id}/publish`).expect(200);
      expect(again.body.publishedAt).toBe(stamp);

      const archived = await owner.post(`${P}/${product.id}/archive`).expect(200);
      expect(archived.body.status).toBe('archived');
      expect(archived.body.archivedAt).not.toBeNull();
      expect((await owner.get(`${P}?status=archived`)).body.total).toBe(1);
      await owner.post(`${P}/${randomUUID()}/publish`).expect(404);
    });

    it('does not count inactive variants towards publishing', async () => {
      const cat = await category();
      const product = await createSimple(owner, cat.id);
      await owner
        .put(`${P}/${product.id}/variants`)
        .send({
          options: [],
          variants: [
            { id: product.variants[0].id, ...simpleVariant('TB-1', 1500), isActive: false },
          ],
        })
        .expect(200);
      await owner.post(`${P}/${product.id}/publish`).expect(400);
    });

    it('deletes a product with its variants, inventory and images', async () => {
      const cat = await category();
      const product = await createSimple(owner, cat.id);
      await owner.delete(`${P}/${product.id}`).expect(204);
      expect(await prisma.product.count()).toBe(0);
      expect(await prisma.variant.count()).toBe(0);
      expect(await prisma.inventory.count()).toBe(0);
      await owner.get(`${P}/${product.id}`).expect(404);
      await owner.delete(`${P}/${product.id}`).expect(404);
    });
  });

  describe('images', () => {
    it('stores an ordered image list with variant links and urls', async () => {
      const cat = await category();
      const product = await createSimple(owner, cat.id);
      const m1 = await media();
      const m2 = await media();
      const variantId = product.variants[0].id;
      const res = await owner
        .put(`${P}/${product.id}/images`)
        .send({
          images: [
            { mediaId: m2.id, alt: 'front' },
            { mediaId: m1.id, variantId },
          ],
        })
        .expect(200);
      expect(res.body.images.map((i: { mediaId: string }) => i.mediaId)).toEqual([m2.id, m1.id]);
      expect(res.body.images[0]).toMatchObject({ variantId: null, alt: 'front', sort: 0 });
      expect(res.body.images[1].variantId).toBe(variantId);
      expect(res.body.images[0].url).toContain('/rs:fit:600:600/');
      expect(res.body.images[0].thumbUrl).toContain('/rs:fill:160:160/');

      await owner
        .put(`${P}/${product.id}/images`)
        .send({ images: [{ mediaId: randomUUID() }] })
        .expect(400);
      await owner
        .put(`${P}/${product.id}/images`)
        .send({ images: [{ mediaId: m1.id, variantId: randomUUID() }] })
        .expect(400);
      const cleared = await owner.put(`${P}/${product.id}/images`).send({ images: [] }).expect(200);
      expect(cleared.body.images).toEqual([]);
    });
  });

  describe('duplicate', () => {
    it('copies a product as a draft with new slug and SKUs, without stock', async () => {
      const cat = await category();
      const m = await media();
      const product = await createSimple(owner, cat.id);
      const built = await owner.put(`${P}/${product.id}/variants`).send(matrix).expect(200);
      await owner
        .put(`${P}/${product.id}/images`)
        .send({
          images: [{ mediaId: m.id }, { mediaId: m.id, variantId: built.body.variants[0].id }],
        })
        .expect(200);
      await prisma.inventory.update({
        where: { variantId: built.body.variants[0].id },
        data: { onHand: 9, lowStockThreshold: 3 },
      });
      await owner.post(`${P}/${product.id}/publish`).expect(200);

      const copy = await owner.post(`${P}/${product.id}/duplicate`).expect(201);
      expect(copy.body).toMatchObject({
        status: 'draft',
        publishedAt: null,
        slug: 'teddy-bear-copy',
        hasVariants: true,
      });
      expect(copy.body.id).not.toBe(product.id);
      expect(copy.body.variants.map((v: { sku: string }) => v.sku)).toEqual([
        'M-RS-COPY',
        'M-RL-COPY',
        'M-BS-COPY',
        'M-BL-COPY',
      ]);
      expect(copy.body.variants[0]).toMatchObject({ onHand: 0, lowStockThreshold: 3 });
      const originalValueIds = built.body.options.flatMap((o: { values: { id: string }[] }) =>
        o.values.map((v) => v.id),
      );
      const copyValueIds = copy.body.options.flatMap((o: { values: { id: string }[] }) =>
        o.values.map((v) => v.id),
      );
      expect(copyValueIds).toHaveLength(4);
      expect(copyValueIds.some((id: string) => originalValueIds.includes(id))).toBe(false);
      expect(
        copy.body.variants[0].optionValueIds.every((id: string) => copyValueIds.includes(id)),
      ).toBe(true);
      expect(copy.body.images).toHaveLength(2);
      expect(copy.body.images[1].variantId).toBe(copy.body.variants[0].id);

      const second = await owner.post(`${P}/${product.id}/duplicate`).expect(201);
      expect(second.body.slug).toBe('teddy-bear-copy-2');
      expect(second.body.variants[0].sku).toBe('M-RS-COPY-2');
      expect(await prisma.stockMovement.count()).toBe(0);
    });
  });
});
