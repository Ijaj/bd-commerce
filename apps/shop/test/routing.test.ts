import { describe, expect, it } from 'vitest';
import { fmt, pick, t } from '~/i18n';
import { alternatesFor, href, langFromPathname, stripLang, switchLangPath } from '~/i18n/routing';

describe('routing', () => {
  it('builds locale hrefs', () => {
    expect(href('en', '/')).toBe('/');
    expect(href('bn', '/')).toBe('/bn');
    expect(href('en', '/p/x')).toBe('/p/x');
    expect(href('bn', 'p/x')).toBe('/bn/p/x');
  });
  it('detects and strips the language prefix', () => {
    expect(langFromPathname('/bn/c/shoes')).toBe('bn');
    expect(langFromPathname('/bnx')).toBe('en');
    expect(stripLang('/bn')).toBe('/');
    expect(stripLang('/bn/c/shoes')).toBe('/c/shoes');
    expect(stripLang('/c/shoes')).toBe('/c/shoes');
  });
  it('switches language keeping the path', () => {
    expect(switchLangPath('/c/shoes', 'bn')).toBe('/bn/c/shoes');
    expect(switchLangPath('/bn/c/shoes', 'en')).toBe('/c/shoes');
    expect(switchLangPath('/bn', 'en')).toBe('/');
  });
  it('builds hreflang alternates', () => {
    const a = alternatesFor('bn', '/c/shoes');
    expect(a.canonical).toMatch(/\/bn\/c\/shoes$/);
    expect(a.languages.en).toMatch(/\/c\/shoes$/);
    expect(a.languages['x-default']).toBe(a.languages.en);
    expect(alternatesFor('en', '/').languages.bn).toMatch(/\/bn$/);
  });
});

describe('text helpers', () => {
  it('falls back to English when Bangla is empty', () => {
    expect(t('bn', { en: 'Hi', bn: 'হাই' })).toBe('হাই');
    expect(t('bn', { en: 'Hi', bn: ' ' })).toBe('Hi');
    expect(pick('bn', 'Shoe', null)).toBe('Shoe');
    expect(pick('en', 'Shoe', 'জুতা')).toBe('Shoe');
  });
  it('interpolates', () => {
    expect(fmt('Showing {n} of {m}', { n: 2, m: 5 })).toBe('Showing 2 of 5');
  });
});
