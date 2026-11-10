import { HttpStatus, Injectable } from '@nestjs/common';
import { DeliveryService } from '../delivery/delivery.service';
import type { Prisma } from '../generated/prisma/client';
import { CommerceError } from '../orders/commerce.errors';
import { OrderNotifyService } from '../orders/order-notify.service';
import { adjustSoldCount } from '../orders/sold-count';
import { PrismaService } from '../prisma/prisma.service';
import { allocate } from '../promotions/engine/allocate';
import { readDiscounts } from '../promotions/engine/order-discounts';
import { PromotionsService } from '../promotions/engine/promotions.service';
import { claimFlash, type FlashBuyer } from '../promotions/flash/flash-core';
import type { PromoContext } from '../promotions/types';
import { SettingsService } from '../settings/settings.service';
import type { OrderEditInputDto } from './order-edit.dto';
import { OrderEditError } from './order-edit.errors';
import { parseLines, promoLines, soldDeltas, typedCodes } from './order-edit-input';
import { buildLines, type UnitPrice } from './order-edit-lines';
import { assertAddable, priceAddedUnits } from './order-edit-pricing';
import {
  type CurLine,
  EDITABLE_STATUSES,
  FROZEN_SHIPMENTS,
  LOCAL_SHIPMENTS,
  loadVariants,
  type Money,
  type Snapshot,
  snapshotLines,
} from './order-edit-support';
import { OrderEditWriter } from './order-edit-writer';
import { orderKey } from './order-lookup';

/** Thrown inside the transaction to roll a preview back. */
class DryRun extends Error {
  constructor(readonly result: EditResult) {
    super('dry-run');
  }
}

export interface PreviewLine {
  orderItemId: string | null;
  variantId: string;
  title: string;
  sku: string;
  optionsText: string | null;
  qty: number;
  unitPriceP: number;
  lineTotalP: number;
  discountP: number;
  change: 'same' | 'qty' | 'price' | 'added' | 'removed';
}

export interface EditPreview {
  lines: PreviewLine[];
  money: Money;
  before: Money;
  zone: { id: string; name: string };
  warnings: string[];
}

export interface EditResult {
  orderId: string;
  orderNo: string;
  preview: EditPreview;
  edit: { id: string; createdAt: string } | null;
}

const moneyOf = (o: {
  subtotalP: number;
  autoDiscountP: number;
  couponDiscountP: number;
  deliveryChargeP: number;
  deliveryDiscountP: number;
  grandTotalP: number;
  codDueP: number;
}): Money => ({
  subtotalP: o.subtotalP,
  autoDiscountP: o.autoDiscountP,
  couponDiscountP: o.couponDiscountP,
  deliveryChargeP: o.deliveryChargeP,
  deliveryDiscountP: o.deliveryDiscountP,
  grandTotalP: o.grandTotalP,
  codDueP: o.codDueP,
});

@Injectable()
export class OrderEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: OrderEditWriter,
    private readonly delivery: DeliveryService,
    private readonly promotions: PromotionsService,
    private readonly settings: SettingsService,
    private readonly notify: OrderNotifyService,
  ) {}

  /** Runs the whole edit and rolls it back: the preview is exactly what a save would store. */
  async preview(idOrNo: string, staffId: string, input: OrderEditInputDto) {
    try {
      await this.prisma.$transaction((tx) => this.run(tx, idOrNo, staffId, input, true), {
        timeout: 20_000,
      });
    } catch (e) {
      if (e instanceof DryRun) return e.result.preview;
      throw e;
    }
    throw new Error('unreachable');
  }

  async save(idOrNo: string, staffId: string, input: OrderEditInputDto) {
    const result = await this.prisma.$transaction(
      (tx) => this.run(tx, idOrNo, staffId, input, false),
      {
        timeout: 20_000,
      },
    );
    // After commit; the notifier never throws.
    await this.notify.event(result.orderId, 'edited', { editId: result.edit?.id });
    return result;
  }

  async history(idOrNo: string) {
    const o = await this.prisma.order.findUnique({
      where: orderKey(idOrNo),
      select: { id: true },
    });
    if (!o) throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    const rows = await this.prisma.orderEdit.findMany({
      where: { orderId: o.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const ids = [...new Set(rows.map((r) => r.staffId))];
    const staff = ids.length
      ? await this.prisma.staff.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const byId = new Map(staff.map((s) => [s.id, s]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        staff: byId.get(r.staffId) ?? null,
        note: r.note,
        customerNotifiedAt: r.customerNotifiedAt?.toISOString() ?? null,
        before: r.before as unknown as Snapshot,
        after: r.after as unknown as Snapshot,
      })),
    };
  }

  private async run(
    tx: Prisma.TransactionClient,
    idOrNo: string,
    staffId: string,
    input: OrderEditInputDto,
    dryRun: boolean,
  ): Promise<EditResult> {
    const found = await tx.order.findUnique({ where: orderKey(idOrNo), select: { id: true } });
    if (!found)
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    // Row lock: a concurrent booking/cancel must not slip past the checks below.
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${found.id}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: found.id },
      include: {
        customer: { select: { phone: true } },
        zone: { select: { id: true, nameEn: true } },
        items: { orderBy: { id: 'asc' } },
        shipments: { select: { id: true, status: true } },
        invoices: { select: { id: true } },
      },
    });
    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new OrderEditError(
        HttpStatus.CONFLICT,
        'ORDER_NOT_EDITABLE',
        `An order that is ${order.status} cannot be edited.`,
      );
    }
    if (order.shipments.some((s) => FROZEN_SHIPMENTS.includes(s.status))) {
      throw new OrderEditError(
        HttpStatus.CONFLICT,
        'SHIPMENT_BOOKED',
        'A shipment is already booked or sent; the order can no longer be edited.',
      );
    }

    const warnings: string[] = [];
    const cur: CurLine[] = order.items
      .filter((i) => i.qty - i.qtyCancelled > 0)
      .map((i) => ({ ...i, qty: i.qty - i.qtyCancelled }));
    const before: Snapshot = {
      ship: {
        name: order.shipName,
        phone: order.shipPhone,
        placeText: order.shipPlaceText,
        line: order.shipLine,
        landmark: order.shipLandmark,
        zoneId: order.zone.id,
        zoneName: order.zone.nameEn,
      },
      lines: snapshotLines(cur.map((c) => ({ ...c, title: c.titleSnapshot }))),
      money: moneyOf(order),
      discounts: readDiscounts(order.discountsJson),
    };

    const reqs = parseLines(input, cur);
    const ship = await this.writer.resolveShip(tx, order, input);
    const variantIds = [
      ...new Set([...cur.map((c) => c.variantId), ...reqs.map((r) => r.variantId)]),
    ];
    const variants = await loadVariants(tx, variantIds);
    const now = new Date();
    const [checkout, preordersOn] = await Promise.all([
      this.settings.get('checkout'),
      this.settings.get('preorders_enabled'),
    ]);

    // Validate added units before anything is written.
    const curQty = new Map<string, number>();
    for (const c of cur) curQty.set(c.variantId, (curQty.get(c.variantId) ?? 0) + c.qty);
    const wantQty = new Map<string, number>();
    for (const r of reqs) wantQty.set(r.variantId, (wantQty.get(r.variantId) ?? 0) + r.qty);
    // Units that need today's price: new lines and the added part of increased lines.
    const extraQty = new Map<string, number>();
    for (const r of reqs) {
      const extra = r.item ? Math.max(r.qty - r.item.qty, 0) : r.qty;
      if (extra > 0) extraQty.set(r.variantId, (extraQty.get(r.variantId) ?? 0) + extra);
    }
    assertAddable(extraQty, wantQty, variants, {
      now,
      maxQtyPerLine: checkout.maxQtyPerLine,
      preordersOn,
    });
    const newTotal = [...wantQty.values()].reduce((a, b) => a + b, 0);
    if (newTotal === 0) {
      throw new OrderEditError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'EMPTY_ORDER',
        'An order cannot have no items; cancel it instead.',
      );
    }

    // Give the old promotions back (coupon uses, budget, bulk codes, flash stock), then re-take them.
    const oldCodes = typedCodes(before.discounts);
    await this.promotions.reverse(tx, order.id);

    // Kept flash units keep their price (and their claim on the flash stock).
    const keptFlash = new Map<string, number>();
    for (const r of reqs) {
      if (r.item?.priceSource !== 'flash' || !r.item.flashSaleItemId) continue;
      const kept = Math.min(r.item.qty, r.qty);
      keptFlash.set(r.item.flashSaleItemId, (keptFlash.get(r.item.flashSaleItemId) ?? 0) + kept);
    }
    for (const [itemId, qty] of keptFlash) {
      await tx.$executeRaw`UPDATE flash_sale_items SET qty_sold = qty_sold + ${qty} WHERE id = ${itemId}::uuid`;
    }

    const buyerPhone = order.customer?.phone ?? order.guestPhone;
    const buyer: FlashBuyer = {
      customerId: order.customerId,
      phone: buyerPhone,
      visitorId: order.visitorId,
    };
    const prices = await priceAddedUnits(tx, {
      extraQty,
      keptFlash,
      variants,
      buyer,
      lang: order.lang,
      now,
    });
    const priceFor = (variantId: string) => prices.get(variantId) as UnitPrice;
    const { out, removed } = buildLines(reqs, cur, priceFor);

    // Delivery + promotions on the resulting lines.
    const subtotalP = out.reduce((n, l) => n + l.unitPriceP * l.qty, 0);
    const charge = this.delivery.charge(ship.zone, {
      subtotalP,
      weightG: out.reduce((g, l) => g + (l.weightG ?? 0) * l.qty, 0),
      overridesP: out.flatMap((l) => {
        const o = variants.get(l.variantId)?.product.deliveryChargeOverrideP;
        return o === null || o === undefined ? [] : [o];
      }),
    });
    const engineLines = promoLines(out, variants);
    const ctx: PromoContext = {
      lines: engineLines,
      zoneId: ship.zone.id,
      deliveryChargeP: charge.deliveryChargeP - charge.deliveryDiscountP,
      customerId: order.customerId,
      phone: buyerPhone,
      visitorId: order.visitorId,
      platform: order.platform === 'app' ? 'app' : 'web',
      paymentMethod: order.paymentMethodChosen,
      codes: oldCodes,
      now,
    };
    const promo = await this.promotions.evaluate(tx, ctx);
    for (const r of promo.rejected) {
      warnings.push(`Coupon ${r.code} no longer applies (${r.reason}) and was removed.`);
    }
    const lost = before.discounts.filter(
      (d) => d.kind === 'auto' && !promo.applied.some((a) => a.couponId === d.couponId),
    );
    for (const d of lost) warnings.push(`Automatic offer "${d.name}" no longer applies.`);

    // Split each variant's discount over its lines (largest remainder: parts add up exactly).
    for (const [variantId, total] of Object.entries(promo.lineDiscounts)) {
      const lines = out.filter((l) => l.variantId === variantId);
      const parts = allocate(
        total,
        lines.map((l) => l.unitPriceP * l.qty),
      );
      lines.forEach((l, i) => {
        l.discountP = parts[i] ?? 0;
      });
    }
    const deliveryDiscountP = charge.deliveryDiscountP + promo.deliveryDiscountP;
    const grandTotalP =
      subtotalP -
      promo.autoDiscountP -
      promo.couponDiscountP +
      charge.deliveryChargeP -
      deliveryDiscountP;
    const money: Money = {
      subtotalP,
      autoDiscountP: promo.autoDiscountP,
      couponDiscountP: promo.couponDiscountP,
      deliveryChargeP: charge.deliveryChargeP,
      deliveryDiscountP,
      grandTotalP,
      codDueP: Math.max(0, grandTotalP - order.paidP),
    };

    // ---- writes ----
    const localShipments = order.shipments.filter((s) => LOCAL_SHIPMENTS.includes(s.status));
    if (localShipments.length > 0) {
      await tx.shipment.updateMany({
        where: { id: { in: localShipments.map((s) => s.id) } },
        data: { status: 'cancelled' },
      });
      warnings.push(
        `${localShipments.length} warehouse shipment(s) will be cancelled; create them again after saving.`,
      );
    }
    if (order.invoices.length > 0) warnings.push('An invoice was already issued for this order.');

    await this.writer.writeLines(tx, order.id, out, removed);
    await this.writer.moveStock(tx, order.id, staffId, variants, curQty, out);
    await adjustSoldCount(tx, soldDeltas(cur, out), 1);
    const newClaims = new Map<string, number>();
    for (const l of out) {
      if (l.itemId === null && l.flashItemId) {
        newClaims.set(l.flashItemId, (newClaims.get(l.flashItemId) ?? 0) + l.qty);
      } else if (l.itemId !== null && l.flashItemId) {
        const was = cur.find((c) => c.id === l.itemId);
        const extra = l.qty - Math.min(was?.qty ?? 0, l.qty);
        if (extra > 0) newClaims.set(l.flashItemId, (newClaims.get(l.flashItemId) ?? 0) + extra);
      }
    }
    await claimFlash(
      tx,
      [...newClaims].map(([itemId, qty]) => ({ itemId, qty })),
    );

    // A coupon redeemed again needs a fresh row (unique per order and coupon): drop its reversed one.
    if (promo.applied.length > 0) {
      await tx.couponRedemption.deleteMany({
        where: {
          orderId: order.id,
          status: 'reversed',
          couponId: { in: promo.applied.map((a) => a.couponId) },
        },
      });
    }
    await this.promotions.redeem(tx, order.id, ctx, promo);

    const discounts = promo.applied.map((d) => ({
      couponId: d.couponId,
      name: d.name,
      kind: d.kind,
      type: d.type,
      code: d.code,
      amountP: d.itemDiscountP,
      deliveryP: d.deliveryDiscountP,
    }));
    await tx.order.update({
      where: { id: order.id },
      data: {
        shipName: ship.name,
        shipPhone: ship.phone,
        shipDivisionId: ship.divisionId,
        shipDistrictId: ship.districtId,
        shipUpazilaId: ship.upazilaId,
        shipAreaId: ship.areaId,
        shipPlaceText: ship.placeText,
        shipLine: ship.line,
        shipLandmark: ship.landmark,
        zoneId: ship.zone.id,
        customerNote: input.customerNote === undefined ? order.customerNote : input.customerNote,
        isPreorder: out.some((l) => variants.get(l.variantId)?.product.isPreorder),
        ...money,
        discountsJson: discounts as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.payment.updateMany({
      where: { orderId: order.id, status: 'initiated', method: 'cod' },
      data: { amountP: grandTotalP },
    });
    const commission = await tx.affiliateCommission.findUnique({ where: { orderId: order.id } });
    if (commission && commission.status === 'pending') {
      const baseP = out.reduce((n, l) => n + Math.max(0, l.unitPriceP * l.qty - l.discountP), 0);
      await tx.affiliateCommission.update({
        where: { orderId: order.id },
        data: { baseP, amountP: Math.round((baseP * commission.commissionBp) / 10_000) },
      });
    }

    const after: Snapshot = {
      ship: {
        name: ship.name,
        phone: ship.phone,
        placeText: ship.placeText,
        line: ship.line,
        landmark: ship.landmark,
        zoneId: ship.zone.id,
        zoneName: ship.zone.nameEn,
      },
      lines: snapshotLines(out),
      money,
      discounts,
    };
    const preview: EditPreview = {
      lines: [
        ...out.map((l) => ({
          orderItemId: l.itemId,
          variantId: l.variantId,
          title: l.title,
          sku: l.sku,
          optionsText: l.optionsText,
          qty: l.qty,
          unitPriceP: l.unitPriceP,
          lineTotalP: l.unitPriceP * l.qty,
          discountP: l.discountP,
          change: l.change,
        })),
        ...removed.map((c) => ({
          orderItemId: c.id,
          variantId: c.variantId,
          title: c.titleSnapshot,
          sku: c.sku,
          optionsText: c.optionsText,
          qty: c.qty,
          unitPriceP: c.unitPriceP,
          lineTotalP: c.unitPriceP * c.qty,
          discountP: c.discountP,
          change: 'removed' as const,
        })),
      ],
      money,
      before: before.money,
      zone: { id: ship.zone.id, name: ship.zone.nameEn },
      warnings,
    };
    if (dryRun) {
      throw new DryRun({ orderId: order.id, orderNo: order.orderNo, preview, edit: null });
    }
    if (
      JSON.stringify([before.ship, before.lines, before.money, before.discounts]) ===
        JSON.stringify([after.ship, after.lines, after.money, after.discounts]) &&
      input.customerNote === undefined
    ) {
      throw new OrderEditError(HttpStatus.UNPROCESSABLE_ENTITY, 'EDIT_INVALID', 'Nothing changed.');
    }
    const edit = await tx.orderEdit.create({
      data: {
        orderId: order.id,
        staffId,
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
        note: input.note ?? null,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        actorType: 'staff',
        actorId: staffId,
        note: input.note ? `Order edited: ${input.note}` : 'Order edited',
      },
    });
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      preview,
      edit: { id: edit.id, createdAt: edit.createdAt.toISOString() },
    };
  }
}
