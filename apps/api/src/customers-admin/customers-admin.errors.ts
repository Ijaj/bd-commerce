import { HttpException, type HttpStatus } from '@nestjs/common';

export type CustomerAdminErrorCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_ALREADY_BLOCKED'
  | 'CUSTOMER_NOT_BLOCKED'
  | 'CUSTOMER_BLOCKED';

/** Same body shape as CommerceError; own type so the shared code union stays untouched. */
export class CustomerAdminError extends HttpException {
  constructor(status: HttpStatus, code: CustomerAdminErrorCode, message: string) {
    super({ statusCode: status, message, code }, status);
  }
}
