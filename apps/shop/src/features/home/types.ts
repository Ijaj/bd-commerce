import type { CategoryNode, ImageSet, ProductCard } from '~/lib/types';

export type HomeSlide = {
  id: string;
  title: string;
  /** '/path' (internal) or http(s):// (external); null = not clickable. */
  linkUrl: string | null;
  desktop: ImageSet;
  mobile: ImageSet | null;
};

/** GET /v1/public/home. `feedRowEvery` is optional until the API exposes home_feed.specialRowEvery. */
export type HomeData = {
  slides: HomeSlide[];
  featuredCategories: CategoryNode[];
  feedRowEvery?: number;
};

export type FeedPage = { items: ProductCard[]; nextCursor: string | null };
