import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const imageSetSchema = z.object({
  alt: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  url320: z.string(),
  url640: z.string(),
  url1200: z.string(),
});

export const badgesSchema = z.object({
  isNew: z.boolean(),
  isPreorder: z.boolean(),
  isUpcoming: z.boolean(),
  outOfStock: z.boolean(),
});

export const productCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  image: imageSetSchema.nullable(),
  priceP: z.number().int(),
  compareAtP: z.number().int().nullable(),
  discountPct: z.number().int().nullable(),
  ratingAvg: z.number(),
  ratingCount: z.number().int(),
  soldCount: z.number().int(),
  badges: badgesSchema,
});
export type ProductCard = z.infer<typeof productCardSchema>;

export interface CategoryNode {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string | null;
  level: number;
  chipColor: string | null;
  image: z.infer<typeof imageSetSchema> | null;
  icon: z.infer<typeof imageSetSchema> | null;
  children: CategoryNode[];
}
export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.uuid(),
    slug: z.string(),
    nameEn: z.string(),
    nameBn: z.string().nullable(),
    level: z.number().int(),
    chipColor: z.string().nullable(),
    image: imageSetSchema.nullable(),
    icon: imageSetSchema.nullable(),
    children: z.array(categoryNodeSchema),
  }),
);

export const crumbSchema = z.object({
  slug: z.string(),
  nameEn: z.string(),
  nameBn: z.string().nullable(),
});
export type Crumb = z.infer<typeof crumbSchema>;

export class ProductCardListDto extends createZodDto(z.array(productCardSchema)) {}
export class CategoryTreeDto extends createZodDto(z.array(categoryNodeSchema)) {}

// --- home ---------------------------------------------------------------

export class HomeQueryDto extends createZodDto(
  z.object({ lang: z.enum(['en', 'bn']).optional() }),
) {}

export class HomeDto extends createZodDto(
  z.object({
    slides: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        linkUrl: z.string().nullable(),
        desktop: imageSetSchema,
        mobile: imageSetSchema.nullable(),
      }),
    ),
    featuredCategories: z.array(categoryNodeSchema),
    feedRowEvery: z.number().int(),
  }),
) {}

// --- feed ---------------------------------------------------------------

export class FeedQueryDto extends createZodDto(
  z.object({
    seed: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
    cursor: z.string().max(300).optional(),
    limit: z.coerce.number().int().min(1).max(60).default(24),
  }),
) {}

export class FeedDto extends createZodDto(
  z.object({ items: z.array(productCardSchema), nextCursor: z.string().nullable() }),
) {}

// --- listing / search ---------------------------------------------------

export const SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'popular',
  'rating',
] as const;
export type Sort = (typeof SORTS)[number];

export class ListQueryDto extends createZodDto(
  z.object({
    category: z.string().trim().max(120).optional(),
    q: z.string().trim().max(200).optional(),
    brand: z.string().max(600).optional(),
    minPrice: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    availability: z.string().max(60).optional(),
    sort: z.enum(SORTS).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(24),
  }),
) {}

const localized = { nameEn: z.string(), nameBn: z.string().nullable() };

export const listingSchema = z.object({
  items: z.array(productCardSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  facets: z.object({
    brands: z.array(z.object({ slug: z.string(), ...localized, count: z.number().int() })),
    price: z.object({ min: z.number().int(), max: z.number().int() }).nullable(),
    availability: z.object({
      in_stock: z.number().int(),
      preorder: z.number().int(),
      upcoming: z.number().int(),
    }),
    attributes: z.array(
      z.object({
        key: z.string(),
        ...localized,
        type: z.string(),
        unit: z.string().nullable(),
        options: z.array(
          z.object({
            id: z.string(),
            valueEn: z.string(),
            valueBn: z.string().nullable(),
            count: z.number().int(),
          }),
        ),
      }),
    ),
  }),
  category: z
    .object({
      id: z.uuid(),
      slug: z.string(),
      ...localized,
      descriptionEn: z.string().nullable(),
      descriptionBn: z.string().nullable(),
      seoTitle: z.string().nullable(),
      seoDescription: z.string().nullable(),
      banner: imageSetSchema.nullable(),
      breadcrumb: z.array(crumbSchema),
      children: z.array(categoryNodeSchema),
    })
    .nullable(),
});
export type ListingResult = z.infer<typeof listingSchema>;
export class ListingDto extends createZodDto(listingSchema) {}

export class SuggestQueryDto extends createZodDto(
  z.object({ q: z.string().trim().min(2).max(100) }),
) {}

export class SuggestDto extends createZodDto(
  z.object({
    products: z.array(
      z.object({
        slug: z.string(),
        titleEn: z.string(),
        titleBn: z.string().nullable(),
        image: imageSetSchema.nullable(),
        priceP: z.number().int(),
      }),
    ),
    categories: z.array(crumbSchema),
    brands: z.array(z.object({ slug: z.string(), ...localized })),
  }),
) {}

// --- product detail -----------------------------------------------------

export class SimilarQueryDto extends createZodDto(
  z.object({ limit: z.coerce.number().int().min(1).max(30).default(12) }),
) {}

export class CardsQueryDto extends createZodDto(z.object({ ids: z.string().max(1200) })) {}

export class PublicProductDetailDto extends createZodDto(
  z.object({
    id: z.uuid(),
    slug: z.string(),
    titleEn: z.string(),
    titleBn: z.string().nullable(),
    shortDescriptionEn: z.string().nullable(),
    shortDescriptionBn: z.string().nullable(),
    descriptionHtmlEn: z.string().nullable(),
    descriptionHtmlBn: z.string().nullable(),
    youtubeUrl: z.string().nullable(),
    brand: z.object({ slug: z.string(), ...localized }).nullable(),
    breadcrumb: z.array(crumbSchema),
    images: z.array(imageSetSchema.extend({ variantId: z.uuid().nullable() })),
    options: z.array(
      z.object({
        position: z.number().int(),
        ...localized,
        values: z.array(
          z.object({
            id: z.uuid(),
            valueEn: z.string(),
            valueBn: z.string().nullable(),
            swatchHex: z.string().nullable(),
          }),
        ),
      }),
    ),
    variants: z.array(
      z.object({
        id: z.uuid(),
        sku: z.string(),
        optionValue1Id: z.uuid().nullable(),
        optionValue2Id: z.uuid().nullable(),
        priceP: z.number().int(),
        compareAtP: z.number().int().nullable(),
        discountPct: z.number().int().nullable(),
        available: z.number().int(),
        isActive: z.boolean(),
      }),
    ),
    specs: z.array(
      z.object({
        ...localized,
        unit: z.string().nullable(),
        valueEn: z.string(),
        valueBn: z.string().nullable(),
      }),
    ),
    badges: badgesSchema,
    isPreorder: z.boolean(),
    preorderExpectedDate: z.string().nullable(),
    isUpcoming: z.boolean(),
    ratingAvg: z.number(),
    ratingCount: z.number().int(),
    soldCount: z.number().int(),
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    updatedAt: z.iso.datetime(),
  }),
) {}

export class SitemapDto extends createZodDto(
  z.object({
    products: z.array(z.object({ slug: z.string(), updatedAt: z.iso.datetime() })),
    categories: z.array(z.object({ slug: z.string(), updatedAt: z.iso.datetime() })),
  }),
) {}
