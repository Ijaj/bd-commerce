import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { GeoModule } from '../geo/geo.module';
import { OrdersModule } from '../orders/orders.module';
import { CheckoutModule } from './checkout.module';

/** Step 4 backend: geo, delivery zones, cart, checkout, orders. Imported by CustomersModule. */
@Module({
  imports: [GeoModule, DeliveryModule, CartModule, OrdersModule, CheckoutModule],
  exports: [CartModule, GeoModule, OrdersModule],
})
export class CommerceModule {}
