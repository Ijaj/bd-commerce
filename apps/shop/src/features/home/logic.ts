import type { Lang } from '~/i18n';
import { href } from '~/i18n/routing';

/** Q18 fallback when the API does not tell us (home_feed.specialRowEvery default). */
export const DEFAULT_ROW_EVERY = 12;
export const FEED_LIMIT = 24;

export type RowKind = 'flash' | 'recent' | 'event';
const ROW_KINDS: RowKind[] = ['flash', 'recent', 'event'];

/** Which special row sits after the n-th group of products (0-based). Rotates flash, recent, event. */
export function rowKind(slot: number): RowKind {
  return ROW_KINDS[slot % ROW_KINDS.length] as RowKind;
}

/** Splits into consecutive groups of `size`; the last group may be shorter. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Black or white text for a hex background (chip colour set by the admin). */
export function readableOn(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'var(--on-primary)';
  const n = Number.parseInt(m[1] as string, 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.4 ? '#1e1b3a' : '#fff';
}

/** Admin slide link -> router href. Internal paths get the language prefix. */
export function slideLink(
  lang: Lang,
  url: string | null,
): { href: string; external: boolean } | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return { href: url, external: true };
  if (!url.startsWith('/')) return null;
  const already = url === '/bn' || url.startsWith('/bn/');
  return { href: already ? url : href(lang, url), external: false };
}

/** Ids from the `bdc_recent` localStorage value. Tolerates ["id"] and [{id}] shapes. */
export function parseRecent(raw: string | null, max = 12): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const ids = v
      .map((x) => (typeof x === 'string' ? x : (x as { id?: unknown } | null)?.id))
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
    return ids.slice(0, max);
  } catch {
    return [];
  }
}

/** JSON-LD must not close the script tag early. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
