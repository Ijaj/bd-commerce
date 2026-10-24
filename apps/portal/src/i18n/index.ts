import type { Lang } from '@bdc/i18n';
import { useSyncExternalStore } from 'react';
import { bn } from './bn';
import { en, type MessageKey } from './en';

export type { MessageKey };

const KEY = 'bdc_portal_lang';
const listeners = new Set<() => void>();

function readStored(): Lang {
  try {
    return localStorage.getItem(KEY) === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en'; // storage blocked
  }
}

let lang: Lang = readStored();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export function getLang(): Lang {
  return lang;
}

/** Persists the choice, updates <html lang> and re-renders subscribers (see useLang). */
export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const l of listeners) l();
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
    () => 'en',
  );
}

/** t('errQtyMax', { n: 3 }) -> "Only 3 available". Numbers in vars follow the current language digits. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = lang === 'bn' ? bn[key] : en[key];
  return vars
    ? raw.replace(/\{(\w+)\}/g, (_, k: string) => {
        const v = vars[k];
        return typeof v === 'number' && lang === 'bn' ? toDigits(v) : String(v ?? '');
      })
    : raw;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function toDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

/** Integer/short number in the current language's digits (counts, quantities). */
export const num = (n: number): string => (lang === 'bn' ? toDigits(n) : String(n));
