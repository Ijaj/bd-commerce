import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { bundleConfigSchema } from '../types';
import { isExhausted } from './coupon-validation';

const SOON_MS = 7 * 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicRow = Prisma.CouponGetPayload<{ include: { targets: true } }>;

export function toPublicItem(c: PublicRow, collected?: boolean) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    // Bulk codes are one-per-person and never shown on a page.
    code: c.kind === 'code' && !c.isBulk ? c.code : null,
    type: c.type,
    value: c.value,
    maxDiscountP: c.maxDiscountP,
    minOrderP: c.minOrderP,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    termsEn: c.termsEn,
    termsBn: c.termsBn,
    isCollectable: c.isCollectable,
    ...(collected === undefined ? {} : { collected }),
  };
}

@Injectable()
export class CouponsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public, active coupons that are on now or start within 7 days. */
  async live(now = new Date()) {
    const rows = await this.prisma.coupon.findMany({
      where: {
        visibility: 'public',
        status: 'active',
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date(now.getTime() + SOON_MS) } }] },
        ],
      },
      include: { targets: true },
      orderBy: [{ priority: 'desc' }, { endsAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    });
    return rows.filter((c) => !isExhausted(c));
  }

  async list(customerId: string | null) {
    const rows = await this.live();
    const collected = await this.collectedIds(customerId, rows);
    return { items: rows.map((c) => toPublicItem(c, collected?.has(c.id))) };
  }

  /** Public coupons whose scope covers the product, for the product page teaser. */
  async forProduct(slug: string, customerId: string | null) {
    const now = new Date();
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'active', publishedAt: { lte: now } },
      select: {
        id: true,
        brandId: true,
        primaryCategoryId: true,
        categories: { select: { categoryId: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const direct = [product.primaryCategoryId, ...product.categories.map((c) => c.categoryId)];
    const cats = await this.prisma.category.findMany({
      where: { id: { in: direct } },
      select: { path: true },
    });
    const categoryIds = new Set([
      ...direct,
      ...cats.flatMap((c) => c.path.split('/').filter((p) => UUID_RE.test(p))),
    ]);

    const rows = (await this.live(now)).filter((c) => {
      if (c.type === 'bundle') {
        const cfg = bundleConfigSchema.safeParse(c.config);
        return cfg.success && cfg.data.items.some((i) => i.productId === product.id);
      }
      const hit = (t: PublicRow['targets'][number]) =>
        (t.targetType === 'product' && t.targetId === product.id) ||
        (t.targetType === 'brand' && t.targetId === product.brandId) ||
        (t.targetType === 'category' && categoryIds.has(t.targetId));
      const include = c.targets.filter((t) => t.mode === 'include');
      const covered = include.length === 0 || include.some(hit);
      return covered && !c.targets.some((t) => t.mode === 'exclude' && hit(t));
    });
    const collected = await this.collectedIds(customerId, rows);
    return { items: rows.map((c) => toPublicItem(c, collected?.has(c.id))) };
  }

  private async collectedIds(customerId: string | null, rows: { id: string }[]) {
    if (!customerId) return null;
    const w = await this.prisma.couponWallet.findMany({
      where: { customerId, couponId: { in: rows.map((r) => r.id) } },
      select: { couponId: true },
    });
    return new Set(w.map((x) => x.couponId));
  }
}
