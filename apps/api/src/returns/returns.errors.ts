import { HttpException, type HttpStatus } from '@nestjs/common';

export type ReturnErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'RETURN_NOT_FOUND'
  | 'REFUND_NOT_FOUND'
  | 'ORDER_NOT_DELIVERED'
  | 'RETURN_WINDOW_CLOSED'
  | 'RETURN_QTY_EXCEEDED'
  | 'RETURN_BAD_STATE'
  | 'RETURN_INVALID'
  | 'MEDIA_NOT_FOUND'
  | 'REFUND_BAD_STATE'
  | 'REFUND_INVALID'
  | 'REFUND_EXISTS'
  | 'REFUND_EXCEEDS_PAID'
  | 'SAME_STAFF';

/** Same wire shape as CommerceError (stable `code` next to `message`); own union so the orders module stays untouched. */
export class ReturnError extends HttpException {
  constructor(
    status: HttpStatus,
    code: ReturnErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
