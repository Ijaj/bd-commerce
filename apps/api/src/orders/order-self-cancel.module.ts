import { Module } from '@nestjs/common';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { OrdersAdminModule } from '../orders-admin/orders-admin.module';
import {
  CustomerOrderCancelController,
  TrackCancelController,
} from './order-self-cancel.controller';
import { OrderSelfCancelService } from './order-self-cancel.service';
import { OrdersModule } from './orders.module';

/**
 * Customer-side cancel (A3). Separate from OrdersModule because OrderCancelService lives in
 * OrdersAdminModule, which imports OrdersModule (a cycle otherwise).
 */
@Module({
  imports: [CustomerCoreModule, OrdersModule, OrdersAdminModule],
  controllers: [CustomerOrderCancelController, TrackCancelController],
  providers: [OrderSelfCancelService],
})
export class OrderSelfCancelModule {}
