import { notifications } from '@mantine/notifications';
import { errorCode } from '~/features/b2b/errors';
import { HttpError } from '~/features/categories/http';

const MESSAGES: Record<string, string> = {
  COUPON_CODE_TAKEN: 'That code is already used by another coupon. Pick a different one.',
  COUPON_REDEEMED:
    'This coupon was already used in orders, so it cannot be deleted. Pause it instead.',
  COUPON_LOCKED: 'Type, code and bulk mode cannot change once the coupon was redeemed.',
  COUPON_NOT_BULK: 'Only bulk coupons have generated codes.',
  COUPON_CODES_LIMIT: 'That would go over the maximum number of codes for one coupon.',
  COUPON_NOT_ENOUGH_CODES: 'Not enough unassigned codes left. Generate more first.',
  COUPON_NOT_ACTIVE: 'Activate the coupon first.',
  COUPON_TARGET_NOT_FOUND:
    'A product, category or brand in the scope no longer exists. Remove it and try again.',
  CUSTOMER_NOT_FOUND: 'That customer no longer exists.',
};

/** `issues[]` of a 422 COUPON_CONFIG_INVALID, or [] for any other error. */
export function couponIssues(e: unknown): string[] {
  if (!(e instanceof HttpError) || errorCode(e) !== 'COUPON_CONFIG_INVALID') return [];
  const issues = (e.body as { issues?: unknown }).issues;
  return Array.isArray(issues) ? issues.map(String) : [];
}

export function couponErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  const code = errorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return e instanceof Error ? e.message : fallback;
}

export function notifyCouponError(e: unknown, fallback?: string) {
  notifications.show({ color: 'red', message: couponErrorMessage(e, fallback) });
}
