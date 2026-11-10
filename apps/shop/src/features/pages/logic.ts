import type { Lang } from '~/i18n';
import { pick } from '~/i18n';
import type { FooterPage, StaticPage } from './data';

/** Title in the shopper's language; Bangla falls back to English when not translated. */
export const pageTitle = (lang: Lang, p: FooterPage) => pick(lang, p.titleEn, p.titleBn);

/** Body in the shopper's language, falling back to the other language when this one is empty. */
export function pageBody(lang: Lang, p: Pick<StaticPage, 'bodyHtmlEn' | 'bodyHtmlBn'>): string {
  const [first, second] =
    lang === 'bn' ? [p.bodyHtmlBn, p.bodyHtmlEn] : [p.bodyHtmlEn, p.bodyHtmlBn];
  return first?.trim() ? first : (second ?? '');
}
