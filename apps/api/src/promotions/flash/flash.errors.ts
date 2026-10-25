import { HttpException, type HttpStatus } from '@nestjs/common';

export type FlashErrorCode =
  | 'FLASH_NOT_FOUND'
  | 'FLASH_OVERLAP'
  | 'FLASH_HAS_SALES'
  | 'FLASH_INVALID';

/** Same wire shape as CommerceError (stable `code` next to `message`); own union so shared files stay untouched. */
export class FlashError extends HttpException {
  constructor(
    status: HttpStatus,
    code: FlashErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, message, code, ...extra }, status);
  }
}
