import { HttpException, type HttpStatus } from '@nestjs/common';

export type DocumentsErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'INVOICE_NOT_FOUND'
  | 'INVOICE_NOT_AVAILABLE'
  | 'SHIPMENT_NOT_FOUND';

/** Same body shape as CommerceError; own type so the shared code union stays untouched. */
export class DocumentsError extends HttpException {
  constructor(
    status: HttpStatus,
    code: DocumentsErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
