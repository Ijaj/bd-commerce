import type { Prisma } from '../generated/prisma/client';

const DHAKA_OFFSET_MS = 6 * 60 * 60_000;
export const DAY_MS = 24 * 60 * 60_000;

/** Return statuses that still hold qty from the item (before it is counted in qtyReturned at inspection). */
export const HOLDING_STATUSES = ['requested', 'approved', 'pickup_booked', 'received'] as const;
/** Statuses that block completing the order. */
export const OPEN_STATUSES = [...HOLDING_STATUSES, 'inspected'] as const;

/** YYMM in Bangladesh time, like order numbers. */
export function yymm(now: Date) {
  const d = new Date(now.getTime() + DHAKA_OFFSET_MS);
  return `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function nextReturnNo(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('return_no_seq') AS n`;
  return `RET-${yymm(new Date())}-${String(rows[0]?.n ?? 0n).padStart(5, '0')}`;
}

export interface MoneyOrder {
  subtotalP: number;
  autoDiscountP: number;
  couponDiscountP: number;
}

/**
 * Refund value of `qty` units of a line: unit price times qty, scaled by how much of the
 * subtotal survived order-level discounts. Floor, so lines never add up to more than was paid.
 */
export function lineRefundP(order: MoneyOrder, unitPriceP: number, qty: number) {
  const gross = unitPriceP * qty;
  if (order.subtotalP <= 0) return 0;
  const net = Math.max(0, order.subtotalP - order.autoDiscountP - order.couponDiscountP);
  return Math.floor((gross * net) / order.subtotalP);
}

/** Locks the order row for the rest of the transaction (serialises return/refund writes per order). */
export async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
}
