import { Module } from '@nestjs/common';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { ReturnsModule } from '../returns/returns.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [AffiliatesModule, ShipmentsModule, ReturnsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
