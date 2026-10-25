import { notifications } from '@mantine/notifications';
import { errorCode } from '~/features/b2b/errors';
import { formatPrice } from '~/lib/format';

/** Friendly text for return/refund codes; falls back to the API's own message (already readable). */
export function returnErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const code = errorCode(e);
  const body = (e as { body?: { maxAmountP?: number; available?: number } }).body;
  if (code === 'SAME_STAFF') {
    return 'Another staff member has to approve this refund, because you requested it.';
  }
  if (code === 'REFUND_EXCEEDS_PAID' && typeof body?.maxAmountP === 'number') {
    return `That is more than can still be refunded. At most ${formatPrice(body.maxAmountP)} is left.`;
  }
  return e instanceof Error ? e.message : fallback;
}

export function notifyReturnError(e: unknown, fallback?: string) {
  notifications.show({ color: 'red', message: returnErrorMessage(e, fallback) });
}
