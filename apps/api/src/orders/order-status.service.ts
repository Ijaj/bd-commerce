import { Injectable } from '@nestjs/common';
import type { OrderStatus, Prisma } from '../generated/prisma/client';

type Actor = { type: 'staff' | 'customer' | 'system'; id?: string | null };

/** Shipment statuses whose goods have left the warehouse / supplier. */
const SENT = ['handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned'] as const;

/**
 * Single place that moves an order between statuses and writes the history row (C51+).
 * Cancelled / on_hold / pending_payment / failed are set explicitly and never overwritten by
 * `recompute`, which derives processing -> partially_shipped -> shipped -> delivered (or
 * delivery_failed) from the order's shipments.
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
   * Delivered = all active qty on delivered shipments. delivery_failed = a failed/returning/
   * returned shipment (not received back) and no sibling still moving. Returns the resulting status.
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
    if (
      !['processing', 'partially_shipped', 'shipped', 'delivered', 'delivery_failed'].includes(
        order.status,
      )
    ) {
      return order.status;
    }
    const lines = await tx.shipmentItem.findMany({
      // Shipments staff marked "received back" are goods in the warehouse again, not sent.
      where: {
        orderItem: { orderId },
        shipment: { status: { in: [...SENT] }, receivedBackAt: null },
      },
      select: { orderItemId: true, qty: true, shipment: { select: { status: true } } },
    });
    let active = 0;
    let sent = 0;
    let delivered = 0;
    let moving = 0;
    let troubled = false;
    const byItem = new Map(order.items.map((i) => [i.id, i.qty - i.qtyCancelled]));
    for (const n of byItem.values()) active += n;
    for (const l of lines) {
      sent += l.qty;
      const st = l.shipment.status;
      if (st === 'delivered') delivered += l.qty;
      else if (st === 'handed_over' || st === 'in_transit') moving += l.qty;
      else troubled = true; // failed | returning | returned
    }
    let to: OrderStatus = 'processing';
    if (active > 0 && delivered >= active) to = 'delivered';
    // C87: nothing is still on its way and some parcel came back: staff must act (received-back).
    else if (active > 0 && troubled && moving === 0) to = 'delivery_failed';
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
