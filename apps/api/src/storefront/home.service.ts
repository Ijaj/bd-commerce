import { Injectable } from '@nestjs/common';
import { CarouselService } from '../content/carousel.service';
import { SettingsService } from '../settings/settings.service';
import { ImageService } from './images';
import { PublicCategoriesService } from './public-categories.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly carousel: CarouselService,
    private readonly categories: PublicCategoriesService,
    private readonly images: ImageService,
    private readonly settings: SettingsService,
  ) {}

  async home(lang: 'en' | 'bn' | undefined) {
    const [slides, tree, feed] = await Promise.all([
      this.carousel.activeSlides(lang),
      this.categories.tree(),
      this.settings.get('home_feed'),
    ]);
    return {
      slides: slides.map((s) => ({
        id: s.id,
        title: s.title,
        linkUrl: s.linkUrl,
        desktop: this.images.set(s.imageDesktop, s.title),
        mobile: this.images.setOrNull(s.imageMobile, s.title),
      })),
      featuredCategories: tree.list
        .filter((c) => c.showOnHome)
        .map((c) => ({ ...c.node, children: [] })),
      /// Special row (flash sale / recently viewed / event) every N feed products (Q18).
      feedRowEvery: feed.specialRowEvery,
    };
  }
}
