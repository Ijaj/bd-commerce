import { HttpStatus, Injectable } from '@nestjs/common';
import { OrderCancelService } from '../orders-admin/order-cancel.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceError } from './commerce.errors';
import { OrderNotifyService } from './order-notify.service';
import { OrdersService } from './orders.service';

const SENT_OR_LATER = ['handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned'];

/** A3: the customer (or a guest with the order number + phone) cancels before hand-off. */
@Injectable()
export class OrderSelfCancelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cancel: OrderCancelService,
    private readonly orders: OrdersService,
    private readonly notify: OrderNotifyService,
  ) {}

  /** Account page: the order must belong to the signed-in customer. */
  async forCustomer(customerId: string, orderNo: string, reason: string | undefined) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, customerId },
      select: { id: true },
    });
    if (!order)
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
    await this.run(order.id, customerId, reason);
    return this.orders.detail(customerId, orderNo);
  }

  /** Track page: same phone check and throttle as tracking; account orders need a login. */
  async forGuest(
    orderNo: string,
    phone: string,
    reason: string | undefined,
    ip: string | undefined,
  ) {
    const found = await this.orders.findTracked(orderNo, phone, ip);
    if (found.customerId) {
      throw new CommerceError(
        HttpStatus.FORBIDDEN,
        'LOGIN_REQUIRED',
        'Please sign in to your account to cancel this order.',
      );
    }
    await this.run(found.orderId, null, reason);
    return this.orders.trackView(found.orderId, found.phone);
  }

  private async run(orderId: string, customerId: string | null, reason: string | undefined) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const o = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true, shipments: { select: { status: true } } },
      });
      if (o.status === 'on_hold') {
        throw new CommerceError(
          HttpStatus.CONFLICT,
          'ORDER_ON_HOLD',
          'This order is on hold. Please contact support to cancel it.',
        );
      }
      if (o.status !== 'processing' && o.status !== 'pending_payment') {
        throw new CommerceError(
          HttpStatus.CONFLICT,
          'ORDER_NOT_CANCELLABLE',
          'This order can no longer be cancelled.',
        );
      }
      if (o.shipments.some((s) => SENT_OR_LATER.includes(s.status))) {
        throw new CommerceError(
          HttpStatus.CONFLICT,
          'ORDER_NOT_CANCELLABLE',
          'This order has already been handed to the courier.',
        );
      }
      if (o.shipments.some((s) => s.status === 'booked')) {
        throw new CommerceError(
          HttpStatus.CONFLICT,
          'SHIPMENT_BOOKED',
          'This order is already being prepared for the courier. Please contact support.',
        );
      }
      await this.cancel.cancelInTx(
        tx,
        orderId,
        { type: 'customer', id: customerId },
        reason ? `customer: ${reason}` : 'customer',
      );
    });
    await this.notify.event(orderId, 'cancelled');
  }
}
