import { apiGet } from '~/lib/api';

export type FooterPage = { slug: string; titleEn: string; titleBn: string | null };

export type StaticPage = FooterPage & {
  bodyHtmlEn: string | null;
  bodyHtmlBn: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};

/** Published static page, or null when unknown/unpublished (404). */
export function fetchPage(slug: string): Promise<StaticPage | null> {
  return apiGet<StaticPage>(`/v1/public/pages/${encodeURIComponent(slug)}`, undefined, {
    revalidate: 60,
  });
}

/** Footer links. Empty on any failure so the footer falls back to its fixed links. */
export async function fetchFooterPages(): Promise<FooterPage[]> {
  try {
    const res = await apiGet<{ items: FooterPage[] }>('/v1/public/pages', undefined, {
      revalidate: 60,
    });
    return res?.items ?? [];
  } catch {
    return [];
  }
}
