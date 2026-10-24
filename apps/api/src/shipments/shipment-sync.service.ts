import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma, ShipmentStatus } from '../generated/prisma/client';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { CourierRegistry } from './couriers/courier.registry';
import type { CourierMapped } from './couriers/courier.types';
import { ShipmentBookingService } from './shipment-booking.service';
import { ShipmentError } from './shipments.errors';
import { lockShipment, ShipmentsService } from './shipments.service';

/** Statuses in which the courier still owns the parcel and may report progress. */
const OPEN: ShipmentStatus[] = ['booked', 'handed_over', 'in_transit', 'failed', 'returning'];
const SYSTEM = { type: 'system' } as const;

@Injectable()
export class ShipmentSyncService {
  private readonly logger = new Logger(ShipmentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
    private readonly booking: ShipmentBookingService,
    private readonly registry: CourierRegistry,
    private readonly orderStatus: OrderStatusService,
  ) {}

  /** Pull the courier's status for one shipment and apply it. */
  async sync(shipmentId: string) {
    const s = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { courier: { select: { code: true } } },
    });
    if (!s) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
    }
    if (!OPEN.includes(s.status) || !s.consignmentId || !s.courier) {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'NO_LIVE_BOOKING',
        'This shipment has no courier booking to sync',
      );
    }
    const adapter = this.registry.get(s.courier.code);
    adapter.assertConfigured();
    let result: Awaited<ReturnType<typeof adapter.status>>;
    try {
      result = await adapter.status(s.consignmentId);
    } catch (e) {
      throw new ShipmentError(
        HttpStatus.BAD_GATEWAY,
        'COURIER_SYNC_FAILED',
        e instanceof Error ? e.message : 'Courier status lookup failed',
      );
    }
    const changed = await this.record(shipmentId, result.rawStatus, result.mapped, result.raw);
    return {
      shipment: await this.shipments.view(shipmentId),
      rawStatus: result.rawStatus,
      mapped: result.mapped,
      changed,
    };
  }

  /** Polls every open shipment (for a cron / CLI). One bad courier call never stops the rest. */
  async syncOpen() {
    const open = await this.prisma.shipment.findMany({
      where: { status: { in: OPEN }, consignmentId: { not: null }, courierId: { not: null } },
      select: { id: true, shipmentNo: true },
      orderBy: { createdAt: 'asc' },
    });
    let updated = 0;
    const errors: { shipmentNo: string; error: string }[] = [];
    for (const s of open) {
      try {
        const r = await this.sync(s.id);
        if (r.changed) updated += 1;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this.logger.warn(`sync ${s.shipmentNo}: ${error}`);
        errors.push({ shipmentNo: s.shipmentNo, error });
      }
    }
    return { checked: open.length, updated, errors };
  }

  /** Courier webhook. Unknown consignments are acknowledged and ignored. */
  async webhook(
    code: string,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ) {
    const adapter = this.registry.get(code);
    if (!adapter.verifyWebhook?.(headers)) {
      return { authorized: false as const };
    }
    const event = adapter.parseWebhook?.(body);
    if (!event) return { authorized: true as const };
    const booking = await this.prisma.courierBooking.findFirst({
      where: { consignmentId: event.consignmentId, courier: { code }, status: 'booked' },
      orderBy: { createdAt: 'desc' },
      select: { shipmentId: true },
    });
    if (booking) {
      await this.record(booking.shipmentId, event.rawStatus, event.mapped, body);
    }
    return { authorized: true as const };
  }

  /**
   * Appends the status event (once per distinct raw status) and applies the mapped status.
   * Returns whether the shipment status changed.
   */
  async record(
    shipmentId: string,
    rawStatus: string,
    mapped: CourierMapped | null,
    payload: unknown,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await lockShipment(tx, shipmentId);
      const s = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: { courier: { select: { code: true } } },
      });
      const live = await tx.courierBooking.findFirst({
        where: { shipmentId, status: 'booked' },
        orderBy: { createdAt: 'desc' },
      });
      // Events attach to the live booking, else to the latest one (history after a cancel).
      const target =
        live ??
        (await tx.courierBooking.findFirst({
          where: { shipmentId },
          orderBy: { createdAt: 'desc' },
        }));
      if (target) {
        const last = await tx.courierStatusEvent.findFirst({
          where: { bookingId: target.id },
          orderBy: { at: 'desc' },
        });
        if (last?.rawStatus !== rawStatus) {
          await tx.courierStatusEvent.create({
            data: {
              bookingId: target.id,
              rawStatus,
              mappedStatus: mapped,
              payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
            },
          });
        }
      }
      if (!mapped || !OPEN.includes(s.status)) return false;
      return this.apply(tx, s, mapped, live?.id ?? null);
    });
  }

  private async apply(
    tx: Prisma.TransactionClient,
    s: {
      id: string;
      orderId: string;
      status: ShipmentStatus;
      codAmountP: number;
      shipmentNo: string;
      courier: { code: string } | null;
    },
    mapped: CourierMapped,
    liveBookingId: string | null,
  ): Promise<boolean> {
    let current = s.status;
    const touch = async (status: ShipmentStatus, extra: Prisma.ShipmentUpdateInput = {}) => {
      await tx.shipment.update({ where: { id: s.id }, data: { status, ...extra } });
      current = status;
    };
    // Goods that the courier reports as moving have left the warehouse, whatever staff clicked.
    const ensureHandedOver = async () => {
      if (current === 'booked') {
        await this.booking.handoverTx(tx, s.id, SYSTEM, false);
        current = 'handed_over';
      }
    };
    const before = current;

    switch (mapped) {
      case 'booked':
        return false;
      case 'cancelled':
        if (current === 'booked') {
          // Courier dropped the booking before pickup: back to the packing queue.
          if (liveBookingId) {
            await tx.courierBooking.update({
              where: { id: liveBookingId },
              data: { status: 'cancelled' },
            });
          }
          await touch('ready', {
            courier: { disconnect: true },
            consignmentId: null,
            trackingUrl: null,
          });
          return true;
        }
        await touch('returning');
        break;
      case 'handed_over':
        await ensureHandedOver();
        break;
      case 'in_transit':
        await ensureHandedOver();
        if (current !== 'in_transit' && current !== 'returning') await touch('in_transit');
        break;
      case 'delivered':
        await ensureHandedOver();
        await touch('delivered', { deliveredAt: new Date() });
        await this.collectCod(tx, s);
        break;
      case 'failed':
        await ensureHandedOver();
        if (current === 'handed_over' || current === 'in_transit') await touch('failed');
        break;
      case 'returning':
        await ensureHandedOver();
        if (current !== 'returning') await touch('returning');
        break;
      case 'returned':
        await ensureHandedOver();
        await touch('returned');
        break;
    }
    if (current === before) return false;
    await this.orderStatus.recompute(tx, s.orderId, SYSTEM);
    return true;
  }

  /**
   * Delivered = the courier collected the shipment's COD (idempotent per shipment). Keeps
   * codDueP = grandTotalP - paidP, as checkout sets it.
   */
  private async collectCod(
    tx: Prisma.TransactionClient,
    s: {
      orderId: string;
      codAmountP: number;
      shipmentNo: string;
      courier: { code: string } | null;
    },
  ) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: s.orderId } });
    const amount = Math.min(s.codAmountP, order.codDueP);
    if (amount <= 0) return;
    const done = await tx.payment.findFirst({
      where: { orderId: s.orderId, providerTxnId: s.shipmentNo, status: 'success' },
    });
    if (done) return;

    const paidP = order.paidP + amount;
    const codDueP = Math.max(0, order.grandTotalP - paidP);
    const priorSuccess = await tx.payment.count({
      where: { orderId: s.orderId, status: 'success' },
    });
    const now = new Date();
    const collected = {
      status: 'success',
      paidAt: now,
      provider: s.courier?.code ?? null,
      providerTxnId: s.shipmentNo,
      purpose: codDueP === 0 && priorSuccess === 0 ? 'full' : 'balance',
    };
    const open = await tx.payment.findFirst({
      where: { orderId: s.orderId, method: 'cod', status: 'initiated' },
      orderBy: { initiatedAt: 'asc' },
    });
    if (open && open.amountP <= amount) {
      await tx.payment.update({ where: { id: open.id }, data: { ...collected, amountP: amount } });
    } else {
      if (open) {
        await tx.payment.update({
          where: { id: open.id },
          data: { amountP: open.amountP - amount },
        });
      }
      await tx.payment.create({
        data: { orderId: s.orderId, method: 'cod', amountP: amount, ...collected },
      });
    }
    await tx.order.update({
      where: { id: s.orderId },
      data: {
        paidP,
        codDueP,
        ...(['unpaid', 'partially_paid'].includes(order.paymentStatus)
          ? { paymentStatus: codDueP === 0 ? 'paid' : 'partially_paid' }
          : {}),
      },
    });
  }
}
