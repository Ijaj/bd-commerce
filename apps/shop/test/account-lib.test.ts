import { describe, expect, it } from 'vitest';
import { cleanCode, errorMessage, isEmail, normalizePhone, safeNext } from '~/features/account/lib';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';

describe('normalizePhone', () => {
  it('accepts local, +880, 880 and Bangla digits', () => {
    expect(normalizePhone('01712345678')).toBe('01712345678');
    expect(normalizePhone('+880 1712-345678')).toBe('01712345678');
    expect(normalizePhone('8801712345678')).toBe('01712345678');
    expect(normalizePhone('০১৭১২৩৪৫৬৭৮')).toBe('01712345678');
  });
  it('rejects bad numbers', () => {
    expect(normalizePhone('0121234567')).toBeNull();
    expect(normalizePhone('1712345678')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('cleanCode / isEmail', () => {
  it('keeps six ASCII digits, converting Bangla ones', () => {
    expect(cleanCode('১২৩ 456 789')).toBe('123456');
    expect(cleanCode('12-34')).toBe('1234');
  });
  it('checks email shape', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });
});

describe('safeNext', () => {
  const fb = '/account';
  it('allows same-site paths', () => {
    expect(safeNext('/p/shirt?x=1', fb)).toBe('/p/shirt?x=1');
    expect(safeNext('/bn/cart', fb)).toBe('/bn/cart');
  });
  it('blocks open redirects', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'evil', '', '/a\nb']) {
      expect(safeNext(bad, fb)).toBe(fb);
    }
    expect(safeNext(undefined, fb)).toBe(fb);
  });
  it('uses the first of repeated params', () => {
    expect(safeNext(['/x', '//y'], fb)).toBe('/x');
  });
});

describe('errorMessage', () => {
  const fail = (code: string | null, status = 400) => ({
    ok: false as const,
    status,
    code,
    message: null,
  });
  it('maps every API code to a message in both languages', () => {
    const codes = [
      'PHONE_TAKEN',
      'EMAIL_TAKEN',
      'PHONE_INVALID',
      'OTP_INVALID',
      'OTP_EXPIRED',
      'OTP_COOLDOWN',
      'TOO_MANY_ATTEMPTS',
      'TOO_MANY_REQUESTS',
      'INVALID_CREDENTIALS',
      'ACCOUNT_DISABLED',
      'NOT_FOUND',
    ];
    for (const c of codes) {
      expect(errorMessage(fail(c), en.account.errors)).not.toBe(en.account.errors.generic);
      expect(errorMessage(fail(c), bn.account.errors)).not.toBe(bn.account.errors.generic);
    }
  });
  it('falls back by status and handles network errors and overrides', () => {
    const e = en.account.errors;
    expect(errorMessage(fail(null, 429), e)).toBe(e.TOO_MANY_REQUESTS);
    expect(errorMessage(fail(null, 400), e)).toBe(e.validation);
    expect(errorMessage(fail(null, 500), e)).toBe(e.generic);
    expect(errorMessage(fail('NETWORK', 0), e)).toBe(e.network);
    expect(
      errorMessage(fail('INVALID_CREDENTIALS'), e, { INVALID_CREDENTIALS: 'WRONG_PASSWORD' }),
    ).toBe(e.WRONG_PASSWORD);
  });
});
