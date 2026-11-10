import type { Prisma } from '../generated/prisma/client';

/** Select for the shipments a customer (or the public track page) may see. */
export const CUSTOMER_SHIPMENT_SELECT = {
  shipmentNo: true,
  status: true,
  consignmentId: true,
  trackingUrl: true,
  handedAt: true,
  deliveredAt: true,
  courier: { select: { code: true, name: true } },
  items: {
    orderBy: { id: 'asc' },
    select: { qty: true, orderItem: { select: { titleSnapshot: true } } },
  },
} satisfies Prisma.ShipmentSelect;

export type CustomerShipmentRow = Prisma.ShipmentGetPayload<{
  select: typeof CUSTOMER_SHIPMENT_SELECT;
}>;

export type CustomerShipmentStatus =
  | 'preparing'
  | 'with_courier'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'returning'
  | 'returned';

/** Shipment statuses while the goods are still with us. */
const PREPARING = ['pending', 'awaiting_supplier', 'supplier_confirmed', 'ready', 'booked'];

function customerStatus(status: string): CustomerShipmentStatus | null {
  if (status === 'cancelled') return null;
  if (PREPARING.includes(status)) return 'preparing';
  if (status === 'handed_over') return 'with_courier';
  return status as CustomerShipmentStatus;
}

/** Courier and tracking are shown only once the parcel is handed over (a booking can still be redone). */
export function toCustomerShipments(rows: CustomerShipmentRow[]) {
  const out = [];
  for (const s of rows) {
    const status = customerStatus(s.status);
    if (!status) continue;
    const sent = status !== 'preparing';
    out.push({
      shipmentNo: s.shipmentNo,
      status,
      courier: sent && s.courier ? { code: s.courier.code, name: s.courier.name } : null,
      trackingId: sent ? s.consignmentId : null,
      trackingUrl: sent ? s.trackingUrl : null,
      handedAt: s.handedAt?.toISOString() ?? null,
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      items: s.items.map((i) => ({ title: i.orderItem.titleSnapshot, qty: i.qty })),
    });
  }
  return out;
}

/**
 * Customers may cancel only before anything leaves: processing / pending_payment, no booked or
 * sent shipment. (on_hold is refused with a "contact support" message, not offered.)
 */
export function canCustomerCancel(status: string, shipmentStatuses: string[]) {
  if (status !== 'processing' && status !== 'pending_payment') return false;
  return shipmentStatuses.every(
    (s) => s === 'cancelled' || (s !== 'booked' && PREPARING.includes(s)),
  );
}
