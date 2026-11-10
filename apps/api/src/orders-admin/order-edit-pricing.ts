import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import {
  activeFlashFor,
  type FlashBuyer,
  flashAllowance,
  flashUsedBy,
} from '../promotions/flash/flash-core';
import { effectivePrice } from '../storefront/pricing';
import { OrderEditError } from './order-edit.errors';
import type { UnitPrice } from './order-edit-lines';
import type { EditVariant } from './order-edit-support';

/** Added units must be sellable now and within the per-line cap. */
export function assertAddable(
  extraQty: Map<string, number>,
  wantQty: Map<string, number>,
  variants: Map<string, EditVariant>,
  o: { now: Date; maxQtyPerLine: number; preordersOn: boolean },
) {
  for (const variantId of extraQty.keys()) {
    const q = wantQty.get(variantId) ?? 0;
    const v = variants.get(variantId);
    const p = v?.product;
    const ok =
      v &&
      p &&
      v.isActive &&
      p.status === 'active' &&
      p.publishedAt !== null &&
      p.publishedAt <= o.now &&
      p.primaryCategory.isActive &&
      !p.isUpcoming &&
      (!p.isPreorder || o.preordersOn);
    if (!ok) {
      throw new OrderEditError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VARIANT_UNAVAILABLE',
        'An item you are adding is not available.',
        { variantId },
      );
    }
    if (q > o.maxQtyPerLine) {
      throw new OrderEditError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'EDIT_INVALID',
        `At most ${o.maxQtyPerLine} of one item per order.`,
        { variantId },
      );
    }
  }
}

/**
 * C90: today's price for the added units of each variant. A flash price needs flash stock and personal
 * allowance left (kept flash units of this order count as already taken); asking for more is FLASH_LIMIT.
 */
export async function priceAddedUnits(
  tx: Prisma.TransactionClient,
  o: {
    extraQty: Map<string, number>;
    keptFlash: Map<string, number>;
    variants: Map<string, EditVariant>;
    buyer: FlashBuyer;
    lang: 'en' | 'bn';
    now: Date;
  },
) {
  const { extraQty, keptFlash, variants, buyer, now } = o;
  const growVariantIds = [...extraQty.keys()];
  const flashes = await activeFlashFor(tx, growVariantIds, now);
  const used = await flashUsedBy(
    tx,
    [...flashes.values()].map((f) => f.itemId),
    buyer,
  );
  const prices = new Map<string, UnitPrice>();
  for (const [variantId, added] of extraQty) {
    const v = variants.get(variantId);
    if (!v) continue;
    const flash = flashes.get(variantId) ?? null;
    const allowance = flash
      ? flashAllowance(flash, (used.get(flash.itemId) ?? 0) + (keptFlash.get(flash.itemId) ?? 0))
      : 0;
    const price = effectivePrice(v, now, allowance > 0 ? flash : null);
    if (price.source === 'flash' && added > allowance) {
      throw new OrderEditError(
        HttpStatus.CONFLICT,
        'FLASH_LIMIT',
        'You can add fewer of an item at flash price.',
        { variantId, remaining: allowance },
      );
    }
    const opts = [v.optionValue1, v.optionValue2].filter((o) => o !== null);
    const bn = o.lang === 'bn';
    prices.set(variantId, {
      priceP: price.priceP,
      unitBaseP: v.priceP,
      source: price.source,
      flashItemId: price.source === 'flash' ? (flash?.itemId ?? null) : null,
      productId: v.product.id,
      title: bn ? (v.product.titleBn ?? v.product.titleEn) : v.product.titleEn,
      sku: v.sku,
      optionsText: opts.length
        ? opts.map((o) => (bn ? (o.valueBn ?? o.valueEn) : o.valueEn)).join(' / ')
        : null,
      weightG: v.weightG ?? v.product.weightG,
    });
  }
  return prices;
}
