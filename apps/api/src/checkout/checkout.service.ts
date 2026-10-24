import { ConflictException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { type CartLineDetail, CartService, subtotalOf } from '../cart/cart.service';
import type { CartIdentity } from '../cart/cart-identity.service';
import { OtpService } from '../customers/otp.service';
import { normalizePhone } from '../customers/phone';
import { DeliveryService } from '../delivery/delivery.service';
import type { DeliveryZone, Prisma } from '../generated/prisma/client';
import { GeoService, type PlaceNames } from '../geo/geo.service';
import { InventoryService } from '../inventory/inventory.service';
import { CommerceError } from '../orders/commerce.errors';
import { OrderNotifyService } from '../orders/order-notify.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { SettingsService } from '../settings/settings.service';
import type { CheckoutPlaceDto, CheckoutQuoteDto } from './checkout.dto';

const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60;
const DHAKA_OFFSET_MS = 6 * 60 * 60_000;

interface Meta {
  ip?: string;
  userAgent?: string;
}

interface Pricing {
  subtotalP: number;
  deliveryChargeP: number;
  deliveryDiscountP: number;
  grandTotalP: number;
  freeDeliveryRemainingP: number | null;
}

type Problem = 'CART_EMPTY' | 'CART_CHANGED' | 'OUT_OF_STOCK';

/** YYMM in Bangladesh time, so an order at 1 a.m. on the 1st gets the new month. */
function yymm(now: Date) {
  const d = new Date(now.getTime() + DHAKA_OFFSET_MS);
  return `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function problemsOf(lines: CartLineDetail[]): Problem[] {
  if (lines.length === 0) return ['CART_EMPTY'];
  const out = new Set<Problem>();
  for (const l of lines) {
    if (l.problem === 'out_of_stock' || l.problem === 'qty_reduced') out.add('OUT_OF_STOCK');
    else if (l.problem !== null) out.add('CART_CHANGED');
  }
  return [...out];
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly delivery: DeliveryService,
    private readonly geo: GeoService,
    private readonly inventory: InventoryService,
    private readonly otp: OtpService,
    private readonly settings: SettingsService,
    private readonly notify: OrderNotifyService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async place3(loc: { districtId: number; upazilaId: number; areaId?: number | null }) {
    const names = await this.geo.resolve(loc.districtId, loc.upazilaId, loc.areaId);
    if (!names) {
      throw new CommerceError(
        HttpStatus.BAD_REQUEST,
        'ADDRESS_INVALID',
        'That delivery location is not valid.',
      );
    }
    const zone = await this.delivery.zoneFor(loc.districtId, loc.upazilaId, loc.areaId);
    if (!zone) {
      throw new CommerceError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'NO_DELIVERY_ZONE',
        'We do not deliver there yet.',
      );
    }
    return { names, zone };
  }

  private price(zone: DeliveryZone, lines: CartLineDetail[]): Pricing {
    const ok = lines.filter((l) => l.problem === null);
    const subtotalP = subtotalOf(ok);
    const charge = this.delivery.charge(zone, {
      subtotalP,
      weightG: ok.reduce((g, l) => g + (l.weightG ?? 0) * l.qty, 0),
      overridesP: ok.flatMap((l) =>
        l.deliveryChargeOverrideP === null ? [] : [l.deliveryChargeOverrideP],
      ),
    });
    return {
      subtotalP,
      deliveryChargeP: charge.deliveryChargeP,
      deliveryDiscountP: charge.deliveryDiscountP,
      freeDeliveryRemainingP: charge.freeDeliveryRemainingP,
      grandTotalP: subtotalP + charge.deliveryChargeP - charge.deliveryDiscountP,
    };
  }

  /** Q81: guests (and anyone without a verified phone) need an OTP from the configured amount up. */
  private async otpRequired(who: CartIdentity, grandTotalP: number) {
    if (who.customer?.phoneVerifiedAt) return false;
    return grandTotalP >= (await this.settings.get('checkout')).guestOtpAboveP;
  }

  async quote(
    who: CartIdentity,
    loc: { districtId: number; upazilaId: number; areaId?: number | null },
  ) {
    const { zone } = await this.place3(loc);
    const lines = (await this.cart.linesFor(who))?.lines ?? [];
    const pricing = this.price(zone, lines);
    return {
      zone: {
        id: zone.id,
        nameEn: zone.nameEn,
        nameBn: zone.nameBn,
        etaMinDays: zone.etaMinDays,
        etaMaxDays: zone.etaMaxDays,
      },
      subtotalP: pricing.subtotalP,
      deliveryChargeP: pricing.deliveryChargeP,
      deliveryDiscountP: pricing.deliveryDiscountP,
      grandTotalP: pricing.grandTotalP,
      freeDeliveryRemainingP: pricing.freeDeliveryRemainingP,
      guestOtpRequired: await this.otpRequired(who, pricing.grandTotalP),
      problems: problemsOf(lines),
    } satisfies CheckoutQuoteDto;
  }

  async sendGuestOtp(phoneInput: string, ip: string | undefined) {
    await this.otp.countIp(ip);
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      throw new CommerceError(
        HttpStatus.BAD_REQUEST,
        'ADDRESS_INVALID',
        'Enter a valid Bangladesh mobile number.',
      );
    }
    return this.otp.request(phone, 'guest_cod', ip, true);
  }

  async place(who: CartIdentity, input: CheckoutPlaceDto, meta: Meta) {
    const owner = who.customerId ?? who.visitorId ?? 'anon';
    const idemKey = `checkout:idem:${owner}:${input.idempotencyKey}`;
    const claimed = await this.redis.set(idemKey, 'pending', 'EX', IDEMPOTENCY_TTL_SEC, 'NX');
    if (claimed !== 'OK') {
      const prior = await this.redis.get(idemKey);
      if (prior && prior !== 'pending') return JSON.parse(prior) as PlacedResult;
      throw new CommerceError(
        HttpStatus.CONFLICT,
        'IDEMPOTENCY_IN_PROGRESS',
        'This order is already being placed.',
      );
    }
    const ipKey = await this.takeIpSlot(meta.ip);
    try {
      const result = await this.placeOnce(who, input, meta);
      await this.redis.set(idemKey, JSON.stringify(result), 'EX', IDEMPOTENCY_TTL_SEC);
      return result;
    } catch (e) {
      // A failed attempt must not block the customer's retry with the same key, nor use up its slot.
      await this.redis.del(idemKey);
      await this.redis.decr(ipKey);
      throw e;
    }
  }

  /** C44: placed orders per IP per hour, for guests and customers alike. Taken up front, given back on failure. */
  private async takeIpSlot(ip: string | undefined) {
    const { perIpPerHour } = await this.settings.get('guest_orders');
    const key = `orders:ip:${ip ?? 'unknown'}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 3600);
    if (n > perIpPerHour) {
      await this.redis.decr(key);
      throw new CommerceError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ORDERS',
        'Too many orders from this network. Try again later.',
      );
    }
    return key;
  }

  /** C44: a guest phone may have few open orders and a capped order value per day. */
  private async assertGuestLimits(
    db: Prisma.TransactionClient,
    phone: string,
    grandTotalP: number,
  ) {
    const limits = await this.settings.get('guest_orders');
    const open = await db.order.count({
      where: {
        customerId: null,
        guestPhone: phone,
        status: { notIn: ['delivered', 'completed', 'cancelled'] },
      },
    });
    if (open >= limits.maxOpenPerPhone) {
      throw new CommerceError(
        HttpStatus.TOO_MANY_REQUESTS,
        'GUEST_LIMIT',
        'This phone already has the maximum number of open orders. Sign up or wait for delivery.',
        { reason: 'open_orders' },
      );
    }
    const today = await db.order.aggregate({
      _sum: { grandTotalP: true },
      where: {
        customerId: null,
        guestPhone: phone,
        status: { not: 'cancelled' },
        placedAt: { gte: new Date(Date.now() - 24 * 3600_000) },
      },
    });
    if ((today._sum.grandTotalP ?? 0) + grandTotalP > limits.dailyCapP) {
      throw new CommerceError(
        HttpStatus.TOO_MANY_REQUESTS,
        'GUEST_LIMIT',
        'Daily order value limit reached for guests. Sign up to order more.',
        { reason: 'daily_cap' },
      );
    }
  }

  private async resolveShipTo(who: CartIdentity, input: CheckoutPlaceDto) {
    if (input.addressId !== undefined) {
      if (!who.customerId) {
        throw new CommerceError(
          HttpStatus.BAD_REQUEST,
          'ADDRESS_INVALID',
          'Sign in to use a saved address.',
        );
      }
      const a = await this.prisma.customerAddress.findFirst({
        where: { id: input.addressId, customerId: who.customerId },
      });
      if (!a)
        throw new CommerceError(HttpStatus.BAD_REQUEST, 'ADDRESS_INVALID', 'Address not found.');
      return {
        name: a.name,
        phone: a.phone,
        districtId: a.districtId,
        upazilaId: a.upazilaId,
        areaId: a.areaId,
        line: a.line,
        landmark: a.landmark,
      };
    }
    const a = input.address;
    const phone = a ? normalizePhone(a.phone) : null;
    if (!a || !phone) {
      throw new CommerceError(
        HttpStatus.BAD_REQUEST,
        'ADDRESS_INVALID',
        'Enter a valid Bangladesh mobile number.',
      );
    }
    return { ...a, phone, landmark: a.landmark ?? null };
  }

  private async placeOnce(who: CartIdentity, input: CheckoutPlaceDto, meta: Meta) {
    const ship = await this.resolveShipTo(who, input);
    const { names, zone } = await this.place3(ship);

    let guestPhone: string | null = null;
    if (!who.customer) {
      const g = input.guest;
      guestPhone = g ? normalizePhone(g.phone) : null;
      if (!g || !guestPhone) {
        throw new CommerceError(
          HttpStatus.BAD_REQUEST,
          'GUEST_REQUIRED',
          'Your name and a valid phone are needed.',
        );
      }
    }

    // Cheap pre-check outside the transaction so a bad cart never burns the customer's OTP.
    const found = await this.cart.linesFor(who);
    this.assertBuyable(found?.lines ?? []);
    const pre = this.price(zone, found?.lines ?? []);

    // Before the OTP is spent: a refused order must not burn the code.
    if (guestPhone) await this.assertGuestLimits(this.prisma, guestPhone, pre.grandTotalP);

    let otpVerified = false;
    if (await this.otpRequired(who, pre.grandTotalP)) {
      if (!input.otpCode) {
        throw new CommerceError(
          HttpStatus.BAD_REQUEST,
          'OTP_REQUIRED',
          'Verify your phone with the SMS code.',
        );
      }
      await this.otp.consume(
        who.customer?.phone ?? guestPhone ?? ship.phone,
        'guest_cod',
        input.otpCode,
      );
      otpVerified = true;
    }

    const now = new Date();
    const cartId = found?.cart.id as string;
    const placed = await this.prisma.$transaction(
      async (tx) => {
        // One order per cart: a second place (another key, another tab) waits here, then finds an empty cart.
        await tx.$queryRaw`SELECT id FROM carts WHERE id = ${cartId}::uuid FOR UPDATE`;
        const lines = await this.cart.lines(tx, cartId);
        this.assertBuyable(lines);
        const money = this.price(zone, lines);
        if (guestPhone) {
          // Serialises this phone's orders so two carts cannot both slip under the limits.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`guest-orders:${guestPhone}`}))`;
          await this.assertGuestLimits(tx, guestPhone, money.grandTotalP);
        }
        // The total can have grown since the pre-check (price or cart change): ask for the OTP then.
        if (!otpVerified && (await this.otpRequired(who, money.grandTotalP))) {
          throw new CommerceError(
            HttpStatus.BAD_REQUEST,
            'OTP_REQUIRED',
            'Verify your phone with the SMS code.',
          );
        }

        const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_no_seq') AS n`;
        const n = seq[0]?.n ?? 0n;
        const orderNo = `${yymm(now)}-${String(n).padStart(5, '0')}`;
        const bn = input.lang === 'bn';
        const customer = who.customer;

        const order = await tx.order.create({
          data: {
            orderNo,
            customerId: customer?.id ?? null,
            guestName: customer ? null : (input.guest?.name ?? null),
            guestPhone,
            guestEmail: customer ? null : (input.guest?.email?.toLowerCase() ?? null),
            visitorId: who.visitorId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            lang: input.lang,
            shipName: ship.name,
            shipPhone: ship.phone,
            shipDivisionId: names.divisionId,
            shipDistrictId: ship.districtId,
            shipUpazilaId: ship.upazilaId,
            shipAreaId: ship.areaId ?? null,
            shipPlaceText: this.geo.placeText(names as PlaceNames, input.lang),
            shipLine: ship.line,
            shipLandmark: ship.landmark,
            zoneId: zone.id,
            customerNote: input.note ?? null,
            status: 'processing',
            paymentStatus: 'unpaid',
            paymentMethodChosen: 'cod',
            isPreorder: lines.some((l) => l.isPreorder),
            subtotalP: money.subtotalP,
            deliveryChargeP: money.deliveryChargeP,
            deliveryDiscountP: money.deliveryDiscountP,
            grandTotalP: money.grandTotalP,
            codDueP: money.grandTotalP,
            guestOtpVerifiedAt: otpVerified ? now : null,
            placedAt: now,
            items: {
              createMany: {
                data: lines.map((l) => ({
                  sellerId: l.sellerId,
                  productId: l.productId,
                  variantId: l.variantId,
                  titleSnapshot: bn ? (l.titleBn ?? l.titleEn) : l.titleEn,
                  sku: l.sku,
                  optionsText: bn ? l.optionsTextBn : l.optionsTextEn,
                  imageMediaId: l.imageMediaId,
                  qty: l.qty,
                  unitBaseP: l.unitBaseP,
                  unitPriceP: l.unitPriceP,
                  priceSource: l.priceSource,
                  weightG: l.weightG,
                  returnWindowDays: l.returnWindowDays,
                  lineTotalP: l.unitPriceP * l.qty,
                })),
              },
            },
          },
        });
        // Separate writes: nested ones run in parallel, which a single transaction connection dislikes.
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: null,
            toStatus: 'processing',
            actorType: customer ? 'customer' : 'system',
            actorId: customer?.id ?? null,
            note: 'Order placed',
          },
        });
        await tx.payment.create({
          data: {
            orderId: order.id,
            method: 'cod',
            purpose: 'full',
            amountP: money.grandTotalP,
            status: 'initiated',
          },
        });

        // Sorted so two orders sharing variants lock rows in the same order (no deadlock).
        const reserving = lines
          .filter((l) => l.reserves)
          .sort((a, b) => a.variantId.localeCompare(b.variantId));
        for (const l of reserving) {
          try {
            await this.inventory.move(tx, {
              variantId: l.variantId,
              qtyDelta: 0,
              reservedDelta: l.qty,
              reason: 'order_reserve',
              refType: 'order',
              refId: order.id,
            });
          } catch (e) {
            if (e instanceof ConflictException) {
              throw new CommerceError(
                HttpStatus.CONFLICT,
                'OUT_OF_STOCK',
                'Some items just sold out.',
                {
                  variantId: l.variantId,
                },
              );
            }
            throw e;
          }
        }
        await this.cart.clearById(tx, cartId);
        return { order, money };
      },
      { timeout: 20_000 },
    );

    const { order } = placed;
    this.notify.placed({
      orderNo: order.orderNo,
      lang: input.lang,
      grandTotalP: order.grandTotalP,
      codDueP: order.codDueP,
      phone: who.customer?.phone ?? guestPhone,
      email: who.customer?.email ?? input.guest?.email?.toLowerCase() ?? null,
      etaMinDays: zone.etaMinDays,
      etaMaxDays: zone.etaMaxDays,
    });
    return {
      orderNo: order.orderNo,
      orderId: order.id,
      grandTotalP: order.grandTotalP,
      codDueP: order.codDueP,
    } satisfies PlacedResult;
  }

  private assertBuyable(lines: CartLineDetail[]) {
    const problems = problemsOf(lines);
    if (problems.includes('CART_EMPTY')) {
      throw new CommerceError(HttpStatus.CONFLICT, 'CART_EMPTY', 'Your cart is empty.');
    }
    if (problems.includes('OUT_OF_STOCK')) {
      throw new CommerceError(HttpStatus.CONFLICT, 'OUT_OF_STOCK', 'Some items are out of stock.', {
        variantIds: lines
          .filter((l) => l.problem === 'out_of_stock' || l.problem === 'qty_reduced')
          .map((l) => l.variantId),
      });
    }
    if (problems.includes('CART_CHANGED')) {
      throw new CommerceError(
        HttpStatus.CONFLICT,
        'CART_CHANGED',
        'Some items are no longer available.',
        {
          variantIds: lines.filter((l) => l.problem !== null).map((l) => l.variantId),
        },
      );
    }
  }
}

export interface PlacedResult {
  orderNo: string;
  orderId: string;
  grandTotalP: number;
  codDueP: number;
}
