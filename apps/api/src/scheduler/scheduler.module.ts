import { Module } from '@nestjs/common';
import { ReturnsModule } from '../returns/returns.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ShipmentsModule, ReturnsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
