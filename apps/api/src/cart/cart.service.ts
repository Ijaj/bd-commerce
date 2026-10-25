import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottleService } from '../auth/throttle.service';
import { Prisma } from '../generated/prisma/client';
import { CommerceError } from '../orders/commerce.errors';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/engine/promotions.service';
import {
  activeFlashFor,
  type FlashBuyer,
  flashAllowance,
  flashUsedBy,
} from '../promotions/flash/flash-core';
import {
  EMPTY_PROMO,
  type PromoContext,
  type PromoLine,
  type PromoResult,
} from '../promotions/types';
import { SettingsService } from '../settings/settings.service';
import { ImageService } from '../storefront/images';
import { availableQty, effectivePrice } from '../storefront/pricing';
import {
  type CartLineDetail,
  type CartProblem,
  type CartView,
  categoryIdsOf,
  EMPTY_CART_VIEW,
  subtotalOf,
} from './cart.types';
import type { CartIdentity } from './cart-identity.service';

export type {
  AppliedCouponView,
  CartLine,
  CartLineDetail,
  CartProblem,
  CartView,
} from './cart.types';
export { EMPTY_CART_VIEW, subtotalOf } from './cart.types';

const NEW_CARTS_PER_IP_HOUR = 30;
export const MAX_CART_CODES = 2;

type Db = Prisma.TransactionClient;
const lineInclude = {
  variant: {
    include: {
      inventory: true,
      optionValue1: true,
      optionValue2: true,
      images: { orderBy: { sort: 'asc' }, take: 1, include: { media: true } },
      product: {
        include: {
          primaryCategory: { select: { isActive: true, returnWindowDays: true, path: true } },
          categories: { select: { category: { select: { path: true } } } },
          images: {
            where: { variantId: null },
            orderBy: { sort: 'asc' },
            take: 1,
            include: { media: true },
          },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly images: ImageService,
    private readonly throttle: ThrottleService,
    private readonly promotions: PromotionsService,
  ) {}

  findLive(db: Db, who: Pick<CartIdentity, 'customerId' | 'visitorId'>) {
    if (who.customerId) {
      return db.cart.findFirst({ where: { customerId: who.customerId, mergedIntoId: null } });
    }
    if (who.visitorId) {
      return db.cart.findFirst({
        where: { visitorId: who.visitorId, customerId: null, mergedIntoId: null },
      });
    }
    return Promise.resolve(null);
  }

  private async getOrCreate(who: Pick<CartIdentity, 'customerId' | 'visitorId' | 'ip'>) {
    const found = await this.findLive(this.prisma, who);
    if (found) return found;
    if (!who.customerId) {
      // Anonymous cart rows are free to create, so cap them per IP (cookie-less scripts make one each).
      const key = `cart-create:ip:${who.ip ?? 'unknown'}`;
      if (await this.throttle.isBlocked(key, NEW_CARTS_PER_IP_HOUR)) {
        throw new CommerceError(
          HttpStatus.TOO_MANY_REQUESTS,
          'TOO_MANY_REQUESTS',
          'Too many new carts from this network. Try again later.',
        );
      }
      await this.throttle.hit(key, 3600);
    }
    try {
      return await this.prisma.cart.create({
        data: who.customerId
          ? { customerId: who.customerId, visitorId: who.visitorId }
          : { visitorId: who.visitorId },
      });
    } catch (e) {
      // Two parallel first requests: the partial unique index lets only one win.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.findLive(this.prisma, who);
        if (again) return again;
      }
      throw e;
    }
  }

  /** Lines with live price/stock checks. `db` may be a transaction so checkout reads what it locks. */
  async lines(db: Db, cartId: string, buyer?: FlashBuyer): Promise<CartLineDetail[]> {
    const now = new Date();
    const [checkout, preordersOn] = await Promise.all([
      this.settings.get('checkout'),
      this.settings.get('preorders_enabled'),
    ]);
    // Sequential on purpose: `db` can be a transaction, which runs one query at a time.
    const items = await db.cartItem.findMany({
      where: { cartId },
      orderBy: [{ addedAt: 'asc' }, { id: 'asc' }],
      include: lineInclude,
    });
    const flashes = await activeFlashFor(
      db,
      items.map((i) => i.variantId),
      now,
    );
    const used = buyer
      ? await flashUsedBy(
          db,
          [...flashes.values()].map((f) => f.itemId),
          buyer,
        )
      : new Map<string, number>();

    return items.map((item) => {
      const v = item.variant;
      const p = v.product;
      // A buyer whose personal flash limit is used up simply pays the normal price (C56).
      const flash = flashes.get(v.id) ?? null;
      const allowance = flash ? flashAllowance(flash, used.get(flash.itemId) ?? 0) : 0;
      const price = effectivePrice(v, now, allowance > 0 ? flash : null);
      const flashLive = price.source === 'flash';
      const isPublic =
        p.status === 'active' &&
        p.publishedAt !== null &&
        p.publishedAt <= now &&
        p.primaryCategory.isActive &&
        v.isActive;
      const reserves = p.fulfillment === 'stock' && !p.isPreorder;
      const available = reserves ? availableQty(v.inventory) : checkout.maxQtyPerLine;
      const regularMax = Math.min(available, checkout.maxQtyPerLine);
      const maxQty = flashLive ? Math.min(regularMax, allowance) : regularMax;

      let problem: CartProblem | null = null;
      if (!isPublic || (p.isPreorder && !preordersOn)) problem = 'unavailable';
      else if (p.isUpcoming) problem = 'upcoming';
      else if (maxQty === 0) problem = 'out_of_stock';
      else if (item.qty > maxQty) problem = 'qty_reduced';

      const media = v.images[0]?.media ?? p.images[0]?.media ?? null;
      const alt = v.images[0]?.alt ?? p.images[0]?.alt ?? null;
      const opts = [v.optionValue1, v.optionValue2].filter((o) => o !== null);
      return {
        variantId: v.id,
        productId: p.id,
        slug: p.slug,
        titleEn: p.titleEn,
        titleBn: p.titleBn,
        optionsTextEn: opts.length ? opts.map((o) => o.valueEn).join(' / ') : null,
        optionsTextBn: opts.length ? opts.map((o) => o.valueBn ?? o.valueEn).join(' / ') : null,
        image: media ? this.images.set(media, alt ?? media.alt) : null,
        qty: item.qty,
        unitPriceP: price.priceP,
        compareAtP: price.compareAtP,
        priceAtAddP: item.priceAtAddP,
        priceChanged: item.priceAtAddP !== price.priceP,
        available: isPublic ? available : 0,
        maxQty: isPublic ? maxQty : 0,
        problem,
        flashEndsAt: price.flashEndsAt?.toISOString() ?? null,
        discountP: 0,
        sellerId: p.sellerId,
        sku: v.sku,
        weightG: v.weightG ?? p.weightG,
        returnWindowDays: p.returnWindowDays ?? p.primaryCategory.returnWindowDays,
        unitBaseP: v.priceP,
        priceSource: price.source,
        flashItemId: flashLive ? (flash?.itemId ?? null) : null,
        flashCapped: flashLive && allowance < regularMax,
        brandId: p.brandId,
        categoryIds: categoryIdsOf([
          p.primaryCategory.path,
          ...p.categories.map((c) => c.category.path),
        ]),
        isPreorder: p.isPreorder,
        reserves,
        deliveryChargeOverrideP: p.deliveryChargeOverrideP,
        imageMediaId: media?.id ?? null,
      } satisfies CartLineDetail;
    });
  }

  toView(
    lines: CartLineDetail[],
    promo: PromoResult = EMPTY_PROMO,
    codes: string[] = [],
  ): CartView {
    return {
      items: lines.map((l) => ({
        variantId: l.variantId,
        productId: l.productId,
        slug: l.slug,
        titleEn: l.titleEn,
        titleBn: l.titleBn,
        optionsTextEn: l.optionsTextEn,
        optionsTextBn: l.optionsTextBn,
        image: l.image,
        qty: l.qty,
        unitPriceP: l.unitPriceP,
        compareAtP: l.compareAtP,
        priceAtAddP: l.priceAtAddP,
        priceChanged: l.priceChanged,
        available: l.available,
        maxQty: l.maxQty,
        problem: l.problem,
        flashEndsAt: l.flashEndsAt,
        discountP: promo.lineDiscounts[l.variantId] ?? 0,
      })),
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotalP: subtotalOf(lines),
      discountP: promo.autoDiscountP + promo.couponDiscountP,
      appliedCoupons: promo.applied.map((d) => ({
        couponId: d.couponId,
        name: d.name,
        kind: d.kind,
        type: d.type,
        code: d.code,
        amountP: d.itemDiscountP + d.deliveryDiscountP,
        freeDelivery: d.type === 'free_delivery',
      })),
      codes,
      rejectedCodes: promo.rejected,
    };
  }

  buyerOf(who: CartIdentity, phone?: string | null): FlashBuyer {
    return {
      customerId: who.customerId,
      phone: phone ?? who.customer?.phone ?? null,
      visitorId: who.visitorId,
    };
  }

  /** The live cart's lines, or null when this browser has no cart yet. */
  async linesFor(who: CartIdentity, phone?: string | null) {
    const cart = await this.findLive(this.prisma, who);
    return cart
      ? { cart, lines: await this.lines(this.prisma, cart.id, this.buyerOf(who, phone)) }
      : null;
  }

  /** Engine input for the buyable lines. Zone and delivery are unknown before checkout (zone ''). */
  promoContext(
    who: CartIdentity,
    lines: CartLineDetail[],
    codes: string[],
    extra: Partial<Pick<PromoContext, 'zoneId' | 'deliveryChargeP' | 'phone'>> = {},
  ): PromoContext {
    const promoLines: PromoLine[] = lines
      .filter((l) => l.problem === null)
      .map((l) => ({
        variantId: l.variantId,
        productId: l.productId,
        brandId: l.brandId,
        categoryIds: l.categoryIds,
        qty: l.qty,
        unitPriceP: l.unitPriceP,
        priceSource: l.priceSource,
      }));
    return {
      lines: promoLines,
      zoneId: extra.zoneId ?? '',
      deliveryChargeP: extra.deliveryChargeP ?? 0,
      customerId: who.customerId,
      phone: extra.phone ?? who.customer?.phone ?? null,
      visitorId: who.visitorId,
      platform: 'web',
      paymentMethod: 'cod',
      codes,
      now: new Date(),
    };
  }

  async view(who: CartIdentity): Promise<CartView> {
    const found = await this.linesFor(who);
    if (!found) return EMPTY_CART_VIEW;
    const { cart, lines } = found;
    const promo = await this.promotions.evaluate(
      this.prisma,
      this.promoContext(who, lines, cart.couponCodes),
    );
    let codes = cart.couponCodes;
    if (promo.rejected.length > 0) {
      const dropped = new Set(promo.rejected.map((r) => r.code));
      codes = codes.filter((c) => !dropped.has(c.toUpperCase()));
      await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCodes: codes } });
    }
    return this.toView(lines, promo, codes);
  }

  async setQty(who: CartIdentity, variantId: string, qty: number): Promise<CartView> {
    if (qty <= 0) return this.remove(who, variantId);
    const now = new Date();
    const [variant, checkout, preordersOn] = await Promise.all([
      this.prisma.variant.findUnique({
        where: { id: variantId },
        include: {
          inventory: true,
          product: { include: { primaryCategory: { select: { isActive: true } } } },
        },
      }),
      this.settings.get('checkout'),
      this.settings.get('preorders_enabled'),
    ]);
    const p = variant?.product;
    if (
      !variant ||
      !p ||
      !variant.isActive ||
      p.status !== 'active' ||
      !p.publishedAt ||
      p.publishedAt > now ||
      !p.primaryCategory.isActive ||
      (p.isPreorder && !preordersOn)
    ) {
      throw new CommerceError(
        HttpStatus.NOT_FOUND,
        'VARIANT_NOT_FOUND',
        'This item is not available.',
      );
    }
    if (p.isUpcoming) {
      throw new CommerceError(HttpStatus.CONFLICT, 'UPCOMING', 'This product is not on sale yet.');
    }
    let limit = checkout.maxQtyPerLine;
    if (p.fulfillment === 'stock' && !p.isPreorder) {
      const available = availableQty(variant.inventory);
      if (available === 0) {
        throw new CommerceError(HttpStatus.CONFLICT, 'OUT_OF_STOCK', 'Out of stock.');
      }
      limit = Math.min(limit, available);
    }
    // Flash price: the cart refuses more than is left at that price or than this buyer may take (C56).
    const flash = (await activeFlashFor(this.prisma, [variantId], now)).get(variantId) ?? null;
    let flashAllow = 0;
    if (flash) {
      const used = await flashUsedBy(this.prisma, [flash.itemId], this.buyerOf(who));
      flashAllow = flashAllowance(flash, used.get(flash.itemId) ?? 0);
    }
    const price = effectivePrice(variant, now, flashAllow > 0 ? flash : null);
    if (price.source === 'flash' && Math.min(qty, limit) > flashAllow) {
      throw new CommerceError(
        HttpStatus.CONFLICT,
        'FLASH_LIMIT',
        `Only ${flashAllow} left at flash price.`,
        { remaining: flashAllow },
      );
    }
    const finalQty = Math.min(qty, limit);
    const priceP = price.priceP;

    const cart = await this.getOrCreate(who);
    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, variantId, qty: finalQty, priceAtAddP: priceP },
        // The customer just saw this price, so "price changed" starts over.
        update: { qty: finalQty, priceAtAddP: priceP },
      });
      await tx.cart.update({ where: { id: cart.id }, data: { lastActivityAt: now } });
    });
    return this.view(who);
  }

  async remove(who: CartIdentity, variantId: string): Promise<CartView> {
    const cart = await this.findLive(this.prisma, who);
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { lastActivityAt: new Date() },
      });
    }
    return this.view(who);
  }

  async clear(who: CartIdentity): Promise<CartView> {
    const cart = await this.findLive(this.prisma, who);
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCodes: [] } });
    }
    return EMPTY_CART_VIEW;
  }

  /** Empties a cart inside the caller's transaction (checkout). */
  async clearById(db: Db, cartId: string) {
    await db.cartItem.deleteMany({ where: { cartId } });
    await db.cart.update({
      where: { id: cartId },
      data: { lastActivityAt: new Date(), couponCodes: [] },
    });
  }

  /**
   * Login/signup: the visitor's guest cart folds into the customer's cart (quantities add up, capped
   * at checkout.maxQtyPerLine). The guest cart stays as a read-only merged row.
   */
  async mergeGuest(visitorId: string | null, customerId: string) {
    if (!visitorId) return;
    const maxQty = (await this.settings.get('checkout')).maxQtyPerLine;
    await this.prisma.$transaction(async (tx) => {
      const guest = await tx.cart.findFirst({
        where: { visitorId, customerId: null, mergedIntoId: null },
        include: { items: true },
      });
      if (!guest) return;
      let mine = await tx.cart.findFirst({ where: { customerId, mergedIntoId: null } });
      if (!mine) mine = await tx.cart.create({ data: { customerId, visitorId } });
      for (const item of guest.items) {
        const existing = await tx.cartItem.findUnique({
          where: { cartId_variantId: { cartId: mine.id, variantId: item.variantId } },
        });
        const qty = Math.min((existing?.qty ?? 0) + item.qty, maxQty);
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: mine.id, variantId: item.variantId } },
          create: {
            cartId: mine.id,
            variantId: item.variantId,
            qty,
            priceAtAddP: item.priceAtAddP,
          },
          update: { qty },
        });
      }
      await tx.cartItem.deleteMany({ where: { cartId: guest.id } });
      await tx.cart.update({ where: { id: guest.id }, data: { mergedIntoId: mine.id } });
      const codes = [...new Set([...mine.couponCodes, ...guest.couponCodes])].slice(
        0,
        MAX_CART_CODES,
      );
      await tx.cart.update({
        where: { id: mine.id },
        data: { lastActivityAt: new Date(), couponCodes: codes },
      });
    });
  }
}
