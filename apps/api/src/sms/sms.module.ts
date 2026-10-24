import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { TestSmsController } from './test-sms.controller';

@Global()
@Module({
  // Registered only when the flag is set at startup; the controller checks it again per request.
  controllers: process.env.E2E_EXPOSE_OTP === '1' ? [TestSmsController] : [],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
