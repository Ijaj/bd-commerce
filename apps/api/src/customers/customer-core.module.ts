import { Module } from '@nestjs/common';
import { ThrottleService } from '../auth/throttle.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { CustomerSessionService } from './customer-session.service';
import { OtpService } from './otp.service';

/** Session lookup, guard and OTP: the parts cart/checkout/orders need from the customers area. */
@Module({
  // ThrottleService only needs the global Redis; AuthModule does not export it.
  providers: [CustomerSessionService, CustomerAuthGuard, OtpService, ThrottleService],
  exports: [CustomerSessionService, CustomerAuthGuard, OtpService, ThrottleService],
})
export class CustomerCoreModule {}
