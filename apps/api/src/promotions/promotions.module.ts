import { Module } from '@nestjs/common';
import { PromotionsService } from './engine/promotions.service';

/** Step 6 core: coupon engine (pure rules in engine/, DB loading and redemption in PromotionsService). */
@Module({
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
