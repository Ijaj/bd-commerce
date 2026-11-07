import { notifications } from '@mantine/notifications';
import { HttpError } from '~/features/categories/http';

const MESSAGES: Record<string, string> = {
  AFFILIATE_PAYOUT_CHANGED:
    'The amount due changed since you opened this. The list was refreshed; check the new total and try again.',
  AFFILIATE_BELOW_MIN: 'The balance is now below the minimum payout, so nothing was paid.',
  AFFILIATE_NOTHING_DUE: 'Nothing is due for this affiliate any more (already paid?).',
  AFFILIATE_NOT_FOUND: 'This affiliate no longer exists.',
};

export function errorCode(e: unknown): string | null {
  if (!(e instanceof HttpError)) return null;
  const code = (e.body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/** Friendly text for known affiliate codes, the API's own message otherwise. */
export function friendlyMessage(e: unknown, fallback: string): string {
  const code = errorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}

export function notifyApiError(e: unknown, fallback = 'Something went wrong') {
  notifications.show({ color: 'red', message: friendlyMessage(e, fallback) });
}
