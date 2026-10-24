import { HttpException, type HttpStatus } from '@nestjs/common';

export type OrdersAdminErrorCode =
  | 'ORDER_NOT_CANCELLABLE'
  | 'ORDER_NOT_HOLDABLE'
  | 'ORDER_NOT_ON_HOLD'
  | 'SHIPMENT_SENT'
  | 'SHIPMENT_BOOKED'
  | 'CALL_NOT_PENDING';

/** Same body shape as CommerceError (statusCode, message, stable code). */
export class OrdersAdminError extends HttpException {
  constructor(status: HttpStatus, code: OrdersAdminErrorCode, message: string) {
    super({ statusCode: status, message, code }, status);
  }
}
