const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/**
 * Normalizes a Bangladesh mobile number to `01XXXXXXXXX`. Accepts `01…`, `+8801…`, `8801…`,
 * Bangla digits, spaces and dashes. Returns null for anything else (operator prefixes 013–019 only).
 */
export function normalizePhone(input: string): string | null {
  let s = input
    .trim()
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/[\s\-()]/g, '');
  if (s.startsWith('+880')) s = s.slice(4);
  else if (s.startsWith('880')) s = s.slice(3);
  else if (s.startsWith('0')) s = s.slice(1);
  else return null;
  return /^1[3-9]\d{8}$/.test(s) ? `0${s}` : null;
}

/** `01712345678` → `017******78` */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}******${phone.slice(-2)}`;
}
