import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SmsService } from '../sms/sms.service';
import { bnDigits, buildNotice, noticeExtra, takaText } from './order-notify-texts';

export interface PlacedOrderNotice {
  orderNo: string;
  lang: 'en' | 'bn';
  grandTotalP: number;
  codDueP: number;
  phone: string | null;
  email: string | null;
  etaMinDays: number;
  etaMaxDays: number;
}

/** Order events that notify the customer (A2). Keys match the `order_notifications` setting (camelCase there). */
export type OrderNotifyKind =
  | 'confirmed'
  | 'handed_over'
  | 'delivered'
  | 'cancelled'
  | 'refund_paid'
  | 'delivery_failed'
  | 'edited';

/** Setting key (camelCase) per event kind. */
const SETTING_FLAG = {
  confirmed: 'confirmed',
  handed_over: 'handedOver',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refund_paid: 'refundPaid',
  delivery_failed: 'deliveryFailed',
  edited: 'edited',
} as const satisfies Record<OrderNotifyKind, string>;

export { takaText };

@Injectable()
export class OrderNotifyService {
  private readonly logger = new Logger(OrderNotifyService.name);

  constructor(
    private readonly sms: SmsService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Customer SMS + mail for an order event, gated by the `order_notifications` setting. Call it
   * after the transaction commits. Never throws: a failure is logged and the caller carries on.
   * `extra` may carry shipmentNo, courierName, trackingId, trackingUrl, reason, amountP, method,
   * editId. Guest orders use the order's own phone/email.
   */
  async event(orderId: string, kind: OrderNotifyKind, extra: Record<string, unknown> = {}) {
    try {
      const flags = await this.settings.get('order_notifications');
      if (!flags[SETTING_FLAG[kind]]) return;
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          orderNo: true,
          lang: true,
          grandTotalP: true,
          guestPhone: true,
          guestEmail: true,
          shipPhone: true,
          customer: { select: { phone: true, email: true } },
          shipments: { where: { status: { not: 'cancelled' } }, select: { id: true } },
        },
      });
      if (!order) return;
      const x = noticeExtra(extra);
      const { subject, text } = buildNotice(kind, {
        orderNo: order.orderNo,
        lang: order.lang,
        grandTotalP: order.grandTotalP,
        ...x,
        // Name the parcel only when the order has several.
        shipmentNo: order.shipments.length > 1 ? x.shipmentNo : null,
      });
      const phone = order.customer?.phone ?? order.guestPhone ?? order.shipPhone ?? null;
      const email = order.customer?.email ?? order.guestEmail ?? null;
      if (phone) this.sms.send({ to: phone, text });
      if (email) this.mail.send({ to: email, subject, text });
      if (kind === 'edited' && typeof extra.editId === 'string') {
        await this.prisma.orderEdit.updateMany({
          where: { id: extra.editId, orderId, customerNotifiedAt: null },
          data: { customerNotifiedAt: new Date() },
        });
      }
    } catch (err) {
      this.logger.error(`Order notification ${kind} for ${orderId} failed: ${String(err)}`);
    }
  }

  /** Fire-and-forget; SmsService and MailService never throw. */
  placed(n: PlacedOrderNotice) {
    const bn = n.lang === 'bn';
    const eta =
      n.etaMinDays === n.etaMaxDays ? `${n.etaMinDays}` : `${n.etaMinDays}-${n.etaMaxDays}`;
    const text = bn
      ? bnDigits(
          `অর্ডার ${n.orderNo} গ্রহণ করা হয়েছে। মোট ৳${takaText(n.grandTotalP)}, ডেলিভারিতে পরিশোধ করুন। ${eta} দিনের মধ্যে পাবেন।`,
        )
      : `Order ${n.orderNo} received. Total Tk ${takaText(n.grandTotalP)}, pay on delivery. Expected in ${eta} days.`;
    if (n.phone) this.sms.send({ to: n.phone, text });
    if (n.email) {
      this.mail.send({
        to: n.email,
        subject: bn ? bnDigits(`অর্ডার ${n.orderNo} নিশ্চিত`) : `Order ${n.orderNo} confirmed`,
        text,
      });
    }
  }
}
