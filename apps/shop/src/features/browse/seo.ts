import { type Lang, pick } from '~/i18n';
import { absoluteUrl, href } from '~/i18n/routing';
import type { Crumb } from './types';

/** BreadcrumbList JSON-LD. `home` is the localized "Home" label; `last` (optional) is a non-category tail. */
export function breadcrumbLd(
  lang: Lang,
  home: string,
  crumbs: Crumb[],
  last?: { name: string; path: string },
) {
  const items = [
    { name: home, url: absoluteUrl(href(lang, '/')) },
    ...crumbs.map((c) => ({
      name: pick(lang, c.nameEn, c.nameBn),
      url: absoluteUrl(href(lang, `/c/${c.slug}`)),
    })),
    ...(last ? [{ name: last.name, url: absoluteUrl(href(lang, last.path)) }] : []),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Plain-text meta description: strip tags, collapse space, cut at ~160 chars. */
export function plainText(html: string | null | undefined, max = 160): string | undefined {
  if (!html) return undefined;
  const t = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return undefined;
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
