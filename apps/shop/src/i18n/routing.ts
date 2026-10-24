import type { Lang } from '@bdc/i18n';
import { SITE_URL } from '~/lib/env';

export const BN_PREFIX = '/bn';

/**
 * Locale-aware internal link. English lives at the root, Bangla under /bn (C26).
 *   href('bn', '/p/panjabi')  -> '/bn/p/panjabi'
 *   href('en', '/')           -> '/'
 */
export function href(lang: Lang, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'en') return p;
  return p === '/' ? BN_PREFIX : `${BN_PREFIX}${p}`;
}

/** Language of a browser pathname (`/bn/...` => bn). */
export function langFromPathname(pathname: string): Lang {
  return pathname === BN_PREFIX || pathname.startsWith(`${BN_PREFIX}/`) ? 'bn' : 'en';
}

/** Pathname without the language prefix: `/bn/c/shoes` -> `/c/shoes`, `/bn` -> `/`. */
export function stripLang(pathname: string): string {
  if (pathname === BN_PREFIX) return '/';
  return pathname.startsWith(`${BN_PREFIX}/`) ? pathname.slice(BN_PREFIX.length) : pathname || '/';
}

/** Same page in another language (language switcher). Query/hash are re-added by the caller. */
export function switchLangPath(pathname: string, to: Lang): string {
  return href(to, stripLang(pathname));
}

export function absoluteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/**
 * Next `metadata.alternates` for a page. `path` is language-less (`/c/shoes`).
 * Query strings are not part of the canonical (pass them only for paginated lists you want indexed).
 */
export function alternatesFor(lang: Lang, path: string) {
  return {
    canonical: absoluteUrl(href(lang, path)),
    languages: {
      en: absoluteUrl(href('en', path)),
      bn: absoluteUrl(href('bn', path)),
      'x-default': absoluteUrl(href('en', path)),
    },
  };
}
