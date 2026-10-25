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

/**
 * Refund value of `qty` units of a line: what the customer paid for them, i.e. the line total minus
 * the discount allocated to the line (step 6), pro rata. Floor, so units never add up to more than was paid.
 */
export function lineRefundP(
  item: { unitPriceP: number; qty: number; discountP: number },
  qty: number,
) {
  const paid = Math.max(0, item.unitPriceP * item.qty - item.discountP);
  return item.qty <= 0 ? 0 : Math.floor((paid * qty) / item.qty);
}

/** Locks the order row for the rest of the transaction (serialises return/refund writes per order). */
export async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
}

/**
 * Units a customer can still return now, per order line: delivered qty minus what is already
 * returned or held by an open return; 0 when the order is not delivered or the line's window closed.
 */
export async function returnableQtyByLine(
  db: Prisma.TransactionClient,
  order: {
    id: string;
    status: string;
    deliveredAt: Date | null;
    items: { id: string; qtyReturned: number; returnWindowDays: number | null }[];
  },
  windowDefaultDays: number,
  now = Date.now(),
) {
  const out = new Map<string, number>();
  if (order.status !== 'delivered' && order.status !== 'completed') {
    for (const i of order.items) out.set(i.id, 0);
    return out;
  }
  const [delivered, holding] = await Promise.all([
    db.shipmentItem.groupBy({
      by: ['orderItemId'],
      where: { shipment: { orderId: order.id, status: 'delivered' } },
      _sum: { qty: true },
    }),
    db.returnItem.groupBy({
      by: ['orderItemId'],
      where: { return: { orderId: order.id, status: { in: [...HOLDING_STATUSES] } } },
      _sum: { qty: true },
    }),
  ]);
  const dMap = new Map(delivered.map((r) => [r.orderItemId, r._sum.qty ?? 0]));
  const hMap = new Map(holding.map((r) => [r.orderItemId, r._sum.qty ?? 0]));
  const from = order.deliveredAt?.getTime() ?? now;
  for (const i of order.items) {
    const days = i.returnWindowDays ?? windowDefaultDays;
    const open = now <= from + days * DAY_MS;
    const available = (dMap.get(i.id) ?? 0) - i.qtyReturned - (hMap.get(i.id) ?? 0);
    out.set(i.id, open ? Math.max(0, available) : 0);
  }
  return out;
}
