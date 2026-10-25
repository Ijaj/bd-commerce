import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { availableQty, effectivePrice } from '../../storefront/pricing';
import { ProductCardService } from '../../storefront/product-card.service';
import type { ProductCard } from '../../storefront/public.dto';

const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 7;

/** Public flash sale pages: no per-user data, so responses can be cached. */
@Injectable()
export class FlashPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: ProductCardService,
  ) {}

  async current() {
    const now = new Date();
    const sales = await this.prisma.flashSale.findMany({
      where: {
        isActive: true,
        endsAt: { gt: now },
        startsAt: { lte: new Date(now.getTime() + UPCOMING_DAYS * DAY_MS) },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { id: 'asc' }],
          include: {
            variant: {
              select: {
                id: true,
                isActive: true,
                productId: true,
                priceP: true,
                compareAtP: true,
                salePriceP: true,
                saleStartsAt: true,
                saleEndsAt: true,
                inventory: { select: { onHand: true, reserved: true } },
              },
            },
          },
        },
      },
    });
    const productIds = sales.flatMap((s) => s.items.map((i) => i.variant.productId));
    const cardById = new Map((await this.cards.cards(productIds)).map((c) => [c.id, c]));

    const build = (s: (typeof sales)[number]) => {
      const live = s.startsAt <= now;
      const items = s.items.flatMap((i) => {
        const remaining = i.qtyLimit - i.qtySold;
        const card = cardById.get(i.variant.productId);
        if (!card || !i.variant.isActive || remaining <= 0) return [];
        const buyable =
          availableQty(i.variant.inventory) > 0 || card.badges.isPreorder || card.badges.isUpcoming;
        if (!buyable) return [];
        // The card shows this item's price, not the product's cheapest variant.
        const price = effectivePrice(i.variant, live ? now : s.startsAt, {
          flashPriceP: i.flashPriceP,
          endsAt: s.endsAt,
        });
        const productCard: ProductCard = {
          ...card,
          priceP: price.priceP,
          compareAtP: price.compareAtP,
          discountPct: price.discountPct,
          flashEndsAt: live && price.source === 'flash' ? s.endsAt.toISOString() : null,
        };
        return [
          {
            variantId: i.variantId,
            productCard,
            flashPriceP: i.flashPriceP,
            remaining,
            qtyLimit: i.qtyLimit,
          },
        ];
      });
      return {
        id: s.id,
        nameEn: s.nameEn,
        nameBn: s.nameBn,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        items,
      };
    };
    const built = sales.map((s) => ({ live: s.startsAt <= now, sale: build(s) }));
    return {
      live: built.filter((b) => b.live && b.sale.items.length > 0).map((b) => b.sale),
      upcoming: built.filter((b) => !b.live && b.sale.items.length > 0).map((b) => b.sale),
    };
  }
}
