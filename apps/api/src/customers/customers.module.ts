import { Module } from '@nestjs/common';
import { CommerceModule } from '../checkout/commerce.module';
import { StorefrontModule } from '../storefront/storefront.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerCoreModule } from './customer-core.module';
import { CustomersController } from './customers.controller';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CustomerCoreModule, StorefrontModule, CommerceModule],
  controllers: [CustomersController, WishlistController, AddressesController],
  providers: [CustomerAuthService, WishlistService, AddressesService],
  exports: [CustomerAuthService, CustomerCoreModule],
})
export class CustomersModule {}
