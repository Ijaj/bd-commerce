import { HttpException, type HttpStatus } from '@nestjs/common';

export type PoErrorCode =
  | 'PO_NOT_FOUND'
  | 'PO_ITEM_NOT_FOUND'
  | 'SUPPLIER_NOT_FOUND'
  | 'SUPPLIER_INACTIVE'
  | 'VARIANT_NOT_FOUND'
  | 'PO_DROPSHIP_VARIANT'
  | 'PO_LOCKED'
  | 'PO_BAD_STATUS'
  | 'PO_OVER_RECEIVE'
  | 'PO_NOTHING_RECEIVED'
  | 'PO_EMPTY';

/** Same wire shape as CommerceError (stable `code` next to `message`); own union so shared code stays untouched. */
export class PoError extends HttpException {
  constructor(
    status: HttpStatus,
    code: PoErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
