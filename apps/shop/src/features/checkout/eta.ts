import { dict, fmt, type Lang } from '~/i18n';
import { localizeDigits } from '~/lib/format';

/** "1-2 days" / "৩-৫ দিন"; one number when min equals max. */
export function etaText(lang: Lang, min: number, max: number): string {
  const d = dict(lang).checkout;
  if (min === max) return fmt(d.etaDay, { n: localizeDigits(max, lang) });
  return fmt(d.etaDays, { min: localizeDigits(min, lang), max: localizeDigits(max, lang) });
}
