import type { Badges, CategoryNode, Crumb, ImageSet, ProductCard } from '~/lib/types';

export type { Crumb };

export type BrandFacet = { slug: string; nameEn: string; nameBn: string | null; count: number };
export type AttrFacet = {
  key: string;
  nameEn: string;
  nameBn: string | null;
  type: string;
  unit: string | null;
  options: { id: string; valueEn: string; valueBn: string | null; count: number }[];
};

export type ListingCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  banner: ImageSet | null;
  breadcrumb: Crumb[];
  children: CategoryNode[];
};

export type Listing = {
  items: ProductCard[];
  total: number;
  page: number;
  limit: number;
  facets: {
    brands: BrandFacet[];
    price: { min: number; max: number } | null;
    availability: { in_stock: number; preorder: number; upcoming: number };
    attributes: AttrFacet[];
  };
  category: ListingCategory | null;
};

export type ProductVariant = {
  id: string;
  sku: string;
  optionValue1Id: string | null;
  optionValue2Id: string | null;
  priceP: number;
  compareAtP: number | null;
  discountPct: number | null;
  available: number;
  isActive: boolean;
};

export type ProductOption = {
  position: 1 | 2;
  nameEn: string;
  nameBn: string | null;
  values: { id: string; valueEn: string; valueBn: string | null; swatchHex: string | null }[];
};

export type ProductImage = ImageSet & { variantId: string | null };

export type ProductDetail = {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string | null;
  shortDescriptionEn: string | null;
  shortDescriptionBn: string | null;
  descriptionHtmlEn: string | null;
  descriptionHtmlBn: string | null;
  youtubeUrl: string | null;
  brand: { slug: string; nameEn: string; nameBn: string | null } | null;
  breadcrumb: Crumb[];
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariant[];
  specs: {
    nameEn: string;
    nameBn: string | null;
    unit: string | null;
    valueEn: string;
    valueBn: string | null;
  }[];
  badges: Badges;
  isPreorder: boolean;
  preorderExpectedDate: string | null;
  isUpcoming: boolean;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};

export type Suggest = {
  products: {
    slug: string;
    titleEn: string;
    titleBn: string | null;
    image: ImageSet | null;
    priceP: number;
  }[];
  categories: Crumb[];
  brands: { slug: string; nameEn: string; nameBn: string | null }[];
};

export type Sitemap = {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
};

export const SORTS = [
  'relevance',
  'popular',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
] as const;
export type SortKey = (typeof SORTS)[number];
export const AVAILABILITY = ['in_stock', 'preorder', 'upcoming'] as const;
export type Availability = (typeof AVAILABILITY)[number];
