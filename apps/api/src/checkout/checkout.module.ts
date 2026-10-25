import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { GeoModule } from '../geo/geo.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    CartModule,
    CustomerCoreModule,
    DeliveryModule,
    GeoModule,
    InventoryModule,
    OrdersModule,
    PromotionsModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
