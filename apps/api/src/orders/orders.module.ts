import { Module } from '@nestjs/common';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { OrderNotifyService } from './order-notify.service';
import { OrderStatusService } from './order-status.service';
import { CustomerOrdersController, TrackController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RiskService } from './risk.service';

@Module({
  imports: [CustomerCoreModule, StorefrontModule],
  controllers: [CustomerOrdersController, TrackController],
  providers: [OrdersService, OrderNotifyService, OrderStatusService, RiskService],
  exports: [OrdersService, OrderNotifyService, OrderStatusService, RiskService],
})
export class OrdersModule {}
