import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { effectivePrice } from '../../storefront/pricing';
import { BulkSaleError } from './bulk-sale.errors';

type Db = Prisma.TransactionClient;

export const MAX_VARIANTS = 5000;
/** Beyond this many matching variants we don't even load them: the scope is clearly too broad. */
const LOAD_CAP = 20_000;
const MIN_SALE_P = 100;

export interface BulkScope {
  productIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
}

export interface BulkRule {
  mode: 'percent' | 'fixed';
  value: number;
  scope: BulkScope;
  skipExistingSales?: boolean;
}

export interface PlannedVariant {
  variantId: string;
  sku: string;
  title: string;
  priceP: number;
  currentSalePriceP: number | null;
  prevSalePriceP: number | null;
  prevSaleStartsAt: Date | null;
  prevSaleEndsAt: Date | null;
  newSalePriceP: number;
}

export interface BulkPlan {
  planned: PlannedVariant[];
  skippedExisting: number;
  skippedPrice: number;
  /** The scope matched too many variants to even load. */
  tooBroad: boolean;
}

/** Sale price for one variant, or null when the result would be under ৳1 or not below the price. */
export function newSalePrice(rule: Pick<BulkRule, 'mode' | 'value'>, priceP: number) {
  const next =
    rule.mode === 'percent'
      ? priceP - Math.floor((priceP * rule.value) / 10_000)
      : priceP - rule.value;
  return next >= MIN_SALE_P && next < priceP ? next : null;
}

/** Categories include their descendants (materialized path), and products' extra categories. */
async function scopeWhere(db: Db, scope: BulkScope): Promise<Prisma.VariantWhereInput> {
  const or: Prisma.ProductWhereInput[] = [];
  if (scope.productIds?.length) or.push({ id: { in: scope.productIds } });
  if (scope.brandIds?.length) or.push({ brandId: { in: scope.brandIds } });
  if (scope.categoryIds?.length) {
    const roots = await db.category.findMany({
      where: { id: { in: scope.categoryIds } },
      select: { path: true },
    });
    const ids = roots.length
      ? (
          await db.category.findMany({
            where: { OR: roots.map((r) => ({ path: { startsWith: r.path } })) },
            select: { id: true },
          })
        ).map((c) => c.id)
      : [];
    or.push(
      { primaryCategoryId: { in: ids } },
      { categories: { some: { categoryId: { in: ids } } } },
    );
  }
  return { isActive: true, product: { OR: or } };
}

export async function planBulkSale(db: Db, rule: BulkRule, now: Date): Promise<BulkPlan> {
  const where = await scopeWhere(db, rule.scope);
  if ((await db.variant.count({ where })) > LOAD_CAP) {
    return { planned: [], skippedExisting: 0, skippedPrice: 0, tooBroad: true };
  }
  const rows = await db.variant.findMany({
    where,
    select: {
      id: true,
      sku: true,
      priceP: true,
      compareAtP: true,
      salePriceP: true,
      saleStartsAt: true,
      saleEndsAt: true,
      product: { select: { titleEn: true } },
    },
    orderBy: [{ productId: 'asc' }, { sort: 'asc' }, { id: 'asc' }],
  });
  const planned: PlannedVariant[] = [];
  let skippedExisting = 0;
  let skippedPrice = 0;
  for (const v of rows) {
    const current = effectivePrice(v, now);
    if (rule.skipExistingSales && current.source === 'sale') {
      skippedExisting += 1;
      continue;
    }
    const next = newSalePrice(rule, v.priceP);
    if (next === null) {
      skippedPrice += 1;
      continue;
    }
    planned.push({
      variantId: v.id,
      sku: v.sku,
      title: v.product.titleEn,
      priceP: v.priceP,
      currentSalePriceP: current.source === 'sale' ? current.priceP : null,
      prevSalePriceP: v.salePriceP,
      prevSaleStartsAt: v.saleStartsAt,
      prevSaleEndsAt: v.saleEndsAt,
      newSalePriceP: next,
    });
  }
  return { planned, skippedExisting, skippedPrice, tooBroad: false };
}

export function tooManyError(n: number) {
  return new BulkSaleError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'BULK_SALE_TOO_MANY',
    `This would change ${n} variants; the limit is ${MAX_VARIANTS}. Narrow the scope.`,
  );
}
