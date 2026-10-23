import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedDemoCatalog } from '../src/seed/demo-catalog';
import { createApp, resetDb } from './helpers';

describe('demo catalog seeder', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    if ((await prisma.seller.count()) === 0) {
      await prisma.seller.create({ data: { name: 'BD Commerce' } });
    }
  });
  afterAll(() => app.close());

  it('seeds a consistent catalog', async () => {
    await seedDemoCatalog(prisma);

    const categories = await prisma.category.findMany({
      select: { id: true, level: true, path: true },
    });
    expect(categories.length).toBeGreaterThanOrEqual(15);
    expect(Math.max(...categories.map((c) => c.level))).toBe(4);
    for (const c of categories) {
      expect(c.path.endsWith(`${c.id}/`)).toBe(true);
      expect(c.path.split('/').filter(Boolean)).toHaveLength(c.level);
    }

    const products = await prisma.product.findMany({
      where: { slug: { startsWith: 'demo-' } },
      include: { variants: { include: { inventory: true, movements: true } } },
    });
    expect(products.length).toBeGreaterThanOrEqual(25);
    for (const product of products) {
      expect(product.variants.length).toBeGreaterThanOrEqual(1);
      if (!product.hasVariants) {
        expect(product.variants).toHaveLength(1);
        expect(product.variants[0].optionValue1Id).toBeNull();
      }
      for (const variant of product.variants) {
        expect(variant.inventory).not.toBeNull();
        if ((variant.inventory?.onHand ?? 0) > 0) {
          expect(variant.movements.some((m) => m.reason === 'import')).toBe(true);
        }
      }
    }
    expect(await prisma.variant.count({ where: { inventory: null } })).toBe(0);
  });

  it('does not duplicate when run twice', async () => {
    await seedDemoCatalog(prisma);
    const count = () =>
      Promise.all([prisma.category.count(), prisma.product.count(), prisma.variant.count()]);
    const before = await count();
    await seedDemoCatalog(prisma);
    expect(await count()).toEqual(before);
  });
});
