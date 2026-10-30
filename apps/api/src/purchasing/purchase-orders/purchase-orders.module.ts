import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { PoService } from './po.service';
import { PoReadService } from './po-read.service';
import { PoReceivingService } from './po-receiving.service';
import { PurchaseOrdersController } from './purchase-orders.controller';

/** Step 7a: purchase orders, send + print, receiving with weighted-average cost (C64, C71, C72, C75). */
@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [PurchaseOrdersController],
  providers: [PoService, PoReadService, PoReceivingService],
  exports: [PoReadService],
})
export class PurchaseOrdersModule {}
