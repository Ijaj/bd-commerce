import { HttpException, type HttpStatus } from '@nestjs/common';

export type ShipmentErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'SHIPMENT_NOT_FOUND'
  | 'ORDER_NOT_SHIPPABLE'
  | 'SHIPMENT_QTY_EXCEEDED'
  | 'SHIPMENT_ITEM_INVALID'
  | 'SHIPMENT_STATE'
  | 'SHIPMENT_BOOKING_IN_PROGRESS'
  | 'COURIER_NOT_FOUND'
  | 'COURIER_INACTIVE'
  | 'COURIER_NOT_CONFIGURED'
  | 'COURIER_BOOK_FAILED'
  | 'COURIER_CANCEL_FAILED'
  | 'COURIER_SYNC_FAILED'
  | 'NO_LIVE_BOOKING'
  | 'STOCK_SHORT'
  | 'COURIER_WEBHOOK_UNAUTHORIZED';

/** Same body shape as CommerceError (statusCode, message, stable `code`). */
export class ShipmentError extends HttpException {
  constructor(
    status: HttpStatus,
    code: ShipmentErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
