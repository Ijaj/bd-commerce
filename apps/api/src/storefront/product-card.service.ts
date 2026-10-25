import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { activeFlashFor } from '../promotions/flash/flash-core';
import { SettingsService } from '../settings/settings.service';
import { ImageService } from './images';
import { availableQty, effectivePrice } from './pricing';
import type { ProductCard } from './public.dto';

export type { ProductCard };

const DAY_MS = 86_400_000;

/**
 * Maps product ids to the cards the shop renders (listing, feed, wishlist, recently viewed).
 * Products that are not public (draft, not yet published, hidden category, no active variant)
 * are left out, so callers can pass any id list.
 */
@Injectable()
export class ProductCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly images: ImageService,
  ) {}

  /** Cards in the order of `ids`; unknown and non-public ids are dropped. */
  async cards(ids: string[]): Promise<ProductCard[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const now = new Date();
    const [rows, hidden, feed] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { in: unique },
          status: 'active',
          publishedAt: { lte: now },
          primaryCategory: { isActive: true },
        },
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleBn: true,
          isPreorder: true,
          isUpcoming: true,
          publishedAt: true,
          ratingAvg: true,
          ratingCount: true,
          soldCount: true,
          primaryCategory: { select: { path: true } },
          variants: {
            where: { isActive: true },
            select: {
              sort: true,
              id: true,
              priceP: true,
              compareAtP: true,
              salePriceP: true,
              saleStartsAt: true,
              saleEndsAt: true,
              inventory: { select: { onHand: true, reserved: true } },
            },
          },
          // Shared images first (variantId null), any image as a fallback.
          images: {
            orderBy: [
              { variantId: { sort: 'asc', nulls: 'first' } },
              { sort: 'asc' },
              { id: 'asc' },
            ],
            take: 1,
            select: {
              alt: true,
              media: { select: { storageKey: true, width: true, height: true, alt: true } },
            },
          },
        },
      }),
      this.prisma.category.findMany({ where: { isActive: false }, select: { path: true } }),
      this.settings.get('home_feed'),
    ]);

    const flashes = await activeFlashFor(
      this.prisma,
      rows.flatMap((p) => p.variants.map((v) => v.id)),
      now,
    );
    const hiddenPaths = hidden.map((c) => c.path);
    const newSince = now.getTime() - feed.newDays * DAY_MS;
    const byId = new Map<string, ProductCard>();
    for (const p of rows) {
      if (p.variants.length === 0) continue;
      if (hiddenPaths.some((h) => p.primaryCategory.path.startsWith(h))) continue;

      const priced = p.variants
        .map((v) => ({ v, price: effectivePrice(v, now, flashes.get(v.id) ?? null) }))
        .sort((a, b) => a.price.priceP - b.price.priceP || a.v.sort - b.v.sort);
      const cheapest = priced[0]?.price;
      if (!cheapest) continue;
      const stock = p.variants.reduce((sum, v) => sum + availableQty(v.inventory), 0);
      const img = p.images[0];
      byId.set(p.id, {
        id: p.id,
        slug: p.slug,
        titleEn: p.titleEn,
        titleBn: p.titleBn,
        image: img ? this.images.set(img.media, img.alt ?? img.media.alt) : null,
        priceP: cheapest.priceP,
        compareAtP: cheapest.compareAtP,
        discountPct: cheapest.discountPct,
        flashEndsAt: cheapest.flashEndsAt?.toISOString() ?? null,
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        soldCount: p.soldCount,
        badges: {
          isNew: p.publishedAt !== null && p.publishedAt.getTime() > newSince,
          isPreorder: p.isPreorder,
          isUpcoming: p.isUpcoming,
          outOfStock: stock <= 0 && !p.isPreorder && !p.isUpcoming,
        },
      });
    }
    return ids.flatMap((id) => {
      const card = byId.get(id);
      return card ? [card] : [];
    });
  }
}
