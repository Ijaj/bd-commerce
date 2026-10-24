import { ConflictException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { InvoicesService } from '../documents/invoices.service';
import { Prisma } from '../generated/prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { CourierRegistry } from './couriers/courier.registry';
import { type BookInput, CourierApiError } from './couriers/courier.types';
import type { ShipmentCancelDto, ShipmentRebookDto } from './shipments.dto';
import { ShipmentError } from './shipments.errors';
import { lockShipment, ShipmentsService } from './shipments.service';

type Actor = { type: 'staff' | 'system'; id?: string | null };

const CANCELLABLE = ['pending', 'awaiting_supplier', 'supplier_confirmed', 'ready', 'booked'];
const SHIPPABLE_ORDER = ['processing', 'partially_shipped'];

@Injectable()
export class ShipmentBookingService {
  private readonly logger = new Logger(ShipmentBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
    private readonly registry: CourierRegistry,
    private readonly inventory: InventoryService,
    private readonly orderStatus: OrderStatusService,
    private readonly invoices: InvoicesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async load(id: string) {
    const s = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: true,
        items: { include: { orderItem: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!s) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', 'Shipment not found');
    }
    return s;
  }

  private async courierFor(code: string) {
    const row = await this.prisma.courier.findUnique({ where: { code } });
    if (!row) throw new ShipmentError(HttpStatus.NOT_FOUND, 'COURIER_NOT_FOUND', 'Unknown courier');
    // The fake courier exists for dev and tests only.
    if (!row.isActive || (code === 'fake' && this.env.NODE_ENV === 'production')) {
      throw new ShipmentError(HttpStatus.CONFLICT, 'COURIER_INACTIVE', 'Courier is not active');
    }
    const adapter = this.registry.get(code);
    adapter.assertConfigured();
    return { row, adapter };
  }

  async book(shipmentId: string, courierCode: string) {
    const s = await this.load(shipmentId);
    if (s.status !== 'ready') {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'SHIPMENT_STATE',
        `Only a ready shipment can be booked (this one is ${s.status})`,
      );
    }
    if (!SHIPPABLE_ORDER.includes(s.order.status)) {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'ORDER_NOT_SHIPPABLE',
        `The order is ${s.order.status}`,
      );
    }
    const { row: courier, adapter } = await this.courierFor(courierCode);

    const input: BookInput = {
      shipmentNo: s.shipmentNo,
      attempt: 1,
      recipient: {
        name: s.order.shipName,
        phone: s.order.shipPhone,
        address: [s.order.shipLine, s.order.shipLandmark, s.order.shipPlaceText]
          .filter(Boolean)
          .join(', '),
        placeText: s.order.shipPlaceText,
        districtId: s.order.shipDistrictId,
        upazilaId: s.order.shipUpazilaId,
        areaId: s.order.shipAreaId,
      },
      codAmountP: s.codAmountP,
      weightG: s.weightG ?? 0,
      note: s.note ?? s.order.customerNote,
      itemsText: s.items
        .map((i) => `${i.qty}x ${i.orderItem.titleSnapshot} (${i.orderItem.sku})`)
        .join(', '),
      pickup: s.source === 'supplier' ? 'supplier' : 'warehouse',
    };

    // The partial unique index (one live booking per shipment) makes a double click lose here.
    let booking: { id: string };
    try {
      const attempt = (await this.prisma.courierBooking.count({ where: { shipmentId } })) + 1;
      input.attempt = attempt;
      booking = await this.prisma.courierBooking.create({
        data: {
          shipmentId,
          courierId: courier.id,
          pickup: input.pickup,
          direction: 'delivery',
          request: input as unknown as Prisma.InputJsonValue,
          status: 'requested',
          attempt,
        },
        select: { id: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ShipmentError(
          HttpStatus.CONFLICT,
          'SHIPMENT_BOOKING_IN_PROGRESS',
          'A booking for this shipment is already in progress',
        );
      }
      throw e;
    }

    let result: Awaited<ReturnType<typeof adapter.book>>;
    try {
      result = await adapter.book(input);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Courier booking failed';
      await this.prisma.courierBooking.update({
        where: { id: booking.id },
        data: {
          status: 'failed',
          response: {
            error: message,
            raw: e instanceof CourierApiError ? e.raw : null,
          } as Prisma.InputJsonValue,
        },
      });
      throw new ShipmentError(HttpStatus.BAD_GATEWAY, 'COURIER_BOOK_FAILED', message);
    }

    const ok = await this.prisma.$transaction(async (tx) => {
      await lockShipment(tx, shipmentId);
      const moved = await tx.shipment.updateMany({
        where: { id: shipmentId, status: 'ready' },
        data: {
          status: 'booked',
          courierId: courier.id,
          consignmentId: result.consignmentId,
          trackingUrl: result.trackingUrl ?? null,
        },
      });
      await tx.courierBooking.update({
        where: { id: booking.id },
        data: {
          status: moved.count === 1 ? 'booked' : 'cancelled',
          consignmentId: result.consignmentId,
          response: result.raw as Prisma.InputJsonValue,
        },
      });
      return moved.count === 1;
    });
    if (!ok) {
      // Shipment changed while we were talking to the courier (e.g. cancelled): undo the booking.
      await adapter.cancel(result.consignmentId).catch(() => undefined);
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'SHIPMENT_STATE',
        'The shipment changed during booking',
      );
    }
    // A parcel needs its invoice; a failure here must not undo a booking that already exists.
    await this.invoices.ensureIssued(s.orderId).catch((e: unknown) => {
      this.logger.warn(`invoice for ${s.order.orderNo} not issued: ${(e as Error).message}`);
    });
    return this.shipments.view(shipmentId);
  }

  /** Drops the live booking (courier side first) and returns the shipment to `ready`. */
  private async cancelLiveBooking(shipmentId: string, manualCancel: boolean) {
    const live = await this.prisma.courierBooking.findFirst({
      where: { shipmentId, status: 'booked' },
      include: { courier: { select: { code: true } } },
    });
    if (live?.consignmentId && !manualCancel) {
      try {
        await this.registry.get(live.courier.code).cancel(live.consignmentId);
      } catch (e) {
        throw new ShipmentError(
          HttpStatus.BAD_GATEWAY,
          'COURIER_CANCEL_FAILED',
          `${(e as Error).message}. If you cancelled it with the courier yourself, retry with manualCancel.`,
        );
      }
    }
    return live;
  }

  async cancel(shipmentId: string, body: ShipmentCancelDto) {
    const s = await this.load(shipmentId);
    if (!CANCELLABLE.includes(s.status)) {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'SHIPMENT_STATE',
        `A ${s.status} shipment cannot be cancelled`,
      );
    }
    if (s.status === 'booked') await this.cancelLiveBooking(shipmentId, body.manualCancel === true);
    await this.prisma.$transaction(async (tx) => {
      await lockShipment(tx, shipmentId);
      const cur = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        select: { status: true },
      });
      if (!CANCELLABLE.includes(cur.status)) {
        throw new ShipmentError(
          HttpStatus.CONFLICT,
          'SHIPMENT_STATE',
          'The shipment just moved on',
        );
      }
      await tx.courierBooking.updateMany({
        where: { shipmentId, status: { in: ['requested', 'booked'] } },
        data: { status: 'cancelled' },
      });
      await tx.shipment.update({ where: { id: shipmentId }, data: { status: 'cancelled' } });
    });
    return this.shipments.view(shipmentId);
  }

  /** Cancel the live booking (history kept) and book again, optionally with another courier. */
  async rebook(shipmentId: string, body: ShipmentRebookDto) {
    const s = await this.load(shipmentId);
    if (s.status !== 'ready' && s.status !== 'booked') {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'SHIPMENT_STATE',
        `A ${s.status} shipment cannot be rebooked`,
      );
    }
    const last = await this.prisma.courierBooking.findFirst({
      where: { shipmentId },
      orderBy: [{ attempt: 'desc' }, { createdAt: 'desc' }],
      include: { courier: { select: { code: true } } },
    });
    const code = body.courierCode ?? last?.courier.code;
    if (!code) {
      throw new ShipmentError(HttpStatus.BAD_REQUEST, 'COURIER_NOT_FOUND', 'Pick a courier');
    }
    // Validate the new courier before dropping the old booking.
    await this.courierFor(code);

    if (s.status === 'booked') {
      const live = await this.cancelLiveBooking(shipmentId, body.manualCancel === true);
      await this.prisma.$transaction(async (tx) => {
        await lockShipment(tx, shipmentId);
        if (live) {
          await tx.courierBooking.update({ where: { id: live.id }, data: { status: 'cancelled' } });
        }
        await tx.shipment.updateMany({
          where: { id: shipmentId, status: 'booked' },
          data: { status: 'ready', courierId: null, consignmentId: null, trackingUrl: null },
        });
      });
    }
    return this.book(shipmentId, code);
  }

  async handover(shipmentId: string, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockShipment(tx, shipmentId);
      await this.handoverTx(tx, shipmentId, { type: 'staff', id: staffId }, true);
    });
    return this.shipments.view(shipmentId);
  }

  /**
   * booked -> handed_over: books the `ship` stock movements and recomputes the order status.
   * `strict` (staff click) refuses orders that are on hold / cancelled; courier-driven updates
   * (strict = false) must still record that the parcel really left. Caller holds the shipment lock.
   */
  async handoverTx(
    tx: Prisma.TransactionClient,
    shipmentId: string,
    actor: Actor,
    strict: boolean,
  ) {
    const s = await tx.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { order: { select: { status: true } }, items: { include: { orderItem: true } } },
    });
    if (s.status !== 'booked') {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'SHIPMENT_STATE',
        `Only a booked shipment can be handed over (this one is ${s.status})`,
      );
    }
    if (strict && !['processing', 'partially_shipped', 'shipped'].includes(s.order.status)) {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'ORDER_NOT_SHIPPABLE',
        `The order is ${s.order.status}`,
      );
    }
    const perVariant = new Map<string, number>();
    for (const i of s.items) {
      perVariant.set(i.orderItem.variantId, (perVariant.get(i.orderItem.variantId) ?? 0) + i.qty);
    }
    // Sorted so concurrent shipments lock inventory rows in the same order.
    for (const [variantId, qty] of [...perVariant].sort(([a], [b]) => a.localeCompare(b))) {
      const n = Math.min(qty, await this.orderStatus.heldReserved(tx, s.orderId, variantId));
      if (n === 0) continue; // line never reserved stock (dropship / pre-order)
      try {
        await this.inventory.move(tx, {
          variantId,
          qtyDelta: -n,
          reservedDelta: -n,
          reason: 'ship',
          refType: 'order',
          refId: s.orderId,
          staffId: actor.type === 'staff' ? (actor.id ?? undefined) : undefined,
          note: s.shipmentNo,
        });
      } catch (e) {
        if (e instanceof ConflictException) {
          if (!strict) {
            // The courier already has the parcel; record that and let staff fix the count.
            this.logger.warn(`${s.shipmentNo}: stock short for ${variantId} at courier handover`);
            continue;
          }
          throw new ShipmentError(HttpStatus.CONFLICT, 'STOCK_SHORT', 'Not enough stock on hand', {
            variantId,
          });
        }
        throw e;
      }
    }
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: 'handed_over', handedAt: new Date() },
    });
    await this.orderStatus.recompute(tx, s.orderId, actor);
  }
}
