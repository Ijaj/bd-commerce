import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { bundleConfigSchema, bxgyConfigSchema } from '../types';
import { CouponError } from './coupons.errors';

type Db = Prisma.TransactionClient;

interface Refs {
  targets: { targetType: 'product' | 'category' | 'brand'; targetId: string }[];
  zoneIds: string[];
  customerIds: string[];
  type: string;
  config: unknown;
}

const unique = (xs: string[]) => [...new Set(xs)];

/** Every referenced row must exist; one 422 listing what is missing. */
export async function assertRefs(db: Db, r: Refs) {
  const productIds = r.targets.filter((t) => t.targetType === 'product').map((t) => t.targetId);
  const variantIds: string[] = [];
  if (r.type === 'bxgy') {
    const c = bxgyConfigSchema.safeParse(r.config);
    if (c.success) productIds.push(...c.data.getProductIds);
  } else if (r.type === 'bundle') {
    const c = bundleConfigSchema.safeParse(r.config);
    if (c.success) {
      for (const i of c.data.items) {
        productIds.push(i.productId);
        if (i.variantId) variantIds.push(i.variantId);
      }
    }
  }
  const categoryIds = r.targets.filter((t) => t.targetType === 'category').map((t) => t.targetId);
  const brandIds = r.targets.filter((t) => t.targetType === 'brand').map((t) => t.targetId);

  const missing: string[] = [];
  const check = async (label: string, ids: string[], count: (ids: string[]) => Promise<number>) => {
    const u = unique(ids);
    if (u.length > 0 && (await count(u)) !== u.length) missing.push(label);
  };
  await check('product', productIds, (id) => db.product.count({ where: { id: { in: id } } }));
  await check('category', categoryIds, (id) => db.category.count({ where: { id: { in: id } } }));
  await check('brand', brandIds, (id) => db.brand.count({ where: { id: { in: id } } }));
  await check('zone', r.zoneIds, (id) => db.deliveryZone.count({ where: { id: { in: id } } }));
  await check('customer', r.customerIds, (id) => db.customer.count({ where: { id: { in: id } } }));
  await check('variant', variantIds, (id) => db.variant.count({ where: { id: { in: id } } }));
  if (missing.length > 0) {
    throw new CouponError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'COUPON_TARGET_NOT_FOUND',
      `Unknown ${missing.join(', ')} id(s).`,
      { missing },
    );
  }
}

/** Display names for the targets of one coupon, keyed `type:id`. */
export async function targetLabels(
  db: Db,
  targets: { targetType: string; targetId: string }[],
): Promise<Map<string, string>> {
  const ids = (t: string) => targets.filter((x) => x.targetType === t).map((x) => x.targetId);
  const [products, categories, brands] = await Promise.all([
    db.product.findMany({
      where: { id: { in: ids('product') } },
      select: { id: true, titleEn: true },
    }),
    db.category.findMany({
      where: { id: { in: ids('category') } },
      select: { id: true, nameEn: true },
    }),
    db.brand.findMany({ where: { id: { in: ids('brand') } }, select: { id: true, nameEn: true } }),
  ]);
  const m = new Map<string, string>();
  for (const p of products) m.set(`product:${p.id}`, p.titleEn);
  for (const c of categories) m.set(`category:${c.id}`, c.nameEn);
  for (const b of brands) m.set(`brand:${b.id}`, b.nameEn);
  return m;
}
