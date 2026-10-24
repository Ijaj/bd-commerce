import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../storefront/images';

/** Variant picker for the SR sale form: own-stock products only, list price as a starting point. */
@Injectable()
export class SrProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageService,
  ) {}

  async search(q: string | undefined) {
    const where: Prisma.VariantWhereInput = {
      isActive: true,
      product: { status: 'active', fulfillment: 'stock' },
    };
    if (q) {
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { product: { titleEn: { contains: q, mode: 'insensitive' } } },
        { product: { titleBn: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.variant.findMany({
      where,
      orderBy: [{ product: { titleEn: 'asc' } }, { sort: 'asc' }, { sku: 'asc' }],
      take: 30,
      select: {
        id: true,
        sku: true,
        priceP: true,
        product: {
          select: {
            titleEn: true,
            titleBn: true,
            images: {
              orderBy: { sort: 'asc' },
              select: { variantId: true, alt: true, media: true },
            },
          },
        },
        optionValue1: { select: { valueEn: true, valueBn: true } },
        optionValue2: { select: { valueEn: true, valueBn: true } },
        inventory: { select: { onHand: true, reserved: true } },
      },
    });
    return rows.map((v) => {
      const opts = [v.optionValue1, v.optionValue2].filter((o) => o !== null);
      const img = v.product.images.find((i) => i.variantId === v.id) ?? v.product.images[0];
      return {
        variantId: v.id,
        sku: v.sku,
        titleEn: v.product.titleEn,
        titleBn: v.product.titleBn,
        optionsText: opts.map((o) => o.valueEn).join(', '),
        optionsTextBn: opts.map((o) => o.valueBn ?? o.valueEn).join(', '),
        image: img ? this.images.set(img.media, img.alt ?? img.media.alt) : null,
        priceP: v.priceP,
        available: Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)),
      };
    });
  }
}
