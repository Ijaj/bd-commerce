import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';
import { PagesAdminController, PagesPublicController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [AuthModule],
  controllers: [CarouselController, PagesAdminController, PagesPublicController],
  providers: [CarouselService, PagesService],
  exports: [CarouselService],
})
export class ContentModule {}
