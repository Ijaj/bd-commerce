import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { type Agent, createApp, createOwner, createStaffWith, resetDb } from './helpers';

describe('categories and attributes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: Agent;
  let mediaId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    agent = (await createOwner(app)).agent;
    mediaId = await newMedia();
  });
  afterAll(() => app.close());

  async function newMedia() {
    const m = await prisma.media.create({
      data: {
        storageKey: `media/test/${randomUUID()}.webp`,
        mime: 'image/webp',
        width: 10,
        height: 10,
        bytes: 100,
      },
    });
    return m.id;
  }

  async function mk(nameEn: string, parentId?: string, extra: Record<string, unknown> = {}) {
    const res = await agent
      .post('/v1/admin/categories')
      .send({ nameEn, parentId, ...(parentId ? {} : { imageMediaId: mediaId }), ...extra })
      .expect(201);
    return res.body as { id: string; level: number; path: string; slug: string };
  }

  async function newProduct(primaryCategoryId: string, extraCategoryIds: string[] = []) {
    const seller = await prisma.seller.findFirstOrThrow();
    const id = randomUUID();
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        primaryCategoryId,
        titleEn: `Product ${id}`,
        slug: `p-${id}`,
        categories: {
          create: [primaryCategoryId, ...extraCategoryIds].map((categoryId) => ({ categoryId })),
        },
        variants: { create: { sku: `sku-${id}`, priceP: 1000 } },
      },
    });
    return product.id;
  }

  async function chain() {
    const l1 = await mk('One');
    const l2 = await mk('Two', l1.id);
    const l3 = await mk('Three', l2.id);
    const l4 = await mk('Four', l3.id);
    return { l1, l2, l3, l4 };
  }

  it('builds a tree up to 4 levels and rejects the 5th', async () => {
    const { l1, l2, l3, l4 } = await chain();
    expect([l1.level, l2.level, l3.level, l4.level]).toEqual([1, 2, 3, 4]);
    expect(l4.path).toBe(`/${l1.id}/${l2.id}/${l3.id}/${l4.id}/`);
    await agent.post('/v1/admin/categories').send({ nameEn: 'Five', parentId: l4.id }).expect(400);

    const list = await agent.get('/v1/admin/categories').expect(200);
    expect(list.body.map((c: { id: string }) => c.id)).toEqual([l1.id, l2.id, l3.id, l4.id]);
    expect(list.body[0]).toMatchObject({ childCount: 1, productCount: 0, parentId: null });
    expect(list.body[0].image.mediaId).toBe(mediaId);
    expect(list.body[0].image.url).toContain('/rs:fit:400:400/');
    expect(list.body[1].image).toBeNull();
  });

  it('requires an existing image for main categories', async () => {
    await agent.post('/v1/admin/categories').send({ nameEn: 'Bare' }).expect(400);
    await agent
      .post('/v1/admin/categories')
      .send({ nameEn: 'Ghost', imageMediaId: randomUUID() })
      .expect(400);
    const l1 = await mk('Main');
    await agent.patch(`/v1/admin/categories/${l1.id}`).send({ imageMediaId: null }).expect(400);
  });

  it('generates and validates unique slugs', async () => {
    const a = await mk('Baby Toys');
    const b = await mk('Baby Toys');
    const c = await mk('Baby Toys');
    expect([a.slug, b.slug, c.slug]).toEqual(['baby-toys', 'baby-toys-2', 'baby-toys-3']);
    await agent
      .post('/v1/admin/categories')
      .send({ nameEn: 'Other', slug: 'baby-toys', imageMediaId: mediaId })
      .expect(409);
    await agent
      .post('/v1/admin/categories')
      .send({ nameEn: 'Other', slug: 'Bad Slug!', imageMediaId: mediaId })
      .expect(400);
    const d = await mk('Other', undefined, { slug: 'custom-slug' });
    expect(d.slug).toBe('custom-slug');
    await agent.patch(`/v1/admin/categories/${d.id}`).send({ slug: 'baby-toys' }).expect(409);
  });

  it('moves a sub-tree and rewrites paths and levels', async () => {
    const root = await mk('Root');
    const other = await mk('Other');
    const a = await mk('A', root.id);
    const b = await mk('B', a.id);
    await agent.patch(`/v1/admin/categories/${a.id}`).send({ parentId: other.id }).expect(200);

    const list = (await agent.get('/v1/admin/categories').expect(200)).body as {
      id: string;
      path: string;
      level: number;
      parentId: string | null;
    }[];
    const byId = new Map(list.map((c) => [c.id, c]));
    expect(byId.get(a.id)).toMatchObject({
      parentId: other.id,
      level: 2,
      path: `/${other.id}/${a.id}/`,
    });
    expect(byId.get(b.id)).toMatchObject({ level: 3, path: `/${other.id}/${a.id}/${b.id}/` });

    // a main category with a child moved under a level-3 node would reach level 5
    const { l3 } = await chain();
    await agent.patch(`/v1/admin/categories/${other.id}`).send({ parentId: l3.id }).expect(400);
    // moving to the top needs an image
    await agent.patch(`/v1/admin/categories/${a.id}`).send({ parentId: null }).expect(400);
    await agent
      .patch(`/v1/admin/categories/${a.id}`)
      .send({ parentId: null, imageMediaId: mediaId })
      .expect(200);
  });

  it('rejects moving a category under itself or a descendant', async () => {
    const { l1, l2, l3 } = await chain();
    await agent.patch(`/v1/admin/categories/${l1.id}`).send({ parentId: l3.id }).expect(400);
    await agent.patch(`/v1/admin/categories/${l2.id}`).send({ parentId: l2.id }).expect(400);
  });

  it('reorders siblings', async () => {
    const a = await mk('A');
    const b = await mk('B');
    await agent
      .post('/v1/admin/categories/reorder')
      .send([
        { id: a.id, sort: 5 },
        { id: b.id, sort: 1 },
      ])
      .expect(204);
    const list = await agent.get('/v1/admin/categories').expect(200);
    expect(list.body.map((c: { id: string }) => c.id)).toEqual([b.id, a.id]);
    const child = await mk('Child', a.id);
    await agent
      .post('/v1/admin/categories/reorder')
      .send([
        { id: a.id, sort: 0 },
        { id: child.id, sort: 1 },
      ])
      .expect(400);
  });

  it('delete in move mode relocates children and products', async () => {
    const parent = await mk('Parent');
    const doomed = await mk('Doomed', parent.id);
    const child = await mk('Child', doomed.id);
    const grandchild = await mk('Grandchild', child.id);
    const target = await mk('Target');
    const p1 = await newProduct(doomed.id);
    const p2 = await newProduct(child.id, [doomed.id, target.id]);

    const preview = await agent.get(`/v1/admin/categories/${doomed.id}/delete-preview`).expect(200);
    expect(preview.body).toEqual({ subCategoryCount: 2, productCount: 2, primaryProductCount: 2 });

    await agent
      .delete(`/v1/admin/categories/${doomed.id}`)
      .send({ mode: 'move', targetId: doomed.id })
      .expect(400);
    await agent
      .delete(`/v1/admin/categories/${doomed.id}`)
      .send({ mode: 'move', targetId: grandchild.id })
      .expect(400);
    await agent.delete(`/v1/admin/categories/${doomed.id}`).send({ mode: 'move' }).expect(400);

    // child + grandchild would land at levels 3 and 4 under a level-2 target: fine
    const deep = await mk('Deep', (await mk('X', target.id)).id);
    await agent
      .delete(`/v1/admin/categories/${doomed.id}`)
      .send({ mode: 'move', targetId: deep.id })
      .expect(400);

    await agent
      .delete(`/v1/admin/categories/${doomed.id}`)
      .send({ mode: 'move', targetId: target.id })
      .expect(204);

    expect(await prisma.category.findUnique({ where: { id: doomed.id } })).toBeNull();
    const movedChild = await prisma.category.findUniqueOrThrow({ where: { id: child.id } });
    expect(movedChild).toMatchObject({ parentId: target.id, level: 2 });
    expect(movedChild.path).toBe(`/${target.id}/${child.id}/`);
    const movedGrand = await prisma.category.findUniqueOrThrow({ where: { id: grandchild.id } });
    expect(movedGrand).toMatchObject({
      level: 3,
      path: `/${target.id}/${child.id}/${grandchild.id}/`,
    });

    expect((await prisma.product.findUniqueOrThrow({ where: { id: p1 } })).primaryCategoryId).toBe(
      target.id,
    );
    const links = await prisma.productCategory.findMany({ where: { productId: p2 } });
    expect(links.map((l) => l.categoryId).sort()).toEqual([child.id, target.id].sort());
    expect(await prisma.productCategory.count({ where: { categoryId: target.id } })).toBe(2);
  });

  it('delete in cascade mode removes the sub-tree and its primary products', async () => {
    const keep = await mk('Keep');
    const root = await mk('Root');
    const child = await mk('Child', root.id);
    const inRoot = await newProduct(root.id);
    const inChild = await newProduct(child.id, [keep.id]);
    const elsewhere = await newProduct(keep.id, [child.id]);

    const preview = await agent.get(`/v1/admin/categories/${root.id}/delete-preview`).expect(200);
    expect(preview.body).toEqual({ subCategoryCount: 1, productCount: 3, primaryProductCount: 2 });

    await agent.delete(`/v1/admin/categories/${root.id}`).send({ mode: 'cascade' }).expect(204);
    expect(await prisma.category.count({ where: { id: { in: [root.id, child.id] } } })).toBe(0);
    expect(await prisma.product.count({ where: { id: { in: [inRoot, inChild] } } })).toBe(0);
    expect(await prisma.variant.count({ where: { productId: { in: [inRoot, inChild] } } })).toBe(0);
    const survivor = await prisma.product.findUniqueOrThrow({
      where: { id: elsewhere },
      include: { categories: true },
    });
    expect(survivor.categories.map((c) => c.categoryId)).toEqual([keep.id]);
  });

  it('checks permissions for set_home, delete modes and viewing', async () => {
    const limited = await createStaffWith(app, [
      'categories.view',
      'categories.create',
      'categories.edit',
      'categories.delete',
    ]);
    const l1 = await mk('Main');
    const other = await mk('Other');

    await limited.agent
      .post('/v1/admin/categories')
      .send({ nameEn: 'Home', imageMediaId: mediaId, showOnHome: true })
      .expect(403);
    await limited.agent
      .patch(`/v1/admin/categories/${l1.id}`)
      .send({ showOnHome: true })
      .expect(403);
    await limited.agent
      .patch(`/v1/admin/categories/${l1.id}`)
      .send({ isActive: false })
      .expect(200);

    await limited.agent
      .delete(`/v1/admin/categories/${l1.id}`)
      .send({ mode: 'cascade' })
      .expect(403);
    await limited.agent
      .delete(`/v1/admin/categories/${l1.id}`)
      .send({ mode: 'move', targetId: other.id })
      .expect(204);

    const viewer = await createStaffWith(app, ['categories.view']);
    await viewer.agent.get('/v1/admin/categories').expect(200);
    await viewer.agent.post('/v1/admin/categories').send({ nameEn: 'x' }).expect(403);

    const homer = await createStaffWith(app, [
      'categories.view',
      'categories.edit',
      'categories.set_home',
    ]);
    const set = await homer.agent
      .patch(`/v1/admin/categories/${other.id}`)
      .send({ showOnHome: true })
      .expect(200);
    expect(set.body.showOnHome).toBe(true);
    const sub = await mk('Sub', other.id);
    await homer.agent
      .patch(`/v1/admin/categories/${sub.id}`)
      .send({ showOnHome: true })
      .expect(400);
  });

  it('inherits attributes from ancestors and blocks key clashes', async () => {
    const root = await mk('Root');
    const mid = await mk('Mid', root.id);
    const leaf = await mk('Leaf', mid.id);

    const brand = await agent
      .post(`/v1/admin/categories/${root.id}/attributes`)
      .send({ key: 'color', nameEn: 'Colour', type: 'select' })
      .expect(201);
    await agent
      .post(`/v1/admin/categories/${leaf.id}/attributes`)
      .send({ key: 'size', nameEn: 'Size', type: 'text' })
      .expect(201);
    await agent
      .post(`/v1/admin/categories/${leaf.id}/attributes`)
      .send({ key: 'color', nameEn: 'Colour', type: 'text' })
      .expect(409);
    await agent
      .post(`/v1/admin/categories/${mid.id}/attributes`)
      .send({ key: 'size', nameEn: 'Size', type: 'text' })
      .expect(409);
    await agent
      .post(`/v1/admin/categories/${mid.id}/attributes`)
      .send({ key: 'Bad Key', nameEn: 'x', type: 'text' })
      .expect(400);

    const detail = await agent.get(`/v1/admin/categories/${leaf.id}`).expect(200);
    expect(detail.body.attributes.map((a: { key: string }) => a.key)).toEqual(['size']);
    expect(detail.body.inheritedAttributes).toHaveLength(1);
    expect(detail.body.inheritedAttributes[0]).toMatchObject({
      id: brand.body.id,
      key: 'color',
      inheritedFrom: { id: root.id, nameEn: 'Root' },
    });

    const svc = app.get(
      (await import('../src/catalog/categories/categories.service')).CategoriesService,
    );
    expect((await svc.inheritedAttributes([leaf.id])).map((a) => a.key)).toEqual(['color', 'size']);
    expect((await svc.subtreeIds(root.id)).sort()).toEqual([root.id, mid.id, leaf.id].sort());

    // moving a category under a chain that already has its key is refused
    const other = await mk('Other');
    await agent
      .post(`/v1/admin/categories/${other.id}/attributes`)
      .send({ key: 'color', nameEn: 'Colour', type: 'text' })
      .expect(201);
    await agent.patch(`/v1/admin/categories/${other.id}`).send({ parentId: root.id }).expect(409);
  });

  it('edits, reorders and deletes attributes; changing type drops options', async () => {
    const cat = await mk('Cat');
    const a = (
      await agent
        .post(`/v1/admin/categories/${cat.id}/attributes`)
        .send({ key: 'a', nameEn: 'A', type: 'select' })
        .expect(201)
    ).body;
    const b = (
      await agent
        .post(`/v1/admin/categories/${cat.id}/attributes`)
        .send({ key: 'b', nameEn: 'B', type: 'text' })
        .expect(201)
    ).body;
    expect([a.sort, b.sort]).toEqual([0, 1]);
    await agent
      .post(`/v1/admin/categories/${cat.id}/attributes/reorder`)
      .send([
        { id: a.id, sort: 1 },
        { id: b.id, sort: 0 },
      ])
      .expect(204);
    const detail = await agent.get(`/v1/admin/categories/${cat.id}`).expect(200);
    expect(detail.body.attributes.map((x: { key: string }) => x.key)).toEqual(['b', 'a']);

    await agent
      .put(`/v1/admin/attributes/${b.id}/options`)
      .send([{ valueEn: 'x' }])
      .expect(400);
    await agent
      .put(`/v1/admin/attributes/${a.id}/options`)
      .send([{ valueEn: 'Red' }, { valueEn: 'Blue' }])
      .expect(200);
    const patched = await agent
      .patch(`/v1/admin/attributes/${a.id}`)
      .send({ nameEn: 'Alpha', unit: 'cm', isRequired: true })
      .expect(200);
    expect(patched.body).toMatchObject({ nameEn: 'Alpha', unit: 'cm', isRequired: true });
    expect(patched.body.options).toHaveLength(2);

    const text = await agent
      .patch(`/v1/admin/attributes/${a.id}`)
      .send({ type: 'text' })
      .expect(200);
    expect(text.body.options).toEqual([]);
    expect(await prisma.attributeOption.count({ where: { attributeId: a.id } })).toBe(0);

    await agent.delete(`/v1/admin/attributes/${a.id}`).expect(204);
    await agent.delete(`/v1/admin/attributes/${a.id}`).expect(404);
  });

  it('option editor saves the full list and rejects blank and duplicate rows', async () => {
    const cat = await mk('Cat');
    const attr = (
      await agent
        .post(`/v1/admin/categories/${cat.id}/attributes`)
        .send({ key: 'material', nameEn: 'Material', type: 'multiselect' })
        .expect(201)
    ).body;
    const url = `/v1/admin/attributes/${attr.id}/options`;

    const first = await agent
      .put(url)
      .send([{ valueEn: 'Cotton', valueBn: 'সুতি' }, { valueEn: 'Wool' }, { valueEn: 'Silk' }])
      .expect(200);
    expect(first.body.map((o: { valueEn: string; sort: number }) => [o.valueEn, o.sort])).toEqual([
      ['Cotton', 0],
      ['Wool', 1],
      ['Silk', 2],
    ]);
    const [cotton, wool] = first.body;

    const blank = await agent
      .put(url)
      .send([{ valueEn: 'A' }, { valueEn: '   ' }])
      .expect(400);
    expect(blank.body.rows).toEqual([{ index: 1, field: 'valueEn', reason: 'blank' }]);

    const dup = await agent
      .put(url)
      .send([
        { valueEn: 'Red', valueBn: 'লাল' },
        { valueEn: 'red' },
        { valueEn: 'Blue', valueBn: 'লাল' },
      ])
      .expect(400);
    expect(dup.body.rows).toEqual([
      { index: 1, field: 'valueEn', reason: 'duplicate' },
      { index: 2, field: 'valueBn', reason: 'duplicate' },
    ]);
    // nothing was saved by the rejected calls
    expect(await prisma.attributeOption.count({ where: { attributeId: attr.id } })).toBe(3);

    // reorder + rename + delete + add in one save; ids are kept
    const second = await agent
      .put(url)
      .send([
        { id: wool.id, valueEn: 'Merino wool' },
        { valueEn: 'Linen' },
        { id: cotton.id, valueEn: 'Cotton' },
      ])
      .expect(200);
    expect(second.body.map((o: { valueEn: string }) => o.valueEn)).toEqual([
      'Merino wool',
      'Linen',
      'Cotton',
    ]);
    expect(second.body[0].id).toBe(wool.id);
    expect(second.body[2].id).toBe(cotton.id);
    expect(second.body[2].valueBn).toBeNull();
    expect(await prisma.attributeOption.count({ where: { attributeId: attr.id } })).toBe(3);

    await agent
      .put(url)
      .send([{ id: randomUUID(), valueEn: 'Ghost' }])
      .expect(400);
    await agent.put(url).send([]).expect(200);
    expect(await prisma.attributeOption.count({ where: { attributeId: attr.id } })).toBe(0);
  });
});
