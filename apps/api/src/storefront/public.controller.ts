import { BadRequestException, Controller, Get, Header, Param, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeedService } from './feed.service';
import { HomeService } from './home.service';
import { ListingService } from './listing.service';
import { ProductCardService } from './product-card.service';
import { ProductDetailService } from './product-detail.service';
import {
  CardsQueryDto,
  CategoryTreeDto,
  FeedDto,
  FeedQueryDto,
  HomeDto,
  HomeQueryDto,
  ListingDto,
  ListQueryDto,
  ProductCardListDto,
  PublicProductDetailDto,
  SimilarQueryDto,
  SitemapDto,
  SuggestDto,
  SuggestQueryDto,
} from './public.dto';
import { PublicCategoriesService } from './public-categories.service';
import { SearchService } from './search.service';

const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CARD_IDS = 30;

/** Storefront read API: no auth, only public products and categories. */
@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly categories: PublicCategoriesService,
    private readonly home: HomeService,
    private readonly feed: FeedService,
    private readonly listing: ListingService,
    private readonly search: SearchService,
    private readonly detail: ProductDetailService,
    private readonly cards: ProductCardService,
  ) {}

  @Get('categories/tree')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: CategoryTreeDto })
  async categoryTree(): Promise<CategoryTreeDto> {
    return (await this.categories.tree()).roots;
  }

  @Get('home')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: HomeDto })
  homePage(@Query() query: HomeQueryDto): Promise<HomeDto> {
    return this.home.home(query.lang);
  }

  /** Weighted-random home feed. Same seed gives the same order; page with `nextCursor`. */
  @Get('feed')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: FeedDto })
  feedPage(@Query() query: FeedQueryDto): Promise<FeedDto> {
    return this.feed.page(query.seed, query.cursor, query.limit);
  }

  /**
   * Category and search listing. Also accepts `attr.<key>=<optionId,...>` (or `true` for boolean
   * attributes), which the generated client cannot type.
   */
  @Get('products')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: ListingDto })
  products(@Query() query: ListQueryDto, @Req() req: Request): Promise<ListingDto> {
    const attrs: Record<string, string> = {};
    for (const [name, value] of Object.entries(req.query)) {
      if (name.startsWith('attr.') && typeof value === 'string') attrs[name.slice(5)] = value;
    }
    return this.listing.list({ ...query, attrs });
  }

  @Get('search/suggest')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: SuggestDto })
  suggest(@Query() query: SuggestQueryDto): Promise<SuggestDto> {
    return this.search.suggest(query.q);
  }

  /** Cards for explicit ids (recently viewed, wishlist), in the order given. */
  @Get('products/cards')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: ProductCardListDto })
  async productCards(@Query() query: CardsQueryDto): Promise<ProductCardListDto> {
    const ids = query.ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length > MAX_CARD_IDS) throw new BadRequestException(`At most ${MAX_CARD_IDS} ids`);
    if (ids.some((id) => !UUID.test(id))) throw new BadRequestException('ids must be uuids');
    return this.cards.cards(ids);
  }

  @Get('products/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: PublicProductDetailDto })
  product(@Param('slug') slug: string): Promise<PublicProductDetailDto> {
    return this.detail.bySlug(slug);
  }

  @Get('products/:slug/similar')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: ProductCardListDto })
  similar(
    @Param('slug') slug: string,
    @Query() query: SimilarQueryDto,
  ): Promise<ProductCardListDto> {
    return this.detail.similar(slug, query.limit);
  }

  @Get('sitemap')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOkResponse({ type: SitemapDto })
  sitemap(): Promise<SitemapDto> {
    return this.detail.sitemap();
  }
}
