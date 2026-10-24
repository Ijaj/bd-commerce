import { Module } from '@nestjs/common';
import { ThrottleService } from '../auth/throttle.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { CustomerAuthService } from './customer-auth.service';
import { CustomersController } from './customers.controller';
import { OtpService } from './otp.service';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  controllers: [CustomersController, WishlistController],
  // ThrottleService only needs the global Redis; AuthModule does not export it.
  providers: [CustomerAuthService, CustomerAuthGuard, OtpService, WishlistService, ThrottleService],
  exports: [CustomerAuthService, CustomerAuthGuard],
})
export class CustomersModule {}
