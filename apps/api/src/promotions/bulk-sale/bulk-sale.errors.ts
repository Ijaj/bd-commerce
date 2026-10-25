import { HttpException, type HttpStatus } from '@nestjs/common';

export type BulkSaleErrorCode = 'BULK_SALE_NOT_FOUND' | 'BULK_SALE_TOO_MANY' | 'BULK_SALE_UNDONE';

/** Same wire shape as CommerceError (stable `code` next to `message`). */
export class BulkSaleError extends HttpException {
  constructor(status: HttpStatus, code: BulkSaleErrorCode, message: string) {
    super({ statusCode: status, message, code }, status);
  }
}
