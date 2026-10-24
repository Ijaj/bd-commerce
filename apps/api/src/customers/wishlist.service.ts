import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { imgproxyConfig, imgproxyUrl } from '../media/imgproxy';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CustomerError } from './customers.errors';

const DAY_MS = 24 * 60 * 60_000;

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Same visibility rule as the public catalog: active and already published. */
  private publicProduct(now: Date) {
    return {
      status: 'active' as const,
      publishedAt: { lte: now },
      primaryCategory: { isActive: true },
    };
  }

  async ids(customerId: string) {
    const rows = await this.prisma.wishlist.findMany({
      where: { customerId },
      orderBy: { addedAt: 'desc' },
      select: { productId: true },
    });
    return { productIds: rows.map((r) => r.productId) };
  }

  async add(customerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...this.publicProduct(new Date()) },
      select: { id: true },
    });
    if (!product) throw new CustomerError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Product not found.');
    await this.prisma.wishlist.upsert({
      where: { customerId_productId: { customerId, productId } },
      create: { customerId, productId },
      update: {},
    });
  }

  async remove(customerId: string, productId: string) {
    await this.prisma.wishlist.deleteMany({ where: { customerId, productId } });
  }

  // TODO(lead): swap to storefront card mapper (ProductCardService) once it exists.
  async list(customerId: string) {
    const now = new Date();
    const [rows, feed] = await Promise.all([
      this.prisma.wishlist.findMany({
        where: { customerId, product: this.publicProduct(now) },
        orderBy: { addedAt: 'desc' },
        include: {
          product: {
            include: {
              variants: { where: { isActive: true }, include: { inventory: true } },
              images: { orderBy: { sort: 'asc' }, take: 1, include: { media: true } },
            },
          },
        },
      }),
      this.settings.get('home_feed'),
    ]);
    const cfg = imgproxyConfig(this.env);

    const items = rows.map(({ product: p, addedAt }) => {
      const effective = p.variants.map((v) => {
        const onSale =
          v.salePriceP !== null &&
          (!v.saleStartsAt || v.saleStartsAt <= now) &&
          (!v.saleEndsAt || v.saleEndsAt > now);
        const price = onSale ? (v.salePriceP as number) : v.priceP;
        return { price, compareAt: Math.max(v.compareAtP ?? 0, onSale ? v.priceP : 0) || null };
      });
      const cheapest = effective.reduce<(typeof effective)[number] | null>(
        (best, e) => (best === null || e.price < best.price ? e : best),
        null,
      );
      const priceP = cheapest?.price ?? 0;
      const compareAtP =
        cheapest?.compareAt && cheapest.compareAt > priceP ? cheapest.compareAt : null;
      const available = p.variants.reduce(
        (sum, v) => sum + Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)),
        0,
      );
      const media = p.images[0]?.media;
      const size = (w: number) =>
        imgproxyUrl(cfg, media?.storageKey ?? '', { width: w, height: w });
      return {
        id: p.id,
        slug: p.slug,
        titleEn: p.titleEn,
        titleBn: p.titleBn,
        image: media
          ? {
              alt: p.images[0]?.alt ?? media.alt,
              width: media.width,
              height: media.height,
              url320: size(320),
              url640: size(640),
              url1200: size(1200),
            }
          : null,
        priceP,
        compareAtP,
        discountPct: compareAtP ? Math.round(((compareAtP - priceP) / compareAtP) * 100) : null,
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        soldCount: p.soldCount,
        badges: {
          isNew: !!p.publishedAt && now.getTime() - p.publishedAt.getTime() < feed.newDays * DAY_MS,
          isPreorder: p.isPreorder,
          isUpcoming: p.isUpcoming,
          outOfStock: p.fulfillment === 'stock' && !p.isPreorder && !p.isUpcoming && available <= 0,
        },
        addedAt: addedAt.toISOString(),
      };
    });
    return { items };
  }
}
