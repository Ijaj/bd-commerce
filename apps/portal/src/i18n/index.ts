import type { Lang } from '@bdc/i18n';
import { bn } from './bn';
import { en, type MessageKey } from './en';

export type { MessageKey };

const KEY = 'bdc_portal_lang';
let lang: Lang = 'en';
try {
  if (localStorage.getItem(KEY) === 'bn') lang = 'bn';
} catch {
  // storage blocked: stay on English
}

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
}

/** t('errQtyMax', { n: 3 }) -> "Only 3 available". Falls back to English for missing Bangla keys. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = (lang === 'bn' ? bn[key] : undefined) ?? en[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw;
}
