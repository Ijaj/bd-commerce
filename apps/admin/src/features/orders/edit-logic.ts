import type { EditInput } from './api';
import type { EditRecord, OrderDetail } from './queries';

/** Mirrors the API rule (order-edit.service): open statuses and nothing booked or sent. */
export const EDITABLE_STATUSES = ['processing', 'on_hold', 'pending_payment'];
const FROZEN_SHIPMENTS = [
  'booked',
  'handed_over',
  'in_transit',
  'delivered',
  'failed',
  'returning',
  'returned',
];

export function canEditOrder(order: Pick<OrderDetail, 'status' | 'shipments'>): boolean {
  return (
    EDITABLE_STATUSES.includes(order.status) &&
    !order.shipments.some((s) => FROZEN_SHIPMENTS.includes(s.status))
  );
}

export interface DraftLine {
  key: string;
  /** Null for a line added in this drawer. */
  orderItemId: string | null;
  variantId: string;
  title: string;
  sub: string;
  qty: number;
  /** Quantity on the order now (0 for a new line). */
  origQty: number;
  /** Price per unit on the order; null until a preview prices a new line. */
  unitPriceP: number | null;
  maxQty?: number;
}

export interface ShipDraft {
  name: string;
  phone: string;
  line: string;
  landmark: string;
  districtId: string | null;
  upazilaId: string | null;
}

export interface EditDraft {
  lines: DraftLine[];
  ship: ShipDraft;
  note: string;
}

export function initialDraft(order: OrderDetail): EditDraft {
  return {
    lines: order.items
      .filter((i) => i.qty - i.qtyCancelled > 0)
      .map((i) => ({
        key: i.id,
        orderItemId: i.id,
        variantId: i.variantId,
        title: i.titleSnapshot,
        sub: [i.optionsText, i.sku].filter(Boolean).join(' · '),
        qty: i.qty - i.qtyCancelled,
        origQty: i.qty - i.qtyCancelled,
        unitPriceP: i.unitPriceP,
      })),
    ship: {
      name: order.shipTo.name,
      phone: order.shipTo.phone,
      line: order.shipTo.line,
      landmark: order.shipTo.landmark ?? '',
      districtId: String(order.shipTo.districtId),
      upazilaId: String(order.shipTo.upazilaId),
    },
    note: '',
  };
}

/** Only what differs from the order goes to the API (omitted = unchanged). */
export function buildEditBody(draft: EditDraft, order: OrderDetail): EditInput {
  const body: EditInput = {};
  const linesChanged =
    draft.lines.some((l) => l.orderItemId === null || l.qty !== l.origQty) ||
    order.items.some(
      (i) => i.qty - i.qtyCancelled > 0 && !draft.lines.some((l) => l.orderItemId === i.id),
    );
  if (linesChanged) {
    body.lines = draft.lines.map((l) =>
      l.orderItemId
        ? { orderItemId: l.orderItemId, qty: l.qty }
        : { variantId: l.variantId, qty: l.qty },
    );
  }
  const s = draft.ship;
  const cur = order.shipTo;
  const ship: NonNullable<EditInput['ship']> = {};
  if (s.name.trim() !== cur.name) ship.name = s.name.trim();
  if (s.phone.trim() !== cur.phone) ship.phone = s.phone.trim();
  if (s.line.trim() !== cur.line) ship.line = s.line.trim();
  if (s.landmark.trim() !== (cur.landmark ?? '')) ship.landmark = s.landmark.trim() || null;
  if (s.upazilaId && Number(s.upazilaId) !== cur.upazilaId) ship.upazilaId = Number(s.upazilaId);
  if (Object.keys(ship).length > 0) body.ship = ship;
  if (draft.note.trim()) body.note = draft.note.trim();
  return body;
}

/** Something other than the reason changed, so a preview and a save mean something. */
export function hasChanges(body: EditInput): boolean {
  return body.lines !== undefined || body.ship !== undefined;
}

/** One-line facts for the history list: what moved between the two snapshots. */
export function describeEdit(e: Pick<EditRecord, 'before' | 'after'>): string[] {
  const out: string[] = [];
  const qtyOf = (lines: EditRecord['before']['lines']) => {
    const m = new Map<string, { title: string; qty: number }>();
    for (const l of lines) {
      const k = `${l.variantId}@${l.unitPriceP}`;
      m.set(k, { title: l.title, qty: (m.get(k)?.qty ?? 0) + l.qty });
    }
    return m;
  };
  const a = qtyOf(e.before.lines);
  const b = qtyOf(e.after.lines);
  for (const [k, v] of b) {
    const was = a.get(k)?.qty ?? 0;
    if (was === 0) out.push(`Added ${v.qty} x ${v.title}`);
    else if (was !== v.qty) out.push(`${v.title}: ${was} to ${v.qty}`);
  }
  for (const [k, v] of a) if (!b.has(k)) out.push(`Removed ${v.qty} x ${v.title}`);
  const sa = e.before.ship;
  const sb = e.after.ship;
  if (sa.placeText !== sb.placeText) out.push(`Area: ${sa.placeText} to ${sb.placeText}`);
  if (sa.zoneName !== sb.zoneName) out.push(`Zone: ${sa.zoneName} to ${sb.zoneName}`);
  if (sa.name !== sb.name) out.push('Name changed');
  if (sa.phone !== sb.phone) out.push('Phone changed');
  if (sa.line !== sb.line || sa.landmark !== sb.landmark) out.push('Address line changed');
  return out;
}
