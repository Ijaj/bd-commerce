import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { RefundsService } from './refunds.service';
import { CustomerReturnsController, ReturnsAdminController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnsCompletionService } from './returns-completion.service';

/** Step 5: returns (customer + staff), refunds with a second-person approval above a threshold, order completion. */
@Module({
  imports: [AuthModule, CustomerCoreModule, InventoryModule, OrdersModule],
  controllers: [CustomerReturnsController, ReturnsAdminController],
  providers: [ReturnsService, RefundsService, ReturnsCompletionService],
  exports: [ReturnsService, RefundsService, ReturnsCompletionService],
})
export class ReturnsModule {}
