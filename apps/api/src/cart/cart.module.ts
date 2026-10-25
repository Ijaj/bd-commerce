import { Module } from '@nestjs/common';
import { CustomerCoreModule } from '../customers/customer-core.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartCouponsService } from './cart-coupons.service';
import { CartIdentityService } from './cart-identity.service';

@Module({
  imports: [CustomerCoreModule, StorefrontModule, PromotionsModule],
  controllers: [CartController],
  providers: [CartService, CartCouponsService, CartIdentityService],
  exports: [CartService, CartCouponsService, CartIdentityService],
})
export class CartModule {}
