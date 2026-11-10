import { HttpException, type HttpStatus } from '@nestjs/common';

export type OrderEditErrorCode =
  | 'ORDER_NOT_EDITABLE'
  | 'SHIPMENT_BOOKED'
  | 'STOCK_SHORT'
  | 'FLASH_LIMIT'
  | 'EMPTY_ORDER'
  | 'VARIANT_UNAVAILABLE'
  | 'ADDRESS_UNSERVICEABLE'
  | 'EDIT_INVALID';

/** Same body shape as CommerceError (statusCode, message, stable code) plus optional detail fields. */
export class OrderEditError extends HttpException {
  constructor(
    status: HttpStatus,
    code: OrderEditErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
