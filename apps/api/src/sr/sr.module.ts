import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { B2bLedgerService } from './b2b-ledger.service';
import {
  B2bAdminController,
  SrAdminController,
  SrPublicMemoController,
} from './sr-admin.controller';
import { SrMemoService } from './sr-memo.service';
import { SrPortalController } from './sr-portal.controller';
import { SrProductsService } from './sr-products.service';
import { SrSalesService } from './sr-sales.service';
import { SrShopsService } from './sr-shops.service';
import { SrStatsService } from './sr-stats.service';

@Module({
  imports: [AuthModule, InventoryModule, StorefrontModule],
  controllers: [SrPortalController, SrAdminController, SrPublicMemoController, B2bAdminController],
  providers: [
    B2bLedgerService,
    SrShopsService,
    SrSalesService,
    SrStatsService,
    SrProductsService,
    SrMemoService,
  ],
})
export class SrModule {}
