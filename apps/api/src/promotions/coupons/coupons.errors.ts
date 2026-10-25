import { HttpException, type HttpStatus } from '@nestjs/common';

export type CouponErrorCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_CODE_TAKEN'
  | 'COUPON_CONFIG_INVALID'
  | 'COUPON_REDEEMED'
  | 'COUPON_LOCKED'
  | 'COUPON_NOT_BULK'
  | 'COUPON_CODES_LIMIT'
  | 'COUPON_NOT_ENOUGH_CODES'
  | 'COUPON_NOT_ACTIVE'
  | 'COUPON_TARGET_NOT_FOUND'
  | 'CUSTOMER_NOT_FOUND';

/** Same wire shape as CommerceError (stable `code` next to `message`); own union so the orders module stays untouched. */
export class CouponError extends HttpException {
  constructor(
    status: HttpStatus,
    code: CouponErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
