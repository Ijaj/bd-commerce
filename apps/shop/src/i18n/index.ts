import { isLang, type Lang } from '@bdc/i18n';
import { bn } from './bn';
import { type Dict, en } from './en';

export type { Lang } from '@bdc/i18n';
export type { Dict };

const DICTS: Record<Lang, Dict> = { en, bn };

/** UI strings for a language: `const d = dict(lang); d.shell.search`. */
export function dict(lang: Lang): Dict {
  return DICTS[lang];
}

/** Inline bilingual text: `t(lang, { en: 'Hello', bn: 'হ্যালো' })`. Falls back to English when bn is empty. */
export function t(lang: Lang, text: { en: string; bn?: string | null }): string {
  return lang === 'bn' && text.bn?.trim() ? text.bn : text.en;
}

/** Entity fields (`titleEn`/`titleBn`): `pick(lang, p.titleEn, p.titleBn)`. */
export function pick(lang: Lang, en: string, bn: string | null | undefined): string {
  return t(lang, { en, bn });
}

/** `fmt('Showing {n} products', { n: 24 })`. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Route param -> Lang, or null if it is not a supported language. */
export function parseLang(value: string): Lang | null {
  return isLang(value) ? value : null;
}
