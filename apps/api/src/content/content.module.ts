import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';

@Module({
  imports: [AuthModule],
  controllers: [CarouselController],
  providers: [CarouselService],
  exports: [CarouselService],
})
export class ContentModule {}
