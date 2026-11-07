import { HttpException, type HttpStatus } from '@nestjs/common';

export type AffiliateErrorCode =
  | 'AFFILIATE_PROGRAM_OFF'
  | 'AFFILIATE_ALREADY_JOINED'
  | 'AFFILIATE_CODE_TAKEN'
  | 'AFFILIATE_CODE_INVALID'
  | 'AFFILIATE_NOT_FOUND'
  | 'AFFILIATE_NOT_JOINED'
  | 'AFFILIATE_SELF'
  | 'AFFILIATE_SUSPEND_REASON'
  | 'AFFILIATE_PAYOUT_CHANGED'
  | 'AFFILIATE_BELOW_MIN'
  | 'AFFILIATE_NOTHING_DUE';

/** Same body shape as CommerceError; own type so the shared code union stays untouched. */
export class AffiliateError extends HttpException {
  constructor(
    status: HttpStatus,
    code: AffiliateErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
