import { type Lang, localizeDigits } from '@bdc/i18n';

export { formatNumber, formatPrice, localizeDigits, pickText } from '@bdc/i18n';

/** Sold counts: 950 -> "950", 1200 -> "1.2k" / "১.২ হাজার". Digits follow the language (Q104). */
export function formatCompact(n: number, lang: Lang): string {
  if (n < 1000) return localizeDigits(n, lang);
  const v = (Math.round(n / 100) / 10).toString().replace(/\.0$/, '');
  return lang === 'bn' ? `${localizeDigits(v, 'bn')} হাজার` : `${v}k`;
}

/** Rating with one decimal: 4.5 -> "4.5" / "৪.৫". */
export function formatRating(avg: number, lang: Lang): string {
  return localizeDigits(avg.toFixed(1), lang);
}
