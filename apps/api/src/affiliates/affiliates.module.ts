import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { AffiliateAccountService } from './affiliate-account.service';
import { AffiliateAdminService } from './affiliate-admin.service';
import { AffiliateAttributionService } from './affiliate-attribution.service';
import { AffiliateClicksService } from './affiliate-clicks.service';
import { AffiliateCodesService } from './affiliate-codes.service';
import { AffiliateCommissionsJobService } from './affiliate-commissions-job.service';
import { AffiliateLookupService } from './affiliate-lookup.service';
import { AffiliatePayoutsService } from './affiliate-payouts.service';
import { AffiliateReportService } from './affiliate-report.service';
import { AffiliatesAdminController } from './affiliates-admin.controller';
import { AffiliatesCustomerController } from './affiliates-customer.controller';
import { AffiliatesPublicController } from './affiliates-public.controller';

/** Step 7c: affiliates (C67–C70, C81–C84). Join + dashboard in the shop, admin list + payouts. */
@Module({
  imports: [AuthModule, CustomerCoreModule],
  controllers: [
    AffiliatesPublicController,
    AffiliatesCustomerController,
    AffiliatesAdminController,
  ],
  providers: [
    AffiliateAccountService,
    AffiliateAdminService,
    AffiliateAttributionService,
    AffiliateClicksService,
    AffiliateCodesService,
    AffiliateCommissionsJobService,
    AffiliateLookupService,
    AffiliatePayoutsService,
    AffiliateReportService,
  ],
  exports: [AffiliateLookupService, AffiliateAttributionService, AffiliateCommissionsJobService],
})
export class AffiliatesModule {}
