import { apiGet } from '~/lib/api';
import type { CategoryNode, ProductCard } from '~/lib/types';
import { type ListingQuery, toApiParams } from './query';
import type { Listing, ProductDetail, Sitemap } from './types';

const LIMIT = 24;
export const PAGE_SIZE = LIMIT;

/** Category listing; null when the category does not exist (or is inactive). */
export function fetchListing(q: ListingQuery, category?: string): Promise<Listing | null> {
  return apiGet<Listing>('/v1/public/products', toApiParams(q, { category, limit: LIMIT }), {
    revalidate: 60,
  });
}

export function fetchProduct(slug: string): Promise<ProductDetail | null> {
  return apiGet<ProductDetail>(`/v1/public/products/${encodeURIComponent(slug)}`, undefined, {
    revalidate: 60,
  });
}

export async function fetchSimilar(slug: string): Promise<ProductCard[]> {
  try {
    return (
      (await apiGet<ProductCard[]>(
        `/v1/public/products/${encodeURIComponent(slug)}/similar`,
        { limit: 12 },
        { revalidate: 300 },
      )) ?? []
    );
  } catch {
    return [];
  }
}

// Fail open: these feed statically prerendered routes (/categories, sitemap.xml), which are built
// when no API may be running (CI). An empty result is regenerated on the next revalidate.
export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  try {
    return (
      (await apiGet<CategoryNode[]>('/v1/public/categories/tree', undefined, {
        revalidate: 300,
      })) ?? []
    );
  } catch {
    return [];
  }
}

export async function fetchSitemap(): Promise<Sitemap | null> {
  try {
    return await apiGet<Sitemap>('/v1/public/sitemap', undefined, { revalidate: 3600 });
  } catch {
    return null;
  }
}
