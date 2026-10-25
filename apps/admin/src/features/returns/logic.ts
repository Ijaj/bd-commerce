import type { RefundStatus, ReturnReason, ReturnStatus } from './queries';

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  pickup_booked: 'Pickup booked',
  received: 'Received',
  inspected: 'Inspected',
  closed: 'Closed',
};

export const RETURN_STATUS_COLOR: Record<ReturnStatus, string> = {
  requested: 'yellow',
  approved: 'blue',
  rejected: 'red',
  pickup_booked: 'blue',
  received: 'blue',
  inspected: 'blue',
  closed: 'green',
};

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  pending_approval: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing',
  done: 'Done',
  failed: 'Failed',
};

export const REFUND_STATUS_COLOR: Record<RefundStatus, string> = {
  pending_approval: 'yellow',
  approved: 'blue',
  rejected: 'red',
  processing: 'blue',
  done: 'green',
  failed: 'red',
};

export const REASON_LABEL: Record<ReturnReason, string> = {
  wrong_item: 'Wrong item',
  damaged: 'Arrived damaged',
  defective: 'Defective',
  not_as_described: 'Not as described',
  change_of_mind: 'Change of mind',
  other: 'Other',
};

export const REASON_OPTIONS = (Object.keys(REASON_LABEL) as ReturnReason[]).map((value) => ({
  value,
  label: REASON_LABEL[value],
}));

/** Happy path in order; `rejected` branches off after requested/approved. */
export const RETURN_STEPS: ReturnStatus[] = [
  'requested',
  'approved',
  'pickup_booked',
  'received',
  'inspected',
  'closed',
];

export type StepState = 'done' | 'current' | 'todo' | 'skipped';

/** Pickup booking is optional (approved -> received is allowed), so it shows as skipped once passed. */
export function stepStates(status: ReturnStatus): { step: ReturnStatus; state: StepState }[] {
  const steps: ReturnStatus[] = status === 'rejected' ? ['requested', 'rejected'] : RETURN_STEPS;
  const at = steps.indexOf(status);
  return steps.map((step, i) => ({
    step,
    state: i < at ? 'done' : i === at ? 'current' : 'todo',
  }));
}

export function isTerminalReturn(s: ReturnStatus) {
  return s === 'rejected' || s === 'closed';
}

/** Which workflow buttons make sense; mirrors the API's from-status lists (it stays the authority). */
export function returnActions(status: ReturnStatus) {
  return {
    approve: status === 'requested',
    reject: status === 'requested' || status === 'approved',
    pickupBooked: status === 'approved',
    receive: status === 'approved' || status === 'pickup_booked',
    inspect: status === 'received',
    close: status === 'inspected',
    refund: status === 'inspected' || status === 'closed',
  };
}

export const LIVE_REFUND: RefundStatus[] = ['pending_approval', 'approved', 'processing', 'done'];

/** Units of a line staff can still put on a new return (the API also subtracts open returns). */
export function returnableQty(line: { qtyShipped: number; qtyReturned: number }) {
  return Math.max(0, line.qtyShipped - line.qtyReturned);
}

/** Inspection default: resellable and restocked; damaged can never be restocked. */
export function inspectDefaults(items: { id: string }[]) {
  return Object.fromEntries(
    items.map((i) => [
      i.id,
      { condition: 'resellable' as 'resellable' | 'damaged', restock: true },
    ]),
  );
}

export function restockAllowed(condition: 'resellable' | 'damaged') {
  return condition === 'resellable';
}
