import type { components } from '@bdc/api-client';

export type Shipment = components['schemas']['ShipmentDto'];
export type ShipmentStatus = Shipment['status'];

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  awaiting_supplier: 'Awaiting supplier',
  supplier_confirmed: 'Supplier confirmed',
  ready: 'Ready',
  booked: 'Booked',
  handed_over: 'Handed over',
  in_transit: 'In transit',
  delivered: 'Delivered',
  failed: 'Failed',
  returning: 'Returning',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export const STATUS_COLOR: Record<ShipmentStatus, string> = {
  pending: 'gray',
  awaiting_supplier: 'gray',
  supplier_confirmed: 'gray',
  ready: 'blue',
  booked: 'blue',
  handed_over: 'blue',
  in_transit: 'blue',
  delivered: 'green',
  failed: 'red',
  returning: 'yellow',
  returned: 'yellow',
  cancelled: 'gray',
};

/**
 * The API has no courier list endpoint (see board); these are the seeded codes.
 * An inactive one is rejected by the API with COURIER_INACTIVE.
 */
export const COURIER_OPTIONS = [
  { value: 'steadfast', label: 'Steadfast' },
  { value: 'pathao', label: 'Pathao' },
  { value: 'fake', label: 'Fake (testing)' },
];

export type ShipmentAction = 'book' | 'rebook' | 'cancel' | 'handover' | 'sync' | 'label';

/** Mirrors the API state machine (shipment-booking.service.ts); the API stays the authority. */
export function allowedActions(status: ShipmentStatus): ShipmentAction[] {
  switch (status) {
    case 'pending':
    case 'awaiting_supplier':
    case 'supplier_confirmed':
      return ['cancel'];
    case 'ready':
      return ['book', 'rebook', 'cancel', 'label'];
    case 'booked':
      return ['handover', 'sync', 'rebook', 'cancel', 'label'];
    case 'handed_over':
    case 'in_transit':
    case 'returning':
      return ['sync', 'label'];
    default:
      return [];
  }
}

/** Real couriers cannot cancel through their API; staff then cancels in the courier's panel. */
export function needsManualCancel(code: string | null): boolean {
  return code === 'COURIER_CANCEL_FAILED';
}

export interface OrderLine {
  id: string;
  qty: number;
  qtyCancelled: number;
}

/** Units of each order line not yet on a live (non-cancelled) shipment. */
export function freeQuantities(
  lines: readonly OrderLine[],
  shipments: readonly Pick<Shipment, 'status' | 'items'>[],
): Map<string, number> {
  const used = new Map<string, number>();
  for (const s of shipments) {
    if (s.status === 'cancelled') continue;
    for (const i of s.items) used.set(i.orderItemId, (used.get(i.orderItemId) ?? 0) + i.qty);
  }
  return new Map(
    lines.map((l) => [l.id, Math.max(0, l.qty - l.qtyCancelled - (used.get(l.id) ?? 0))]),
  );
}

export const MAX_LABELS = 50;

/** Parses `?ids=a,b,c` for the bulk label route: trimmed, de-duplicated. */
export function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}
