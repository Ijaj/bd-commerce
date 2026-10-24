import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { CallQueueService } from './call-queue.service';
import { OrderCancelService } from './order-cancel.service';
import { CallQueueController, OrdersAdminController } from './orders-admin.controller';
import { OrdersAdminService } from './orders-admin.service';

@Module({
  imports: [AuthModule, InventoryModule, OrdersModule, StorefrontModule],
  controllers: [OrdersAdminController, CallQueueController],
  providers: [OrdersAdminService, OrderCancelService, CallQueueService],
  exports: [OrderCancelService],
})
export class OrdersAdminModule {}
