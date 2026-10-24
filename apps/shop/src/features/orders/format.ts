import type { Lang } from '~/i18n';

/** "24 Oct 2026, 3:05 pm" / "২৪ অক্টোবর ২০২৬, ৩:০৫ PM", always in Dhaka time so server and browser agree. */
export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(iso));
}
