import { notifications } from '@mantine/notifications';
import { HttpError } from '~/features/categories/http';

const MESSAGES: Record<string, string> = {
  SUPPLIER_NAME_TAKEN: 'Another supplier already uses this name.',
  SUPPLIER_PHONE_INVALID: 'Enter a valid Bangladesh mobile number, like 01712345678.',
  LEDGER_ALREADY_REVERSED: 'This entry was already reversed.',
  LEDGER_NOT_REVERSIBLE: 'Only payments and adjustments can be reversed.',
  LEDGER_OVERFLOW: 'This would push the balance past the supported limit. Nothing was changed.',
};

export function errorCode(e: unknown): string | null {
  if (!(e instanceof HttpError)) return null;
  const code = (e.body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/** Friendly text for known supplier codes, the API's own message otherwise. */
export function friendlyMessage(e: unknown, fallback: string): string {
  const code = errorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}

export function notifyApiError(e: unknown, fallback = 'Something went wrong') {
  notifications.show({ color: 'red', message: friendlyMessage(e, fallback) });
}
