import { HttpException, type HttpStatus } from '@nestjs/common';

export type CustomerErrorCode =
  | 'PHONE_TAKEN'
  | 'EMAIL_TAKEN'
  | 'PHONE_INVALID'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_COOLDOWN'
  | 'TOO_MANY_ATTEMPTS'
  | 'TOO_MANY_REQUESTS'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'NOT_FOUND';

/** Error with a stable machine-readable `code` next to the human `message`. */
export class CustomerError extends HttpException {
  constructor(
    status: HttpStatus,
    code: CustomerErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
