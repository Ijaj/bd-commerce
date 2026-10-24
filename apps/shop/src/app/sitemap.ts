import type { MetadataRoute } from 'next';
import { fetchSitemap } from '~/features/browse/api';
import { absoluteUrl, href } from '~/i18n/routing';

export const revalidate = 3600;

/** Both languages for every public page, each entry carrying hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const map = await fetchSitemap().catch(() => null);
  const out: MetadataRoute.Sitemap = [];
  const add = (path: string, updatedAt?: string) => {
    const languages = { en: absoluteUrl(href('en', path)), bn: absoluteUrl(href('bn', path)) };
    for (const lang of ['en', 'bn'] as const) {
      out.push({
        url: absoluteUrl(href(lang, path)),
        ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
        alternates: { languages },
      });
    }
  };
  add('/');
  add('/categories');
  for (const c of map?.categories ?? []) add(`/c/${c.slug}`, c.updatedAt);
  for (const p of map?.products ?? []) add(`/p/${p.slug}`, p.updatedAt);
  return out;
}
