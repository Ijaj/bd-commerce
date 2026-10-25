import { HttpStatus } from '@nestjs/common';
import { CouponError } from './coupons.errors';

export const notFound = () =>
  new CouponError(HttpStatus.NOT_FOUND, 'COUPON_NOT_FOUND', 'Coupon not found.');

export function invalid(issues: string[]) {
  return new CouponError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'COUPON_CONFIG_INVALID',
    issues[0] ?? 'Invalid coupon.',
    { issues },
  );
}

export const taken = () =>
  new CouponError(HttpStatus.CONFLICT, 'COUPON_CODE_TAKEN', 'That code is already in use.');
