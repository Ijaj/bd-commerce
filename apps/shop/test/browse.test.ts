import { describe, expect, it } from 'vitest';
import {
  canOrder,
  initialSelection,
  maxQty,
  pushRecent,
  selectValue,
  valueState,
  variantFor,
  youtubeId,
} from '~/features/browse/logic';
import { isFiltered, parseListingQuery, toApiParams, toSearch } from '~/features/browse/query';
import { breadcrumbLd, plainText } from '~/features/browse/seo';
import type { ProductDetail, ProductVariant } from '~/features/browse/types';

describe('listing query', () => {
  it('parses filters from the URL and ignores junk', () => {
    const q = parseListingQuery({
      q: ' shirt ',
      brand: ['a', 'b,c'],
      min: '100',
      max: 'abc',
      rating: '9',
      availability: 'in_stock,bogus',
      sort: 'nope',
      page: '-3',
      'attr.color': 'x,y',
    });
    expect(q).toMatchObject({
      q: 'shirt',
      brand: ['a', 'b', 'c'],
      min: 100,
      max: null,
      rating: null,
      availability: ['in_stock'],
      sort: null,
      page: 1,
      attrs: { color: ['x', 'y'] },
    });
  });

  it('converts taka to paisa for the API and omits empty params', () => {
    const q = parseListingQuery({ min: '100', max: '0', rating: '4', page: '2', sort: 'newest' });
    expect(toApiParams(q, { category: 'phones' })).toEqual({
      page: 2,
      limit: 24,
      category: 'phones',
      minPrice: 10000,
      rating: 4,
      sort: 'newest',
    });
  });

  it('round-trips through toSearch and resets the page when a filter changes', () => {
    const q = parseListingQuery({ brand: 'walton,vision', 'attr.ram': 'u1', page: '3' });
    const s = toSearch(q, { brand: ['walton'] });
    expect(s).toBe('?brand=walton&attr.ram=u1');
    expect(toSearch(q, { page: 4 })).toContain('page=4');
    expect(toSearch(parseListingQuery({}))).toBe('');
  });

  it('knows when a view is filtered (noindex) vs just paginated', () => {
    expect(isFiltered(parseListingQuery({ page: '2' }))).toBe(false);
    expect(isFiltered(parseListingQuery({ sort: 'newest' }))).toBe(true);
    expect(isFiltered(parseListingQuery({ q: 'x' }), false)).toBe(false);
  });
});

const v = (
  id: string,
  o1: string | null,
  o2: string | null,
  available: number,
  isActive = true,
): ProductVariant => ({
  id,
  sku: id,
  optionValue1Id: o1,
  optionValue2Id: o2,
  priceP: 100,
  compareAtP: null,
  discountPct: null,
  available,
  isActive,
});
const product = (over: Partial<ProductDetail> = {}) =>
  ({
    isPreorder: false,
    isUpcoming: false,
    options: [
      { position: 1, nameEn: 'Color', nameBn: null, values: [] },
      { position: 2, nameEn: 'Size', nameBn: null, values: [] },
    ],
    variants: [
      v('a', 'red', 's', 0),
      v('b', 'red', 'm', 3),
      v('c', 'blue', 's', 5),
      v('d', 'blue', 'm', 1, false),
    ],
    ...over,
  }) as unknown as ProductDetail;

describe('variant selection', () => {
  it('starts on the first orderable variant', () => {
    expect(initialSelection(product())).toEqual(['red', 'm']);
  });

  it('finds variants and skips inactive ones', () => {
    const p = product();
    expect(variantFor(p.variants, ['red', 'm'], p.options)?.id).toBe('b');
    expect(variantFor(p.variants, ['blue', 'm'], p.options)).toBeNull();
  });

  it('marks option values sold out or impossible given the other choice', () => {
    const p = product();
    expect(valueState(p, 2, 's', ['red', 'm'])).toBe('soldout'); // red/s has 0
    expect(valueState(p, 2, 'm', ['blue', 's'])).toBe('none'); // blue/m inactive
    expect(valueState(p, 1, 'blue', ['red', 'm'])).toBe('none'); // blue exists but not with m
  });

  it('moves the other option when a choice would leave no variant', () => {
    const p = product();
    expect(selectValue(p, 1, 'blue', ['red', 'm'])).toEqual(['blue', 's']);
  });

  it('pre-order ignores stock, up-coming is never orderable', () => {
    const out = v('x', null, null, 0);
    expect(canOrder(out, { isPreorder: false, isUpcoming: false })).toBe(false);
    expect(canOrder(out, { isPreorder: true, isUpcoming: false })).toBe(true);
    expect(canOrder(v('y', null, null, 9), { isPreorder: true, isUpcoming: true })).toBe(false);
    expect(maxQty(v('y', null, null, 4), { isPreorder: false })).toBe(4);
    expect(maxQty(v('y', null, null, 40), { isPreorder: false })).toBe(10);
    expect(maxQty(out, { isPreorder: true })).toBe(10);
  });

  it('single-product without options uses the only variant', () => {
    const p = product({ options: [], variants: [v('solo', null, null, 2)] });
    expect(variantFor(p.variants, [null, null], p.options)?.id).toBe('solo');
  });
});

describe('helpers', () => {
  it('extracts YouTube ids and rejects other hosts', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeId('javascript:alert(1)')).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });

  it('keeps recently viewed unique, newest first, capped', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], 'z', 2)).toEqual(['z', 'a']);
  });

  it('builds plain-text descriptions and breadcrumb JSON-LD', () => {
    expect(plainText('<p>Hello&nbsp;<b>world</b></p>')).toBe('Hello world');
    expect(plainText('x'.repeat(300))?.length).toBe(160);
    const ld = breadcrumbLd('bn', 'হোম', [{ slug: 'phones', nameEn: 'Phones', nameBn: 'ফোন' }], {
      name: 'P',
      path: '/p/p',
    });
    expect(ld.itemListElement.map((i) => i.name)).toEqual(['হোম', 'ফোন', 'P']);
    expect(ld.itemListElement[1]?.item).toContain('/bn/c/phones');
  });
});
