import { notifications } from '@mantine/notifications';
import { HttpError } from '~/features/categories/http';

const MESSAGES: Record<string, string> = {
  SELF_CONFIRM: 'You recorded this collection yourself, so someone else has to confirm it.',
  LEDGER_OVERFLOW:
    "This would push the shop's balance past the supported limit. Nothing was changed.",
  TOO_MANY_OPEN_SALES:
    'This rep already has too many sales waiting for approval. Approve or reject some first.',
};

/** API error code (`{ message, code }` bodies) or null. */
export function errorCode(e: unknown): string | null {
  if (!(e instanceof HttpError)) return null;
  const code = (e.body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/** Friendly text for known SR/B2B codes, the API's own message otherwise. */
export function friendlyMessage(e: unknown, fallback: string): string {
  const code = errorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}

export function notifyApiError(e: unknown, fallback = 'Something went wrong') {
  notifications.show({ color: 'red', message: friendlyMessage(e, fallback) });
}
