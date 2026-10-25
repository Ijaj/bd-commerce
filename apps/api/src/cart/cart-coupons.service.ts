import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottleService } from '../auth/throttle.service';
import { CommerceError } from '../orders/commerce.errors';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/engine/promotions.service';
import type { CodeRejectReason } from '../promotions/types';
import { CartService, type CartView, MAX_CART_CODES } from './cart.service';
import type { CartIdentity } from './cart-identity.service';

const CODE_TRIES = 10;
const CODE_TRY_WINDOW_SEC = 15 * 60;

const REJECT_TEXT: Record<CodeRejectReason, string> = {
  NOT_FOUND: 'This coupon code does not exist.',
  INACTIVE: 'This coupon is not active.',
  NOT_STARTED: 'This coupon has not started yet.',
  EXPIRED: 'This coupon has expired.',
  MIN_ORDER: 'Your cart is below the minimum order for this coupon.',
  MIN_QTY: 'Add more items to use this coupon.',
  NO_MATCHING_ITEMS: 'This coupon does not apply to the items in your cart.',
  SEGMENT: 'This coupon is not available for your account.',
  LIMIT_REACHED: 'This coupon has reached its usage limit.',
  BUDGET_REACHED: 'This coupon has been fully used.',
  PLATFORM: 'This coupon is not valid here.',
  PAYMENT_METHOD: 'This coupon is not valid for this payment method.',
  ZONE: 'This coupon is not valid for your delivery area.',
  NOT_STACKABLE: 'This coupon cannot be combined with the discounts already applied.',
  ONLY_REGULAR_PRICE: 'This coupon only applies to items that are not on sale.',
  ALREADY_USED: 'This coupon code has already been used.',
  LOGIN_REQUIRED: 'Sign in to use this coupon.',
};

/** Typed coupon codes on the cart: add, remove, and "codes you could use" suggestions. */
@Injectable()
export class CartCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly throttle: ThrottleService,
    private readonly promotions: PromotionsService,
  ) {}

  private tryKey(who: CartIdentity) {
    return `coupon-try:${who.customerId ?? who.visitorId ?? who.ip ?? 'unknown'}`;
  }

  /** Adds a typed code; 422 COUPON_INVALID (with `reason`) when it cannot apply to this cart now. */
  async applyCode(who: CartIdentity, raw: string): Promise<CartView> {
    const code = raw.trim().toUpperCase();
    const key = this.tryKey(who);
    if (await this.throttle.isBlocked(key, CODE_TRIES)) {
      throw new CommerceError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Too many wrong codes. Try again later.',
      );
    }
    const invalid = async (reason: CodeRejectReason) => {
      await this.throttle.hit(key, CODE_TRY_WINDOW_SEC);
      return new CommerceError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'COUPON_INVALID',
        REJECT_TEXT[reason],
        { reason },
      );
    };
    const found = await this.cart.linesFor(who);
    if (!found || found.lines.length === 0) throw await invalid('NO_MATCHING_ITEMS');
    const { cart, lines } = found;
    if (cart.couponCodes.some((c) => c.toUpperCase() === code)) return this.cart.view(who);
    if (cart.couponCodes.length >= MAX_CART_CODES) throw await invalid('NOT_STACKABLE');

    const codes = [...cart.couponCodes, code];
    const promo = await this.promotions.evaluate(
      this.prisma,
      this.cart.promoContext(who, lines, codes),
    );
    const mine = promo.rejected.find((r) => r.code === code);
    if (mine) throw await invalid(mine.reason);
    const dropped = new Set(promo.rejected.map((r) => r.code));
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCodes: codes.filter((c) => !dropped.has(c)), lastActivityAt: new Date() },
    });
    return this.cart.view(who);
  }

  async removeCode(who: CartIdentity, raw: string): Promise<CartView> {
    const code = raw.trim().toUpperCase();
    const cart = await this.cart.findLive(this.prisma, who);
    const has = cart?.couponCodes.some((c) => c.toUpperCase() === code);
    if (cart && has) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { couponCodes: cart.couponCodes.filter((c) => c.toUpperCase() !== code) },
      });
    }
    return this.cart.view(who);
  }

  async suggestions(who: CartIdentity) {
    const found = await this.cart.linesFor(who);
    if (!found) return [];
    return this.promotions.suggest(
      this.prisma,
      this.cart.promoContext(who, found.lines, found.cart.couponCodes),
    );
  }
}
