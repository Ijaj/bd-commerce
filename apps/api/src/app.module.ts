import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './catalog/brands/brands.module';
import { CategoriesModule } from './catalog/categories/categories.module';
import { ImportExportModule } from './catalog/import-export/import-export.module';
import { ProductsModule } from './catalog/products/products.module';
import { EnvModule } from './config/env.module';
import { CustomersModule } from './customers/customers.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthController } from './health/health.controller';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { OrdersAdminModule } from './orders-admin/orders-admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { BulkSaleModule } from './promotions/bulk-sale/bulk-sale.module';
import { CouponsModule } from './promotions/coupons/coupons.module';
import { FlashModule } from './promotions/flash/flash.module';
import { PromotionsModule } from './promotions/promotions.module';
import { RedisModule } from './redis/redis.module';
import { ReturnsModule } from './returns/returns.module';
import { SettingsModule } from './settings/settings.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { SmsModule } from './sms/sms.module';
import { SrModule } from './sr/sr.module';
import { StaffModule } from './staff/staff.module';
import { StorefrontModule } from './storefront/storefront.module';

@Module({
  imports: [
    EnvModule,
    PrismaModule,
    RedisModule,
    MailModule,
    SettingsModule,
    AuthModule,
    StaffModule,
    MediaModule,
    CategoriesModule,
    BrandsModule,
    // Before ProductsModule so /admin/products/export|import-template win over /admin/products/:id.
    ImportExportModule,
    ProductsModule,
    InventoryModule,
    SmsModule,
    CustomersModule,
    StorefrontModule,
    SrModule,
    OrdersAdminModule,
    ShipmentsModule,
    DocumentsModule,
    ReturnsModule,
    PromotionsModule,
    CouponsModule,
    FlashModule,
    BulkSaleModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
