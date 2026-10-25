import type { CallStatus, OrderStatus, PaymentStatus } from './api';
import type { OrderDetail } from './queries';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pending payment',
  processing: 'Processing',
  on_hold: 'On hold',
  partially_shipped: 'Partially shipped',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: 'yellow',
  processing: 'blue',
  on_hold: 'orange',
  partially_shipped: 'cyan',
  shipped: 'indigo',
  delivered: 'teal',
  completed: 'green',
  cancelled: 'gray',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  failed: 'Failed',
};

export const PAYMENT_COLOR: Record<PaymentStatus, string> = {
  unpaid: 'yellow',
  partially_paid: 'orange',
  paid: 'teal',
  partially_refunded: 'grape',
  refunded: 'gray',
  failed: 'red',
};

export const CALL_LABEL: Record<CallStatus, string> = {
  not_needed: 'No call needed',
  pending: 'Call pending',
  confirmed: 'Confirmed',
  unreachable: 'Unreachable',
  cancelled: 'Cancelled by call',
};

export const CALL_COLOR: Record<CallStatus, string> = {
  not_needed: 'gray',
  pending: 'yellow',
  confirmed: 'teal',
  unreachable: 'orange',
  cancelled: 'red',
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as OrderStatus[]).map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));
export const PAYMENT_OPTIONS = (Object.keys(PAYMENT_LABEL) as PaymentStatus[]).map((value) => ({
  value,
  label: PAYMENT_LABEL[value],
}));
export const CALL_OPTIONS = (Object.keys(CALL_LABEL) as CallStatus[]).map((value) => ({
  value,
  label: CALL_LABEL[value],
}));

/** "booked" means a courier already holds the parcel; the API refuses a cancel until it is cancelled. */
export function hasBookedShipment(order: Pick<OrderDetail, 'shipments'>): boolean {
  return order.shipments.some((s) => s.status === 'booked');
}

export type OrderAction = 'hold' | 'resume' | 'cancel' | 'call';

/** Mirrors the API rules (orders-admin.service hold, order-cancel.service); the API still has the last word. */
export function availableActions(order: OrderDetail): Record<OrderAction, boolean> {
  const sentOut = order.shipments.some((s) =>
    ['handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned'].includes(
      s.status,
    ),
  );
  return {
    hold: order.status === 'processing' || order.status === 'partially_shipped',
    resume: order.status === 'on_hold',
    cancel: ['pending_payment', 'processing', 'on_hold'].includes(order.status) && !sentOut,
    call: order.call.status === 'pending',
  };
}

/** Why cancel is blocked, or null. */
export function cancelBlockedReason(order: OrderDetail): string | null {
  if (hasBookedShipment(order)) {
    return 'A shipment is booked with the courier. Cancel the shipment first, then cancel the order.';
  }
  return null;
}

/** Each risk reason adds 10 points; show escalating colour so the queue is scannable. */
export function riskColor(score: number): string {
  if (score >= 30) return 'red';
  if (score >= 20) return 'orange';
  return 'yellow';
}

export const RISK_REASON_LABEL: Record<string, string> = {
  velocity_phone: 'Many orders from this phone',
  velocity_ip: 'Many orders from this IP',
  cod_high: 'High COD amount',
  first_guest: 'First guest order',
};

export function riskReasonText(reason: string): string {
  return RISK_REASON_LABEL[reason] ?? reason.replace(/[_-]/g, ' ');
}

export function actorText(h: { actorType: string; actorName: string | null }): string {
  if (h.actorName) return h.actorName;
  return h.actorType === 'system'
    ? 'System'
    : h.actorType === 'customer'
      ? 'Customer'
      : h.actorType;
}
