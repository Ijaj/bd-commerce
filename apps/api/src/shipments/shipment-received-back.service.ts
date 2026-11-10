import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { OrderNotifyService } from '../orders/order-notify.service';
import { OrderStatusService } from '../orders/order-status.service';
import { adjustSoldCount } from '../orders/sold-count';
import { PrismaService } from '../prisma/prisma.service';
import { reversePromotions } from '../promotions/engine/redeem';
import type { ShipmentReceivedBackDto } from './shipments.dto';
import { ShipmentError } from './shipments.errors';
import { lockShipment, ShipmentsService } from './shipments.service';

const BACK_STATES = ['failed', 'returning', 'returned'];

/**
 * C87: staff took a failed / returned parcel back. Only this step touches stock and promotions;
 * a courier "returned" status alone changes neither.
 */
@Injectable()
export class ShipmentReceivedBackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
    private readonly inventory: InventoryService,
    private readonly orderStatus: OrderStatusService,
    private readonly notify: OrderNotifyService,
  ) {}

  async receivedBack(shipmentId: string, staffId: string, input: ShipmentReceivedBackDto) {
    const head = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { orderId: true },
    });
    if (!head) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
    }
    const actor = { type: 'staff', id: staffId } as const;
    const out = await this.prisma.$transaction(async (tx) => {
      // Shipment first, then order: the same order every other combined taker uses.
      await lockShipment(tx, shipmentId);
      await tx.$executeRaw`SELECT 1 FROM orders WHERE id = ${head.orderId}::uuid FOR UPDATE`;
      const s = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: { items: { include: { orderItem: true } } },
      });
      if (!BACK_STATES.includes(s.status) || s.receivedBackAt) {
        throw new ShipmentError(
          HttpStatus.CONFLICT,
          'SHIPMENT_STATE',
          s.receivedBackAt
            ? 'This shipment was already received back'
            : `A ${s.status} shipment cannot be received back`,
        );
      }

      await this.restock(tx, s, staffId, input.reship);
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'returned',
          receivedBackAt: new Date(),
          receivedBackById: staffId,
          receivedBackNote: input.note ?? null,
        },
      });

      const warnings: string[] = [];
      let reshipmentId: string | null = null;
      let failed = false;
      if (input.reship) {
        reshipmentId = await this.reship(tx, s);
        await this.orderStatus.recompute(tx, s.orderId, actor);
      } else {
        for (const i of s.items) {
          await tx.orderItem.update({
            where: { id: i.orderItemId },
            data: { qtyCancelled: { increment: i.qty } },
          });
        }
        await adjustSoldCount(
          tx,
          s.items.map((i) => ({ productId: i.orderItem.productId, qty: i.qty })),
          -1,
        );
        const left = await tx.orderItem.findMany({
          where: { orderId: s.orderId },
          select: { qty: true, qtyCancelled: true },
        });
        const active = left.reduce((n, i) => n + i.qty - i.qtyCancelled, 0);
        if (active === 0) {
          await reversePromotions(tx, s.orderId);
          await tx.payment.updateMany({
            where: { orderId: s.orderId, status: 'initiated' },
            data: { status: 'cancelled' },
          });
          const reason = input.note ?? 'delivery_failed';
          await this.orderStatus.transition(tx, s.orderId, 'failed', actor, reason, {
            failedReason: reason,
            heldReason: null,
          });
          failed = true;
        } else {
          await this.orderStatus.recompute(tx, s.orderId, actor);
          warnings.push(
            'Part of the order stays active. The coupon is kept; refund or adjust the cancelled lines by hand if needed.',
          );
        }
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: s.orderId },
        select: { status: true },
      });
      return { orderId: s.orderId, orderStatus: order.status, reshipmentId, warnings, failed };
    });
    if (out.failed) {
      await this.notify.event(out.orderId, 'cancelled', { reason: 'delivery_failed' });
    }
    return {
      ...(await this.shipments.view(shipmentId)),
      orderStatus: out.orderStatus,
      reshipmentId: out.reshipmentId,
      warnings: out.warnings,
    };
  }

  /**
   * Puts back what the handover took out: per variant the `ship` movements booked for this
   * shipment (lines that never reserved, e.g. dropship or pre-order, booked none). With a
   * re-ship the goods are reserved again in the same move.
   */
  private async restock(
    tx: Prisma.TransactionClient,
    s: {
      orderId: string;
      shipmentNo: string;
      items: { qty: number; orderItem: { variantId: string } }[];
    },
    staffId: string,
    reserve: boolean,
  ) {
    const wanted = new Map<string, number>();
    for (const i of s.items) {
      wanted.set(i.orderItem.variantId, (wanted.get(i.orderItem.variantId) ?? 0) + i.qty);
    }
    for (const [variantId, qty] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
      const shipped = await tx.stockMovement.aggregate({
        where: {
          refType: 'order',
          refId: s.orderId,
          variantId,
          reason: 'ship',
          note: s.shipmentNo,
        },
        _sum: { qtyDelta: true },
      });
      const n = Math.min(qty, -(shipped._sum.qtyDelta ?? 0));
      if (n <= 0) continue;
      await this.inventory.move(tx, {
        variantId,
        qtyDelta: n,
        reservedDelta: reserve ? n : 0,
        reason: 'return_restock',
        refType: 'order',
        refId: s.orderId,
        staffId,
        note: s.shipmentNo,
      });
    }
  }

  /** New ready shipment with the same goods and money; the old one stops counting (see create). */
  private async reship(
    tx: Prisma.TransactionClient,
    s: {
      orderId: string;
      sellerId: string;
      source: 'warehouse' | 'supplier';
      shipmentNo: string;
      weightG: number | null;
      codAmountP: number;
      deliveryChargeShareP: number;
      items: { orderItemId: string; qty: number }[];
    },
  ) {
    const created = await tx.shipment.create({
      data: {
        orderId: s.orderId,
        shipmentNo: await this.shipments.nextShipmentNo(tx),
        sellerId: s.sellerId,
        source: s.source,
        status: 'ready',
        weightG: s.weightG,
        codAmountP: s.codAmountP,
        deliveryChargeShareP: s.deliveryChargeShareP,
        note: `Re-ship of ${s.shipmentNo}`,
        packedAt: new Date(),
        items: { create: s.items.map((i) => ({ orderItemId: i.orderItemId, qty: i.qty })) },
      },
    });
    return created.id;
  }
}
