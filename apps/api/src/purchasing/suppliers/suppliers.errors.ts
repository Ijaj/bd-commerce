import { HttpException, type HttpStatus } from '@nestjs/common';

export type SupplierErrorCode =
  | 'SUPPLIER_NOT_FOUND'
  | 'SUPPLIER_NAME_TAKEN'
  | 'SUPPLIER_PHONE_INVALID'
  | 'VARIANT_NOT_FOUND'
  | 'LINK_NOT_FOUND'
  | 'LEDGER_ENTRY_NOT_FOUND'
  | 'LEDGER_ALREADY_REVERSED'
  | 'LEDGER_NOT_REVERSIBLE'
  | 'LEDGER_OVERFLOW';

/** Same body shape as CommerceError; own type so the shared code union stays untouched. */
export class SupplierError extends HttpException {
  constructor(
    status: HttpStatus,
    code: SupplierErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
