import type { Lang } from '~/i18n';
import { API_URL, apiGet } from '~/lib/api';
import type { CategoryNode } from '~/lib/types';
import type { FeedPage, HomeData } from './types';

/** Slides + featured categories. Cached 60 s; fails soft so the feed can still render. */
export async function getHome(lang: Lang): Promise<HomeData | null> {
  try {
    return await apiGet<HomeData>('/v1/public/home', { lang }, { tags: ['home'] });
  } catch {
    return null;
  }
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
  try {
    return (
      (await apiGet<CategoryNode[]>('/v1/public/categories/tree', undefined, {
        tags: ['categories'],
      })) ?? []
    );
  } catch {
    return [];
  }
}

/** Feed pages are per-visitor (random seed), so never cached. */
export async function getFeedPage(
  seed: number,
  limit: number,
  cursor?: string,
): Promise<FeedPage | null> {
  try {
    const url = new URL('/v1/public/feed', API_URL);
    url.searchParams.set('seed', String(seed));
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as FeedPage) : null;
  } catch {
    return null;
  }
}
