import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { CommerceError } from '../../orders/commerce.errors';

type Db = Prisma.TransactionClient;

/** A flash price that is live right now for a variant (window open, active, stock left). */
export interface ActiveFlash {
  itemId: string;
  flashSaleId: string;
  flashPriceP: number;
  endsAt: Date;
  /** Units still sellable at the flash price. */
  remaining: number;
  perCustomerLimit: number | null;
}

/** Who is buying, for per-customer limits: any match counts as the same buyer. */
export interface FlashBuyer {
  customerId: string | null;
  phone: string | null;
  visitorId: string | null;
}

/** Live flash prices by variant id. One flash per variant at a time (overlap is refused on save). */
export async function activeFlashFor(db: Db, variantIds: string[], now: Date) {
  const out = new Map<string, ActiveFlash>();
  if (variantIds.length === 0) return out;
  const rows = await db.flashSaleItem.findMany({
    where: {
      variantId: { in: variantIds },
      flashSale: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
    },
    include: { flashSale: { select: { endsAt: true } } },
  });
  for (const r of rows) {
    const remaining = r.qtyLimit - r.qtySold;
    if (remaining <= 0) continue;
    out.set(r.variantId, {
      itemId: r.id,
      flashSaleId: r.flashSaleId,
      flashPriceP: r.flashPriceP,
      endsAt: r.flashSale.endsAt,
      remaining,
      perCustomerLimit: r.perCustomerLimit,
    });
  }
  return out;
}

/** Units this buyer already holds at flash price (not cancelled), per flash item id. */
export async function flashUsedBy(db: Db, itemIds: string[], who: FlashBuyer) {
  const out = new Map<string, number>();
  const ors: Prisma.OrderWhereInput[] = [];
  if (who.customerId) ors.push({ customerId: who.customerId });
  if (who.phone) ors.push({ guestPhone: who.phone }, { shipPhone: who.phone });
  if (who.visitorId) ors.push({ visitorId: who.visitorId });
  if (itemIds.length === 0 || ors.length === 0) return out;
  const rows = await db.orderItem.findMany({
    where: { flashSaleItemId: { in: itemIds }, order: { status: { not: 'cancelled' }, OR: ors } },
    select: { flashSaleItemId: true, qty: true, qtyCancelled: true },
  });
  for (const r of rows) {
    if (!r.flashSaleItemId) continue;
    out.set(r.flashSaleItemId, (out.get(r.flashSaleItemId) ?? 0) + r.qty - r.qtyCancelled);
  }
  return out;
}

/** Most units of a line the buyer may still take at flash price (stock left and personal limit). */
export function flashAllowance(flash: ActiveFlash, usedByBuyer: number) {
  const personal =
    flash.perCustomerLimit === null
      ? Number.POSITIVE_INFINITY
      : Math.max(flash.perCustomerLimit - usedByBuyer, 0);
  return Math.max(Math.min(flash.remaining, personal), 0);
}

/**
 * Takes flash stock inside the order transaction: atomic per item, refuses with FLASH_SOLD_OUT when
 * someone else took it first. Sorted by id so concurrent orders lock rows in the same order.
 */
export async function claimFlash(tx: Db, claims: { itemId: string; qty: number }[]) {
  const sorted = [...claims].sort((a, b) => a.itemId.localeCompare(b.itemId));
  for (const c of sorted) {
    const n = await tx.$executeRaw`UPDATE flash_sale_items SET qty_sold = qty_sold + ${c.qty}
      WHERE id = ${c.itemId}::uuid AND qty_sold + ${c.qty} <= qty_limit`;
    if (n === 0) {
      throw new CommerceError(
        HttpStatus.CONFLICT,
        'FLASH_SOLD_OUT',
        'The flash sale price is no longer available for an item in your cart.',
      );
    }
  }
}

/** Gives flash stock back when an order is cancelled (called once, from the order status machine). */
export async function releaseFlash(tx: Db, orderId: string) {
  await tx.$executeRaw`UPDATE flash_sale_items f SET qty_sold = greatest(f.qty_sold - x.q, 0)
    FROM (SELECT flash_sale_item_id AS id, sum(qty - qty_cancelled)::int AS q FROM order_items
          WHERE order_id = ${orderId}::uuid AND flash_sale_item_id IS NOT NULL
          GROUP BY flash_sale_item_id) x
    WHERE f.id = x.id`;
}
