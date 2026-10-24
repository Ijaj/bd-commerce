import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { FeedService } from './feed.service';
import { HomeService } from './home.service';
import { ImageService } from './images';
import { ListingService } from './listing.service';
import { ProductCardService } from './product-card.service';
import { ProductDetailService } from './product-detail.service';
import { PublicController } from './public.controller';
import { PublicCategoriesService } from './public-categories.service';
import { SearchService } from './search.service';

@Module({
  imports: [ContentModule],
  controllers: [PublicController],
  providers: [
    ImageService,
    ProductCardService,
    PublicCategoriesService,
    HomeService,
    FeedService,
    ListingService,
    SearchService,
    ProductDetailService,
  ],
  exports: [ImageService, ProductCardService],
})
export class StorefrontModule {}
