import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { GeoModule } from '../geo/geo.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { CallQueueService } from './call-queue.service';
import { OrderCancelService } from './order-cancel.service';
import { OrderEditService } from './order-edit.service';
import { OrderEditWriter } from './order-edit-writer';
import {
  CallQueueController,
  CouriersController,
  OrdersAdminController,
} from './orders-admin.controller';
import { OrdersAdminService } from './orders-admin.service';

@Module({
  imports: [
    AuthModule,
    DeliveryModule,
    GeoModule,
    InventoryModule,
    OrdersModule,
    PromotionsModule,
    StorefrontModule,
  ],
  controllers: [OrdersAdminController, CallQueueController, CouriersController],
  providers: [
    OrdersAdminService,
    OrderCancelService,
    CallQueueService,
    OrderEditService,
    OrderEditWriter,
  ],
  exports: [OrderCancelService],
})
export class OrdersAdminModule {}
