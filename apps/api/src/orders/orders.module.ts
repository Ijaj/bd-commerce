import { Module } from '@nestjs/common';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { OrderNotifyService } from './order-notify.service';
import { CustomerOrdersController, TrackController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CustomerCoreModule, StorefrontModule],
  controllers: [CustomerOrdersController, TrackController],
  providers: [OrdersService, OrderNotifyService],
  exports: [OrdersService, OrderNotifyService],
})
export class OrdersModule {}
