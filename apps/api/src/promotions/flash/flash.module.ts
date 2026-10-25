import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { StorefrontModule } from '../../storefront/storefront.module';
import { FlashAdminController, FlashPublicController } from './flash.controller';
import { FlashAdminService } from './flash-admin.service';
import { FlashPublicService } from './flash-public.service';

/** Step 6: flash sales (admin CRUD + public page). Core helpers: flash-core.ts. */
@Module({
  imports: [AuthModule, StorefrontModule],
  controllers: [FlashAdminController, FlashPublicController],
  providers: [FlashAdminService, FlashPublicService],
  exports: [FlashAdminService],
})
export class FlashModule {}
