import { HttpException, type HttpStatus } from '@nestjs/common';

export type CommerceErrorCode =
  | 'CART_EMPTY'
  | 'CART_CHANGED'
  | 'OUT_OF_STOCK'
  | 'OTP_REQUIRED'
  | 'OTP_INVALID'
  | 'ADDRESS_INVALID'
  | 'NO_DELIVERY_ZONE'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'VARIANT_NOT_FOUND'
  | 'UPCOMING'
  | 'ADDRESS_NOT_FOUND'
  | 'ADDRESS_LIMIT'
  | 'ORDER_NOT_FOUND'
  | 'ZONE_NOT_FOUND'
  | 'ZONE_IN_USE'
  | 'ZONE_DEFAULT'
  | 'LOCATION_TAKEN'
  | 'LOCATION_INVALID'
  | 'TOO_MANY_REQUESTS'
  | 'GUEST_REQUIRED'
  | 'TOO_MANY_ORDERS'
  | 'GUEST_LIMIT'
  | 'FLASH_LIMIT'
  | 'FLASH_SOLD_OUT'
  | 'COUPON_INVALID'
  | 'COUPON_LIMIT';

/** Error with a stable machine-readable `code` next to the human `message`. */
export class CommerceError extends HttpException {
  constructor(
    status: HttpStatus,
    code: CommerceErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
