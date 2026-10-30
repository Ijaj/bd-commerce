import { notifications } from '@mantine/notifications';
import { HttpError } from '~/features/categories/http';

const MESSAGES: Record<string, string> = {
  SUPPLIER_INACTIVE: 'This supplier is paused. Reactivate it before ordering.',
  PO_DROPSHIP_VARIANT: 'Dropship products cannot go on a purchase order.',
  PO_LOCKED: 'This purchase order was already sent, so its lines can no longer change.',
  PO_BAD_STATUS: 'The purchase order is no longer in a state that allows this. Reload and retry.',
  PO_NOTHING_RECEIVED: 'Enter a quantity for at least one line.',
  PO_EMPTY: 'Add at least one line before sending.',
};

export function errorCode(e: unknown): string | null {
  if (!(e instanceof HttpError)) return null;
  const code = (e.body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

export function poErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const code = errorCode(e);
  if (code === 'PO_OVER_RECEIVE') {
    const remaining = (e as HttpError & { body: { remaining?: unknown } }).body?.remaining;
    return typeof remaining === 'number'
      ? `More than is still outstanding was entered (remaining: ${remaining}). Reload and retry.`
      : 'More than is still outstanding was entered. Reload and retry.';
  }
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}

export function notifyPoError(e: unknown, fallback?: string) {
  notifications.show({ color: 'red', message: poErrorMessage(e, fallback) });
}
