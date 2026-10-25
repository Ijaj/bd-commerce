import type { OrderForReturn, ReturnReason, ReturnStatus } from './types';

export const REASONS: ReturnReason[] = [
  'wrong_item',
  'damaged',
  'defective',
  'not_as_described',
  'change_of_mind',
  'other',
];

/** Happy path of a return, in order. `rejected` ends the path after `requested`. */
const FLOW: ReturnStatus[] = [
  'requested',
  'approved',
  'pickup_booked',
  'received',
  'inspected',
  'closed',
];

export type StepState = 'done' | 'current' | 'upcoming';

/** Steps shown on the return page with their state; the API gives no event dates, only the status. */
export function returnSteps(status: ReturnStatus): { status: ReturnStatus; state: StepState }[] {
  if (status === 'rejected') {
    return [
      { status: 'requested', state: 'done' },
      { status: 'rejected', state: 'current' },
    ];
  }
  const at = FLOW.indexOf(status);
  return FLOW.map((s, i) => ({
    status: s,
    state: i < at ? 'done' : i === at ? 'current' : 'upcoming',
  }));
}

const RETURNABLE_STATUSES = ['delivered', 'completed'];

/** Lines that can go into a request: they have an id and units left to return. */
export function returnableLines(o: OrderForReturn) {
  return o.items.filter(
    (it): it is typeof it & { orderItemId: string } =>
      typeof it.orderItemId === 'string' && (it.returnableQty ?? 0) > 0,
  );
}

/**
 * Whether to offer "Request return". Only delivered/completed orders; if the API reports
 * returnableQty we hide the link when nothing is left, otherwise we let the API decide on submit.
 */
export function canRequestReturn(o: OrderForReturn): boolean {
  if (!RETURNABLE_STATUSES.includes(o.status)) return false;
  const reported = o.items.some((it) => it.returnableQty !== undefined);
  return reported ? o.items.some((it) => (it.returnableQty ?? 0) > 0) : true;
}

const INVOICE_STATUSES = ['shipped', 'partially_shipped', 'delivered', 'completed'];

/** Same rule as the API: an invoice exists once the order has shipped. */
export function canViewInvoice(o: Pick<OrderForReturn, 'status'>): boolean {
  return INVOICE_STATUSES.includes(o.status);
}

export type DraftLine = { checked: boolean; qty: number; reason: ReturnReason; note: string };

/** Body for POST /v1/customer/returns from the form state. Unchecked lines are dropped. */
export function buildReturnBody(orderNo: string, lines: Record<string, DraftLine>) {
  const items = Object.entries(lines)
    .filter(([, l]) => l.checked && l.qty > 0)
    .map(([orderItemId, l]) => ({
      orderItemId,
      qty: l.qty,
      reason: l.reason,
      ...(l.note.trim() ? { note: l.note.trim() } : {}),
    }));
  return { orderNo, items };
}
