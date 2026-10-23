import { describe, expect, it } from 'vitest';
import { formatNumber, formatPrice, pickText, toBnDigits, toEnDigits } from '../src/index.js';

describe('digits', () => {
  it('converts both ways', () => {
    expect(toBnDigits('01712-345678')).toBe('০১৭১২-৩৪৫৬৭৮');
    expect(toEnDigits('০১৭১২৩৪৫৬৭৮')).toBe('01712345678');
    expect(toEnDigits('abc ৫x')).toBe('abc 5x');
  });
});

describe('formatNumber', () => {
  it.each([
    [0, 'en', '0'],
    [999, 'en', '999'],
    [1000, 'en', '1,000'],
    [125000, 'en', '1,25,000'],
    [12345678, 'en', '1,23,45,678'],
    [125000, 'bn', '১,২৫,০০০'],
    [1234.5, 'en', '1,234.5'],
    [-125000, 'en', '-1,25,000'],
    [-0.001, 'en', '0'],
  ] as const)('%d (%s) → %s', (value, lang, expected) => {
    expect(formatNumber(value, lang)).toBe(expected);
  });
});

describe('formatPrice', () => {
  it.each([
    [12500000, 'en', '৳1,25,000'],
    [12500000, 'bn', '৳১,২৫,০০০'],
    [1050, 'en', '৳10.50'],
    [1005, 'bn', '৳১০.০৫'],
    [0, 'en', '৳0'],
    [-25000, 'en', '-৳250'],
  ] as const)('%d paisa (%s) → %s', (paisa, lang, expected) => {
    expect(formatPrice(paisa, lang)).toBe(expected);
  });

  it('rejects fractional paisa', () => {
    expect(() => formatPrice(10.5, 'en')).toThrow(RangeError);
  });
});

describe('pickText', () => {
  it('falls back to English when Bangla is blank', () => {
    expect(pickText({ en: 'Sale', bn: 'সেল' }, 'bn')).toBe('সেল');
    expect(pickText({ en: 'Sale', bn: ' ' }, 'bn')).toBe('Sale');
    expect(pickText({ en: 'Sale', bn: 'সেল' }, 'en')).toBe('Sale');
  });
});
