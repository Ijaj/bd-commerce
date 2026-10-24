import { Module } from '@nestjs/common';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartIdentityService } from './cart-identity.service';

@Module({
  imports: [CustomerCoreModule, StorefrontModule],
  controllers: [CartController],
  providers: [CartService, CartIdentityService],
  exports: [CartService, CartIdentityService],
})
export class CartModule {}
