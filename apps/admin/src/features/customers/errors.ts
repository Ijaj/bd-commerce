import { notifications } from '@mantine/notifications';
import { HttpError } from '~/features/categories/http';

const MESSAGES: Record<string, string> = {
  CUSTOMER_ALREADY_BLOCKED: 'This customer is already blocked. The page was refreshed.',
  CUSTOMER_NOT_BLOCKED: 'This customer is not blocked any more. The page was refreshed.',
  CUSTOMER_NOT_FOUND: 'This customer no longer exists.',
};

export function errorCode(e: unknown): string | null {
  if (!(e instanceof HttpError)) return null;
  const code = (e.body as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

export function friendlyMessage(e: unknown, fallback: string): string {
  const code = errorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}

export function notifyApiError(e: unknown, fallback = 'Something went wrong') {
  notifications.show({ color: 'red', message: friendlyMessage(e, fallback) });
}
