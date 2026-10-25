import type { CarouselLang, CarouselSlide, CarouselSlideInput } from './api';

export type SlideStatus = 'inactive' | 'scheduled' | 'live' | 'ended';

export const LANG_OPTIONS: { value: CarouselLang; label: string }[] = [
  { value: 'all', label: 'All languages' },
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'Bangla' },
];

/** What the shopper sees right now: inactive wins, then the time window. */
export function slideStatus(
  s: Pick<CarouselSlide, 'isActive' | 'startsAt' | 'endsAt'>,
  now: number = Date.now(),
): SlideStatus {
  if (!s.isActive) return 'inactive';
  if (s.startsAt && Date.parse(s.startsAt) > now) return 'scheduled';
  if (s.endsAt && Date.parse(s.endsAt) <= now) return 'ended';
  return 'live';
}

export const STATUS_LABEL: Record<SlideStatus, string> = {
  inactive: 'Inactive',
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
};

export const STATUS_COLOR: Record<SlideStatus, string> = {
  inactive: 'gray',
  scheduled: 'blue',
  live: 'green',
  ended: 'yellow',
};

const SLUG_PATH_RE = /^\/(p|c)\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

/** Relative storefront paths (/p/slug, /c/slug) or https URLs. Empty is allowed (no link). */
export function validateLink(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith('/')) {
    return SLUG_PATH_RE.test(s) ? null : 'Use /p/product-slug, /c/category-slug or an https:// URL';
  }
  try {
    return new URL(s).protocol === 'https:' ? null : 'Only https:// links are allowed';
  } catch {
    return 'Use /p/product-slug, /c/category-slug or an https:// URL';
  }
}

/** DateTimePicker gives local 'YYYY-MM-DD HH:mm:ss' strings; the API wants ISO instants. */
export function localToIso(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoToLocal(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/** Turns the form values into the API body. Blank optional fields become null. */
export function toInput(v: {
  title: string;
  imageDesktopId: string | null;
  imageMobileId: string | null;
  linkUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  lang: CarouselLang;
}): CarouselSlideInput {
  return {
    title: v.title.trim(),
    imageDesktopMediaId: v.imageDesktopId ?? '',
    imageMobileMediaId: v.imageMobileId,
    linkUrl: v.linkUrl.trim() || null,
    startsAt: localToIso(v.startsAt),
    endsAt: localToIso(v.endsAt),
    isActive: v.isActive,
    lang: v.lang,
  };
}
