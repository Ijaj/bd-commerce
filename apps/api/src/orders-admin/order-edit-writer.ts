import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { normalizePhone } from '../customers/phone';
import { DeliveryService } from '../delivery/delivery.service';
import type { Prisma } from '../generated/prisma/client';
import { GeoService, type PlaceNames } from '../geo/geo.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatusService } from '../orders/order-status.service';
import type { OrderEditInputDto } from './order-edit.dto';
import { OrderEditError } from './order-edit.errors';
import type { CurLine, EditVariant, OutLine } from './order-edit-support';

/** Database writes of an order edit: ship-to resolution, line rows, stock reservation. */
@Injectable()
export class OrderEditWriter {
  constructor(
    private readonly inventory: InventoryService,
    private readonly status: OrderStatusService,
    private readonly delivery: DeliveryService,
    private readonly geo: GeoService,
  ) {}

  async resolveShip(
    tx: Prisma.TransactionClient,
    order: {
      shipName: string;
      shipPhone: string;
      shipDistrictId: number;
      shipDivisionId: number;
      shipUpazilaId: number;
      shipAreaId: number | null;
      shipPlaceText: string;
      shipLine: string;
      shipLandmark: string | null;
      lang: 'en' | 'bn';
      zone: { id: string; nameEn: string };
    },
    input: OrderEditInputDto,
  ) {
    const s = input.ship ?? {};
    let phone = order.shipPhone;
    if (s.phone !== undefined) {
      const n = normalizePhone(s.phone);
      if (!n) {
        throw new OrderEditError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'EDIT_INVALID',
          'Enter a valid Bangladesh mobile number.',
        );
      }
      phone = n;
    }
    const placeChanged = s.upazilaId !== undefined || s.areaId !== undefined;
    let districtId = order.shipDistrictId;
    let upazilaId = order.shipUpazilaId;
    let areaId = order.shipAreaId;
    if (s.upazilaId !== undefined && s.upazilaId !== upazilaId) {
      const u = await tx.upazila.findUnique({
        where: { id: s.upazilaId },
        select: { districtId: true },
      });
      if (!u) throw this.unserviceable();
      districtId = u.districtId;
      upazilaId = s.upazilaId;
      areaId = null; // the old area belonged to the old upazila
    }
    if (s.areaId !== undefined) areaId = s.areaId;
    const names = await this.geo.resolve(districtId, upazilaId, areaId);
    if (!names) throw this.unserviceable();
    const zone = await this.delivery.zoneFor(districtId, upazilaId, areaId);
    if (!zone) throw this.unserviceable();
    return {
      name: s.name ?? order.shipName,
      phone,
      divisionId: names.divisionId,
      districtId,
      upazilaId,
      areaId,
      placeText: placeChanged
        ? this.geo.placeText(names as PlaceNames, order.lang)
        : order.shipPlaceText,
      line: s.line ?? order.shipLine,
      landmark: s.landmark === undefined ? order.shipLandmark : s.landmark,
      zone,
    };
  }

  unserviceable() {
    return new OrderEditError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'ADDRESS_UNSERVICEABLE',
      'We do not deliver to that location.',
    );
  }

  async writeLines(
    tx: Prisma.TransactionClient,
    orderId: string,
    out: OutLine[],
    removed: CurLine[],
  ) {
    for (const c of removed) {
      const refs =
        (await tx.shipmentItem.count({ where: { orderItemId: c.id } })) +
        (await tx.returnItem.count({ where: { orderItemId: c.id } })) +
        (await tx.refundItem.count({ where: { orderItemId: c.id } }));
      if (refs > 0) {
        // Kept for the paper trail (cancelled shipments point at it); counts as nothing.
        await tx.orderItem.update({
          where: { id: c.id },
          data: { qtyCancelled: c.qty, discountP: 0, flashSaleItemId: null },
        });
      } else {
        await tx.orderItem.delete({ where: { id: c.id } });
      }
    }
    for (const l of out) {
      const data = {
        qty: l.qty,
        qtyCancelled: 0,
        discountP: l.discountP,
        lineTotalP: l.unitPriceP * l.qty,
        flashSaleItemId: l.flashItemId,
      };
      if (l.itemId) {
        await tx.orderItem.update({ where: { id: l.itemId }, data });
      } else {
        const v = await tx.variant.findUniqueOrThrow({
          where: { id: l.variantId },
          include: {
            images: { orderBy: { sort: 'asc' }, take: 1 },
            product: {
              select: {
                sellerId: true,
                returnWindowDays: true,
                primaryCategory: { select: { returnWindowDays: true } },
                images: { where: { variantId: null }, orderBy: { sort: 'asc' }, take: 1 },
              },
            },
          },
        });
        await tx.orderItem.create({
          data: {
            orderId,
            sellerId: v.product.sellerId,
            productId: l.productId,
            variantId: l.variantId,
            titleSnapshot: l.title,
            sku: l.sku,
            optionsText: l.optionsText,
            imageMediaId: v.images[0]?.mediaId ?? v.product.images[0]?.mediaId ?? null,
            unitBaseP: l.unitBaseP,
            unitPriceP: l.unitPriceP,
            priceSource: l.priceSource,
            weightG: l.weightG,
            returnWindowDays:
              v.product.returnWindowDays ?? v.product.primaryCategory.returnWindowDays,
            ...data,
          },
        });
      }
    }
  }

  /** Reserve/release the difference per variant, sorted so concurrent edits lock in one order. */
  async moveStock(
    tx: Prisma.TransactionClient,
    orderId: string,
    staffId: string,
    variants: Map<string, EditVariant>,
    curQty: Map<string, number>,
    out: OutLine[],
  ) {
    const next = new Map<string, number>();
    for (const l of out) next.set(l.variantId, (next.get(l.variantId) ?? 0) + l.qty);
    const ids = [...new Set([...curQty.keys(), ...next.keys()])].sort();
    for (const variantId of ids) {
      const delta = (next.get(variantId) ?? 0) - (curQty.get(variantId) ?? 0);
      if (delta === 0) continue;
      const p = variants.get(variantId)?.product;
      let reservedDelta = 0;
      if (delta > 0) {
        if (p && p.fulfillment === 'stock' && !p.isPreorder) reservedDelta = delta;
      } else {
        const held = await this.status.heldReserved(tx, orderId, variantId);
        reservedDelta = -Math.min(held, -delta);
      }
      if (reservedDelta === 0) continue;
      try {
        await this.inventory.move(tx, {
          variantId,
          qtyDelta: 0,
          reservedDelta,
          reason: reservedDelta > 0 ? 'order_reserve' : 'order_release',
          refType: 'order',
          refId: orderId,
          staffId,
          note: 'Order edited',
        });
      } catch (e) {
        if (e instanceof ConflictException) {
          throw new OrderEditError(HttpStatus.CONFLICT, 'STOCK_SHORT', 'Not enough stock.', {
            variantId,
          });
        }
        throw e;
      }
    }
  }
}
