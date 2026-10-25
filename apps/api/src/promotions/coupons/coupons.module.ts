import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CustomerCoreModule } from '../../customers/customer-core.module';
import { CouponCodesService } from './coupon-codes.service';
import { CouponReportService } from './coupon-report.service';
import { CouponsWriteService } from './coupon-write.service';
import { CouponsAdminController } from './coupons.controller';
import { CouponsAdminService } from './coupons-admin.service';
import { CouponsCustomerController } from './coupons-customer.controller';
import { CouponsPublicController } from './coupons-public.controller';
import { CouponsPublicService } from './coupons-public.service';
import { CouponsWalletService } from './coupons-wallet.service';

/** Step 6: admin coupon CRUD + bulk codes + reports, customer coupon wallet, public offers. */
@Module({
  imports: [AuthModule, CustomerCoreModule],
  controllers: [CouponsAdminController, CouponsCustomerController, CouponsPublicController],
  providers: [
    CouponsAdminService,
    CouponsWriteService,
    CouponCodesService,
    CouponReportService,
    CouponsWalletService,
    CouponsPublicService,
  ],
  exports: [CouponsPublicService, CouponsWalletService],
})
export class CouponsModule {}
