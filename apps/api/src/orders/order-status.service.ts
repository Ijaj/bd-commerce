import { Injectable } from '@nestjs/common';
import type { OrderStatus, Prisma } from '../generated/prisma/client';

type Actor = { type: 'staff' | 'customer' | 'system'; id?: string | null };

/** Shipment statuses whose goods have left the warehouse / supplier. */
const SENT = ['handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned'] as const;

/**
 * Single place that moves an order between statuses and writes the history row (C51+).
 * Cancelled / on_hold / pending_payment are set explicitly (orders-admin) and never overwritten
 * by `recompute`, which only derives processing -> partially_shipped -> shipped -> delivered
 * from the order's shipments.
 */
@Injectable()
export class OrderStatusService {
  async transition(
    tx: Prisma.TransactionClient,
    orderId: string,
    to: OrderStatus,
    actor: Actor,
    note?: string | null,
    extra: Prisma.OrderUpdateInput = {},
  ) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });
    if (order.status === to) return order.status;
    await tx.order.update({ where: { id: orderId }, data: { status: to, ...extra } });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: to,
        actorType: actor.type,
        actorId: actor.id ?? null,
        note: note ?? null,
      },
    });
    return to;
  }

  /**
   * Re-derive status from shipments. Active qty = qty - qtyCancelled. Sent = qty on shipments
   * handed over or later (failed/returned still count as sent: the order is not "processing").
   * Delivered = all active qty on delivered shipments. Returns the resulting status.
   */
  async recompute(
    tx: Prisma.TransactionClient,
    orderId: string,
    actor: Actor = { type: 'system' },
  ) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, items: { select: { id: true, qty: true, qtyCancelled: true } } },
    });
    if (!['processing', 'partially_shipped', 'shipped', 'delivered'].includes(order.status)) {
      return order.status;
    }
    const lines = await tx.shipmentItem.findMany({
      where: { orderItem: { orderId }, shipment: { status: { in: [...SENT] } } },
      select: { orderItemId: true, qty: true, shipment: { select: { status: true } } },
    });
    let active = 0;
    let sent = 0;
    let delivered = 0;
    const byItem = new Map(order.items.map((i) => [i.id, i.qty - i.qtyCancelled]));
    for (const n of byItem.values()) active += n;
    for (const l of lines) {
      sent += l.qty;
      if (l.shipment.status === 'delivered') delivered += l.qty;
    }
    let to: OrderStatus = 'processing';
    if (active > 0 && delivered >= active) to = 'delivered';
    else if (active > 0 && sent >= active) to = 'shipped';
    else if (sent > 0) to = 'partially_shipped';
    const extra: Prisma.OrderUpdateInput = to === 'delivered' ? { deliveredAt: new Date() } : {};
    return this.transition(tx, orderId, to, actor, null, extra);
  }

  /**
   * Stock still reserved for this order and variant, from the ledger (lines that don't reserve,
   * e.g. dropship or pre-order, have none). Cancel/ship release at most this much.
   */
  async heldReserved(tx: Prisma.TransactionClient, orderId: string, variantId: string) {
    const r = await tx.stockMovement.aggregate({
      where: { refType: 'order', refId: orderId, variantId },
      _sum: { reservedDelta: true },
    });
    return Math.max(0, r._sum.reservedDelta ?? 0);
  }
}
