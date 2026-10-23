/** Cell parsers: each returns the value or a string error message. Taka are parsed from text, never floats. */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

const MAX_PAISA = 2_000_000_000;

/** "1250", "1,250.50", "0.5" -> paisa. No currency symbols, at most 2 decimals. */
export function parsePrice(raw: string): Parsed<number> {
  const s = raw.trim();
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) {
    return fail(
      'Invalid price: use plain taka like 1250 or 1,250.50 (no currency symbol, max 2 decimals)',
    );
  }
  const taka = (m[1] as string).replaceAll(',', '');
  if (taka.length > 10) return fail('Price is too large');
  const paisa = Number(taka) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  if (paisa > MAX_PAISA) return fail('Price is too large');
  return ok(paisa);
}

export function formatPaisa(paisa: number): string {
  const whole = Math.floor(paisa / 100);
  const frac = paisa % 100;
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

export function parseInteger(raw: string, max = 1_000_000): Parsed<number> {
  const s = raw.trim();
  if (!/^\d+$/.test(s) || s.length > 10) return fail('Must be a whole number, 0 or more');
  const n = Number(s);
  return n > max ? fail(`Must be at most ${max}`) : ok(n);
}

export function parseBool(raw: string): Parsed<boolean> {
  switch (raw.trim().toLowerCase()) {
    case 'true':
    case 'yes':
    case '1':
      return ok(true);
    case 'false':
    case 'no':
    case '0':
      return ok(false);
    default:
      return fail('Must be true or false');
  }
}

export function parseDate(raw: string): Parsed<string> {
  const s = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return fail('Date must look like 2026-12-31');
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return fail('Not a real calendar date');
  }
  return ok(s);
}

/** Canonical decimal text so "12.50", "12.5" and the stored Decimal compare equal. */
export function parseDecimal(raw: string): Parsed<string> {
  const m = /^([+-]?)(\d{1,10})(?:\.(\d{1,4}))?$/.exec(raw.trim());
  if (!m) return fail('Must be a number with at most 4 decimals');
  const frac = (m[3] ?? '').replace(/0+$/, '');
  const int = (m[2] as string).replace(/^0+(?=\d)/, '');
  const neg = m[1] === '-' && (int !== '0' || frac !== '');
  return ok(`${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`);
}

export function splitList(raw: string): string[] {
  return raw
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}
