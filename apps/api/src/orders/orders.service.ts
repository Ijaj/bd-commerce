import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottleService } from '../auth/throttle.service';
import { CustomerError } from '../customers/customers.errors';
import { maskPhone, normalizePhone } from '../customers/phone';
import { PrismaService } from '../prisma/prisma.service';
import { returnableQtyByLine } from '../returns/returns.util';
import { SettingsService } from '../settings/settings.service';
import { ImageService } from '../storefront/images';
import { CommerceError } from './commerce.errors';
import type { OrderListQueryDto } from './orders.dto';

const TRACK_WINDOW_SEC = 15 * 60;
const TRACK_LIMIT = 20;
const TRACK_LIMIT_PER_ORDER = 10;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageService,
    private readonly throttle: ThrottleService,
    private readonly settings: SettingsService,
  ) {}

  private async imageMap(mediaIds: (string | null)[]) {
    const ids = [...new Set(mediaIds.filter((x): x is string => x !== null))];
    if (ids.length === 0) return new Map<string, ReturnType<ImageService['set']>>();
    const media = await this.prisma.media.findMany({ where: { id: { in: ids } } });
    return new Map(media.map((m) => [m.id, this.images.set(m)]));
  }

  async list(customerId: string, q: Pick<OrderListQueryDto, 'page' | 'limit'>) {
    const where = { customerId };
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { items: { orderBy: { id: 'asc' } } },
      }),
    ]);
    const images = await this.imageMap(orders.map((o) => o.items[0]?.imageMediaId ?? null));
    return {
      items: orders.map((o) => ({
        orderNo: o.orderNo,
        placedAt: o.placedAt.toISOString(),
        status: o.status,
        grandTotalP: o.grandTotalP,
        itemCount: o.items.reduce((n, i) => n + i.qty - i.qtyCancelled, 0),
        firstImage: (o.items[0]?.imageMediaId && images.get(o.items[0].imageMediaId)) || null,
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async detail(customerId: string, orderNo: string) {
    const o = await this.prisma.order.findFirst({
      where: { orderNo, customerId },
      include: {
        items: { orderBy: { id: 'asc' }, include: { product: { select: { slug: true } } } },
        history: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
        zone: true,
        payments: { orderBy: { initiatedAt: 'asc' }, take: 1 },
      },
    });
    if (!o) throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    const images = await this.imageMap(o.items.map((i) => i.imageMediaId));
    const returnable = await returnableQtyByLine(
      this.prisma,
      o,
      (await this.settings.get('returns')).windowDays,
    );
    return {
      orderNo: o.orderNo,
      placedAt: o.placedAt.toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethodChosen,
      lang: o.lang,
      isPreorder: o.isPreorder,
      customerNote: o.customerNote,
      items: o.items.map((i) => ({
        orderItemId: i.id,
        returnableQty: returnable.get(i.id) ?? 0,
        productId: i.productId,
        variantId: i.variantId,
        slug: i.product.slug,
        title: i.titleSnapshot,
        sku: i.sku,
        optionsText: i.optionsText,
        image: (i.imageMediaId && images.get(i.imageMediaId)) || null,
        qty: i.qty,
        qtyCancelled: i.qtyCancelled,
        unitPriceP: i.unitPriceP,
        lineTotalP: i.lineTotalP,
      })),
      money: {
        subtotalP: o.subtotalP,
        autoDiscountP: o.autoDiscountP,
        couponDiscountP: o.couponDiscountP,
        deliveryChargeP: o.deliveryChargeP,
        deliveryDiscountP: o.deliveryDiscountP,
        grandTotalP: o.grandTotalP,
        paidP: o.paidP,
        refundedP: o.refundedP,
        codDueP: o.codDueP,
      },
      shipTo: {
        name: o.shipName,
        phone: o.shipPhone,
        placeText: o.shipPlaceText,
        line: o.shipLine,
        landmark: o.shipLandmark,
      },
      zone: {
        nameEn: o.zone.nameEn,
        nameBn: o.zone.nameBn,
        etaMinDays: o.zone.etaMinDays,
        etaMaxDays: o.zone.etaMaxDays,
      },
      // Staff notes stay out; the customer sees status and time only.
      history: o.history.map((h) => ({ status: h.toStatus, at: h.at.toISOString() })),
    };
  }

  /** Public tracking: order number plus a phone on the order. Same 404 for every mismatch. */
  async track(orderNo: string, phoneInput: string, ip: string | undefined) {
    const key = `track:ip:${ip ?? 'unknown'}`;
    // Per order number as well, so a botnet cannot guess phones for one order from many IPs.
    const noKey = `track:no:${orderNo.toLowerCase()}`;
    if (
      (await this.throttle.isBlocked(key, TRACK_LIMIT)) ||
      (await this.throttle.isBlocked(noKey, TRACK_LIMIT_PER_ORDER))
    ) {
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Too many lookups. Try again later.',
      );
    }
    const phone = normalizePhone(phoneInput);
    const order = phone
      ? await this.prisma.order.findFirst({
          where: {
            orderNo,
            OR: [{ shipPhone: phone }, { guestPhone: phone }, { customer: { phone } }],
          },
          include: {
            items: true,
            history: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
            zone: true,
          },
        })
      : null;
    if (!order || !phone) {
      await this.throttle.hit(key, TRACK_WINDOW_SEC);
      await this.throttle.hit(noKey, TRACK_WINDOW_SEC);
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'No order matches.');
    }
    return {
      orderNo: order.orderNo,
      status: order.status,
      placedAt: order.placedAt.toISOString(),
      maskedPhone: maskPhone(phone),
      itemCount: order.items.reduce((n, i) => n + i.qty - i.qtyCancelled, 0),
      grandTotalP: order.grandTotalP,
      etaMinDays: order.zone.etaMinDays,
      etaMaxDays: order.zone.etaMaxDays,
      timeline: order.history.map((h) => ({ status: h.toStatus, at: h.at.toISOString() })),
    };
  }
}
