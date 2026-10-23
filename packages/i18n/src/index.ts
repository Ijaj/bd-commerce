/**
 * EN/BN helpers shared by shop, admin, portal and API.
 *
 * Digit rule (Q104): BN shows Bangla digits everywhere, prices included (৳১,২৫,০০০);
 * EN shows English digits (৳1,25,000). Both use lakh grouping (Q8).
 * Order IDs, phone numbers and tracking IDs always stay in English digits: don't pass them
 * through these helpers.
 */

export type Lang = 'en' | 'bn';
export const LANGS: readonly Lang[] = ['en', 'bn'];

export interface LocalizedText {
  en: string;
  bn: string;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function toBnDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] as string);
}

/** Bangla digits back to ASCII; use on user input (phone, quantity, OTP) before parsing. */
export function toEnDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function localizeDigits(value: string | number, lang: Lang): string {
  return lang === 'bn' ? toBnDigits(value) : String(value);
}

/** Indian/Bangladeshi grouping: 1,25,000 and 1,23,45,678. */
function groupLakh(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Formats a number with lakh grouping and up to `maxDecimals` decimals (trailing zeros dropped). */
export function formatNumber(value: number, lang: Lang, maxDecimals = 2): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${value}`);
  const fixed = Math.abs(value).toFixed(maxDecimals);
  const [int = '0', frac = ''] = fixed.split('.');
  const decimals = frac.replace(/0+$/, '');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return localizeDigits(`${sign}${groupLakh(int)}${decimals ? `.${decimals}` : ''}`, lang);
}

/**
 * Money is stored as integer paisa (`*_p` columns). Shows decimals only when there are paisa:
 * 12500000 → "৳1,25,000" (en) / "৳১,২৫,০০০" (bn); 1050 → "৳10.50".
 */
export function formatPrice(paisa: number, lang: Lang): string {
  if (!Number.isInteger(paisa)) throw new RangeError(`Paisa must be an integer: ${paisa}`);
  const abs = Math.abs(paisa);
  const taka = groupLakh(String(Math.trunc(abs / 100)));
  const rest = abs % 100;
  const body = rest ? `${taka}.${String(rest).padStart(2, '0')}` : taka;
  return `${paisa < 0 ? '-' : ''}৳${localizeDigits(body, lang)}`;
}

/** Text in the wanted language, falling back to English when the Bangla is empty. */
export function pickText(text: LocalizedText, lang: Lang): string {
  return (lang === 'bn' && text.bn.trim() ? text.bn : text.en) ?? '';
}

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'bn';
}
