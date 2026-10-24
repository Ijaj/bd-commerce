import { Injectable, NotFoundException } from '@nestjs/common';
import { sanitizeDescriptionHtml } from '../catalog/html/sanitize';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ImageService } from './images';
import { availableQty, effectivePrice } from './pricing';
import { ProductCardService } from './product-card.service';
import type { ProductCard } from './public.dto';
import { PublicCategoriesService } from './public-categories.service';
import { PRODUCT_FROM, PUBLIC_WHERE } from './sql';

const DAY_MS = 86_400_000;
const media = { select: { storageKey: true, width: true, height: true, alt: true } };

@Injectable()
export class ProductDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly images: ImageService,
    private readonly cards: ProductCardService,
    private readonly categories: PublicCategoriesService,
  ) {}

  async bySlug(slug: string) {
    const now = new Date();
    const [p, tree, feed] = await Promise.all([
      this.prisma.product.findFirst({
        where: {
          slug,
          status: 'active',
          publishedAt: { lte: now },
          primaryCategory: { isActive: true },
        },
        include: {
          primaryCategory: { select: { id: true, path: true } },
          brand: { select: { slug: true, nameEn: true, nameBn: true, active: true } },
          images: { orderBy: [{ sort: 'asc' }, { id: 'asc' }], include: { media } },
          options: {
            orderBy: { position: 'asc' },
            include: { values: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
          },
          variants: {
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
            include: { inventory: { select: { onHand: true, reserved: true } } },
          },
          attributeValues: {
            include: { attribute: true, option: true },
          },
        },
      }),
      this.categories.tree(),
      this.settings.get('home_feed'),
    ]);
    // Hidden when any ancestor category is inactive (absent from the public tree) or nothing is sellable.
    if (!p || !tree.byId.has(p.primaryCategory.id) || !p.variants.some((v) => v.isActive)) {
      throw new NotFoundException('Product not found');
    }

    const active = p.variants.filter((v) => v.isActive);
    const stock = active.reduce((sum, v) => sum + availableQty(v.inventory), 0);
    const variants = p.variants.map((v) => {
      const price = effectivePrice(v, now);
      return {
        id: v.id,
        sku: v.sku,
        optionValue1Id: v.optionValue1Id,
        optionValue2Id: v.optionValue2Id,
        priceP: price.priceP,
        compareAtP: price.compareAtP,
        discountPct: price.discountPct,
        available: availableQty(v.inventory),
        isActive: v.isActive,
      };
    });

    return {
      id: p.id,
      slug: p.slug,
      titleEn: p.titleEn,
      titleBn: p.titleBn,
      shortDescriptionEn: p.shortDescriptionEn,
      shortDescriptionBn: p.shortDescriptionBn,
      // Q28: sanitized on save and again on render.
      descriptionHtmlEn: p.descriptionHtmlEn ? sanitizeDescriptionHtml(p.descriptionHtmlEn) : null,
      descriptionHtmlBn: p.descriptionHtmlBn ? sanitizeDescriptionHtml(p.descriptionHtmlBn) : null,
      youtubeUrl: p.youtubeUrl,
      brand: p.brand?.active
        ? { slug: p.brand.slug, nameEn: p.brand.nameEn, nameBn: p.brand.nameBn }
        : null,
      breadcrumb: this.categories.breadcrumb(tree, p.primaryCategory.path),
      images: p.images.map((i) => ({
        ...this.images.set(i.media, i.alt ?? i.media.alt),
        variantId: i.variantId,
      })),
      options: p.options.map((o) => ({
        position: o.position,
        nameEn: o.nameEn,
        nameBn: o.nameBn,
        values: o.values.map((v) => ({
          id: v.id,
          valueEn: v.valueEn,
          valueBn: v.valueBn,
          swatchHex: v.swatchHex,
        })),
      })),
      variants,
      specs: this.specs(p.attributeValues),
      badges: {
        isNew:
          p.publishedAt !== null && p.publishedAt.getTime() > now.getTime() - feed.newDays * DAY_MS,
        isPreorder: p.isPreorder,
        isUpcoming: p.isUpcoming,
        outOfStock: stock <= 0 && !p.isPreorder && !p.isUpcoming,
      },
      isPreorder: p.isPreorder,
      preorderExpectedDate: p.preorderExpectedDate
        ? p.preorderExpectedDate.toISOString().slice(0, 10)
        : null,
      isUpcoming: p.isUpcoming,
      ratingAvg: Number(p.ratingAvg),
      ratingCount: p.ratingCount,
      soldCount: p.soldCount,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /** Same primary category first (best sellers), then products from sibling categories. */
  async similar(slug: string, limit: number): Promise<ProductCard[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH self AS (
        SELECT p.id, p.primary_category_id, c.parent_id
        FROM products p JOIN categories c ON c.id = p.primary_category_id
        WHERE p.slug = ${slug}
      )
      SELECT p.id ${PRODUCT_FROM}, self
      WHERE ${PUBLIC_WHERE} AND p.id <> self.id
        AND (pc.id = self.primary_category_id
             OR (self.parent_id IS NOT NULL AND pc.parent_id = self.parent_id))
      ORDER BY (pc.id = self.primary_category_id) DESC, p.sold_count DESC, p.id
      LIMIT ${limit}`;
    return this.cards.cards(rows.map((r) => r.id));
  }

  async sitemap() {
    const [products, tree] = await Promise.all([
      this.prisma.$queryRaw<{ slug: string; updated_at: Date }[]>`
        SELECT p.slug, p.updated_at ${PRODUCT_FROM} WHERE ${PUBLIC_WHERE}
        ORDER BY p.updated_at DESC, p.id LIMIT 50000`,
      this.categories.tree(),
    ]);
    return {
      products: products.map((r) => ({ slug: r.slug, updatedAt: r.updated_at.toISOString() })),
      categories: tree.list.map((c) => ({
        slug: c.slug,
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  private specs(
    values: Prisma.ProductAttributeValueGetPayload<{
      include: { attribute: true; option: true };
    }>[],
  ) {
    const byAttr = new Map<
      string,
      { attr: (typeof values)[number]['attribute']; en: string[]; bn: (string | null)[] }
    >();
    for (const v of values) {
      let en: string;
      let bn: string | null = null;
      if (v.option) {
        en = v.option.valueEn;
        bn = v.option.valueBn;
      } else if (v.valueText !== null) {
        en = v.valueText;
      } else if (v.valueNumber !== null) {
        en = String(Number(v.valueNumber));
      } else if (v.valueBool !== null) {
        en = v.valueBool ? 'Yes' : 'No';
        bn = v.valueBool ? 'হ্যাঁ' : 'না';
      } else {
        continue;
      }
      const entry = byAttr.get(v.attributeId) ?? { attr: v.attribute, en: [], bn: [] };
      entry.en.push(en);
      entry.bn.push(bn);
      byAttr.set(v.attributeId, entry);
    }
    return [...byAttr.values()]
      .sort((a, b) => a.attr.sort - b.attr.sort || a.attr.key.localeCompare(b.attr.key))
      .map(({ attr, en, bn }) => ({
        nameEn: attr.nameEn,
        nameBn: attr.nameBn,
        unit: attr.unit,
        valueEn: en.join(', '),
        // Only offer Bangla when every value has one; otherwise the shop falls back to EN.
        valueBn: bn.every((x) => x !== null) ? bn.join(', ') : null,
      }));
  }
}
