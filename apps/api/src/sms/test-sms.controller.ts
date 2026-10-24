import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ENV, type Env } from '../config/env';
import { normalizePhone } from '../customers/phone';
import { SmsService } from './sms.service';

/** e2e only (E2E_EXPOSE_OTP=1): lets the browser tests read the SMS code the API "sent". */
@ApiExcludeController()
@Controller('test')
export class TestSmsController {
  constructor(
    private readonly sms: SmsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('last-sms')
  lastSms(@Query('phone') phone: string | undefined) {
    const sms =
      this.env.E2E_EXPOSE_OTP === '1' && phone
        ? this.sms.lastTo(normalizePhone(phone) ?? phone)
        : undefined;
    if (!sms) throw new NotFoundException();
    return { to: sms.to, text: sms.text };
  }
}
