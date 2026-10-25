import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { CommerceError } from '../orders/commerce.errors';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { reversePromotions } from '../promotions/engine/redeem';
import { orderKey } from './order-lookup';
import { OrdersAdminError } from './orders-admin.errors';

export type CancelActor = { type: 'staff' | 'customer' | 'system'; id?: string | null };

const CANCELLABLE = ['processing', 'on_hold', 'pending_payment'];
/** Shipments that never left the warehouse and hold no courier booking: safe to cancel here. */
const LOCAL_SHIPMENT = ['pending', 'awaiting_supplier', 'supplier_confirmed', 'ready'];
const SENT = ['handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned'];

/**
 * Cancels the not-yet-shipped part of an order: releases held reservations, cancels warehouse
 * shipments, cancels initiated payments. Refunds of money already paid are a separate staff step.
 */
@Injectable()
export class OrderCancelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly status: OrderStatusService,
  ) {}

  /** Own transaction; `idOrNo` is the uuid or the order number. */
  async cancel(idOrNo: string, actor: CancelActor, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: orderKey(idOrNo), select: { id: true } });
      if (!o) throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
      await this.cancelInTx(tx, o.id, actor, reason);
      return o.id;
    });
  }

  /** Join an existing transaction (the call-queue "cancelled" outcome uses this). */
  async cancelInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    actor: CancelActor,
    reason: string,
  ) {
    // Row lock: a concurrent handover must not slip a shipment past the check below.
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        items: { select: { id: true, qty: true, variantId: true } },
        shipments: { select: { id: true, status: true } },
      },
    });
    if (!order)
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    if (!CANCELLABLE.includes(order.status)) {
      throw new OrdersAdminError(
        HttpStatus.CONFLICT,
        'ORDER_NOT_CANCELLABLE',
        `An order that is ${order.status} cannot be cancelled.`,
      );
    }
    if (order.shipments.some((s) => SENT.includes(s.status))) {
      throw new OrdersAdminError(
        HttpStatus.CONFLICT,
        'SHIPMENT_SENT',
        'A shipment has already been handed over; use returns instead.',
      );
    }
    if (order.shipments.some((s) => s.status === 'booked')) {
      throw new OrdersAdminError(
        HttpStatus.CONFLICT,
        'SHIPMENT_BOOKED',
        'Cancel the courier booking (cancel the shipment) first.',
      );
    }

    await tx.shipment.updateMany({
      where: { orderId, status: { in: LOCAL_SHIPMENT as never } },
      data: { status: 'cancelled' },
    });

    const variants = [...new Set(order.items.map((i) => i.variantId))].sort();
    for (const variantId of variants) {
      const held = await this.status.heldReserved(tx, orderId, variantId);
      if (held > 0) {
        await this.inventory.move(tx, {
          variantId,
          qtyDelta: 0,
          reservedDelta: -held,
          reason: 'order_release',
          refType: 'order',
          refId: orderId,
          staffId: actor.type === 'staff' ? (actor.id ?? undefined) : undefined,
          note: 'Order cancelled',
        });
      }
    }

    for (const i of order.items) {
      await tx.orderItem.update({ where: { id: i.id }, data: { qtyCancelled: i.qty } });
    }
    // Q90: the coupon uses, budget, bulk code and flash stock come back with the cancelled order.
    await reversePromotions(tx, orderId);
    await tx.payment.updateMany({
      where: { orderId, status: 'initiated' },
      data: { status: 'cancelled' },
    });
    await this.status.transition(tx, orderId, 'cancelled', actor, reason, {
      cancelReason: reason,
      heldReason: null,
    });
  }
}
