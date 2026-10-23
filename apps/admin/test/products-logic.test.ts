// biome-ignore-all lint/style/noNonNullAssertion: indexes are known to exist in these fixtures
import { describe, expect, it } from 'vitest';
import {
  buildAttributePayload,
  mergeAttributes,
  missingRequired,
} from '~/features/products/attributes';
import { buildImagesPayload, buildProductPayload, emptyForm } from '~/features/products/payload';
import type { CategoryAttribute, ProductDetail, ProductVariant } from '~/features/products/types';
import {
  buildVariantsPayload,
  generateCombos,
  isRetired,
  type OptionDraft,
  skuProblems,
  suggestSku,
  syncRows,
  uniqueSku,
} from '~/features/products/variants';

const opt = (key: string, name: string, values: string[], ids = false): OptionDraft => ({
  key,
  nameEn: name,
  nameBn: '',
  values: values.map((v) => ({
    key: ids ? `id-${v}` : `k-${v}`,
    id: ids ? `id-${v}` : undefined,
    valueEn: v,
    valueBn: '',
    swatchHex: '',
  })),
});

describe('generateCombos', () => {
  it('gives one empty combination without options', () => {
    expect(generateCombos([])).toEqual([[]]);
  });
  it('one option: one combo per value', () => {
    expect(generateCombos([opt('o1', 'Size', ['S', 'M', 'L'])])).toHaveLength(3);
  });
  it('two options: cartesian product in order', () => {
    const combos = generateCombos([
      opt('o1', 'Color', ['Red', 'Blue']),
      opt('o2', 'Size', ['S', 'M']),
    ]);
    expect(combos).toEqual([
      ['k-Red', 'k-S'],
      ['k-Red', 'k-M'],
      ['k-Blue', 'k-S'],
      ['k-Blue', 'k-M'],
    ]);
  });
  it('ignores unnamed options and blank values', () => {
    expect(generateCombos([opt('o1', '', ['S']), opt('o2', 'Size', ['S', ' '])])).toEqual([
      ['k-S'],
    ]);
  });
});

describe('suggestSku', () => {
  it('joins slug and value codes', () => {
    expect(suggestSku('cotton-tee', ['Red', 'Large'])).toBe('COTTON-TEE-RED-LARGE');
  });
  it('falls back for an empty slug and stays within 64 chars', () => {
    expect(suggestSku('', [])).toBe('SKU');
    expect(
      suggestSku('x'.repeat(100), ['a'.repeat(30), 'b'.repeat(30)]).length,
    ).toBeLessThanOrEqual(64);
  });
  it('uniqueSku suffixes collisions', () => {
    expect(uniqueSku('A', new Set(['a', 'A-2']))).toBe('A-3');
  });
});

describe('syncRows', () => {
  it('builds rows with unique suggested SKUs', () => {
    const rows = syncRows([opt('o1', 'Size', ['S', 'M'])], [], 'tee');
    expect(rows.map((r) => r.sku)).toEqual(['TEE-S', 'TEE-M']);
  });

  it('keeps ids and edits of combinations that persist, adds only the new one', () => {
    const options = [opt('o1', 'Size', ['S', 'M'], true)];
    const first = syncRows(options, [], 'tee').map((r, i) => ({
      ...r,
      id: `v${i}`,
      priceP: 1000 + i,
    }));
    const grown = [opt('o1', 'Size', ['S', 'M', 'L'], true)];
    grown[0]!.values[2] = { key: 'new', valueEn: 'L', valueBn: '', swatchHex: '' };
    const next = syncRows(grown, first, 'tee');
    expect(next.map((r) => r.id)).toEqual(['v0', 'v1', undefined]);
    expect(next[1]?.priceP).toBe(1001);
    expect(next[2]?.sku).toBe('TEE-L');
  });

  it('re-suggests auto SKUs as a value is typed, but never touches edited or saved SKUs', () => {
    const o = [opt('o1', 'Size', ['S'])];
    let rows = syncRows(o, [], 'tee');
    o[0]!.values[0]!.valueEn = 'Small';
    rows = syncRows(o, rows, 'tee');
    expect(rows[0]?.sku).toBe('TEE-SMALL');
    rows = [{ ...rows[0]!, sku: 'MINE', skuAuto: false }];
    o[0]!.values[0]!.valueEn = 'Tiny';
    expect(syncRows(o, rows, 'tee')[0]?.sku).toBe('MINE');
  });

  it('carries a simple product variant over to the first combination and back', () => {
    const simple = syncRows([], [], 'tee').map((r) => ({ ...r, id: 'v0', onHand: 7 }));
    const withOpts = syncRows([opt('o1', 'Size', ['S', 'M'])], simple, 'tee');
    expect(withOpts[0]?.id).toBe('v0');
    expect(withOpts[0]?.onHand).toBe(7);
    expect(withOpts[1]?.id).toBeUndefined();
    const back = syncRows([], withOpts, 'tee');
    expect(back).toHaveLength(1);
    expect(back[0]?.id).toBe('v0');
  });

  it('flags empty and duplicate SKUs', () => {
    const rows = syncRows([opt('o1', 'Size', ['S', 'M', 'L'])], [], 'tee');
    rows[0]!.sku = 'dup';
    rows[1]!.sku = 'DUP';
    rows[2]!.sku = ' ';
    expect([...skuProblems(rows)]).toEqual(rows.map((r) => r.comboKey));
  });
});

describe('buildVariantsPayload', () => {
  const options = [opt('o1', 'Color', ['Red', 'Blue'], true)];
  options[0]!.values.push({ key: 'n1', valueEn: 'Green', valueBn: '', swatchHex: '#00ff00' });
  const rows = syncRows(options, [], 'tee').map((r, i) => ({
    ...r,
    id: i === 0 ? 'variant-1' : undefined,
    priceP: 12550,
    costP: 8000,
    saleStartsAt: null,
  }));

  it('omits costP without view_cost', () => {
    const p = buildVariantsPayload(options, rows, { canViewCost: false });
    for (const v of p.variants) expect('costP' in v).toBe(false);
  });
  it('sends costP with view_cost', () => {
    const p = buildVariantsPayload(options, rows, { canViewCost: true });
    expect(p.variants[0]?.costP).toBe(8000);
  });
  it('keeps paisa values, ids and value refs (uuid for saved values, index for new ones)', () => {
    const p = buildVariantsPayload(options, rows, { canViewCost: false });
    expect(p.variants[0]).toMatchObject({
      id: 'variant-1',
      priceP: 12550,
      optionValueRefs: ['id-Red'],
    });
    expect(p.variants[2]?.optionValueRefs).toEqual([2]);
    expect(p.variants[2]).not.toHaveProperty('id');
    expect(p.options[0]?.values[2]).toMatchObject({ valueEn: 'Green', swatchHex: '#00ff00' });
    expect(p.options[0]?.values[2]).not.toHaveProperty('id');
  });
  it('leaves retired variants out of the payload and keeps them through option edits', () => {
    const live = syncRows(options, [], 'tee').map((r, i) => ({ ...r, id: `v${i}` }));
    const retired = {
      ...syncRows([], [], 'tee')[0]!,
      id: 'old',
      sku: 'TEE-OLD',
      isActive: false,
      retired: true,
    };
    const all = [...live, retired];
    const p = buildVariantsPayload(options, all, { canViewCost: false });
    expect(p.variants.map((v) => v.id)).toEqual(['v0', 'v1', 'v2']);
    expect(p.variants.some((v) => v.sku === 'TEE-OLD')).toBe(false);
    const synced = syncRows(options, all, 'tee');
    expect(synced.at(-1)).toMatchObject({ id: 'old', retired: true });
    expect(synced.filter((r) => !r.retired)).toHaveLength(3);
    expect([...skuProblems(all)]).toEqual([]);
  });
  it('treats an inactive option-less variant as retired only when the product has other variants', () => {
    const v = (id: string, isActive: boolean, vals: (string | null)[]) =>
      ({ id, isActive, optionValueIds: vals }) as ProductVariant;
    const simple = { options: [], variants: [v('a', false, [])] } as unknown as ProductDetail;
    expect(isRetired(simple.variants[0]!, simple)).toBe(false);
    const multi = {
      options: [{}],
      variants: [v('a', true, ['x']), v('b', false, [null])],
    } as unknown as ProductDetail;
    expect(isRetired(multi.variants[1]!, multi)).toBe(true);
    expect(isRetired(multi.variants[0]!, multi)).toBe(false);
  });
  it('sends no options and empty refs for a simple product', () => {
    const p = buildVariantsPayload([], syncRows([], [], 'tee'), { canViewCost: false });
    expect(p.options).toEqual([]);
    expect(p.variants[0]?.optionValueRefs).toEqual([]);
  });
});

describe('product payload', () => {
  it('requires a primary category and keeps money as paisa', () => {
    const form = emptyForm();
    form.titleEn = ' Tee ';
    expect(() => buildProductPayload(form, null)).toThrow();
    form.primaryCategoryId = 'c1';
    form.extraCategoryIds = ['c1', 'c2', 'c2'];
    form.deliveryChargeOverrideP = 6000;
    const body = buildProductPayload(form, null);
    expect(body).toMatchObject({
      titleEn: 'Tee',
      categoryIds: ['c2'],
      deliveryChargeOverrideP: 6000,
    });
    expect(body).not.toHaveProperty('attributes');
    expect(body).not.toHaveProperty('slug');
  });
  it('drops the pre-order date and pin boost when the flags are off', () => {
    const form = {
      ...emptyForm(),
      primaryCategoryId: 'c1',
      preorderExpectedDate: '2026-12-01',
      pinBoost: 50,
    };
    const body = buildProductPayload(form, []);
    expect(body.preorderExpectedDate).toBeNull();
    expect(body.pinBoost).toBe(0);
    expect(body.attributes).toEqual([]);
  });
  it('images fall back to all variants when the variant is gone', () => {
    const img = { mediaId: 'm', url: '', thumbUrl: '', alt: ' ', variantId: 'gone' };
    expect(buildImagesPayload([img], new Set(['x'])).images[0]).toEqual({
      mediaId: 'm',
      variantId: null,
      alt: null,
    });
  });
});

describe('attributes', () => {
  const attr = (
    id: string,
    type: CategoryAttribute['type'],
    extra: Partial<CategoryAttribute> = {},
  ): CategoryAttribute => ({
    id,
    categoryId: 'c',
    key: id,
    nameEn: id,
    nameBn: null,
    type,
    unit: null,
    isFilterable: false,
    isRequired: false,
    sort: 0,
    options: [],
    ...extra,
  });
  const detail = (own: CategoryAttribute[], inherited: CategoryAttribute[]) => ({
    attributes: own,
    inheritedAttributes: inherited,
  });

  it('merges and dedupes across categories, inherited first', () => {
    const a = attr('a', 'text');
    const b = attr('b', 'number');
    const c = attr('c', 'boolean');
    const merged = mergeAttributes([detail([b], [a]), detail([c, a], [a])]);
    expect(merged.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('builds the payload per type and skips empty/stale values', () => {
    const sel = attr('s', 'select', {
      options: [{ id: 'o1', valueEn: 'x', valueBn: null, sort: 0 }],
    });
    const attrs = [
      attr('t', 'text'),
      attr('n', 'number'),
      attr('b', 'boolean'),
      sel,
      attr('e', 'text'),
    ];
    const payload = buildAttributePayload(attrs, {
      t: { text: ' hi ' },
      n: { number: 0 },
      b: { bool: false },
      s: { optionIds: ['o1', 'gone'] },
      e: { text: '  ' },
      stale: { text: 'x' },
    });
    expect(payload).toEqual([
      { attributeId: 't', valueText: 'hi' },
      { attributeId: 'n', valueNumber: 0 },
      { attributeId: 'b', valueBool: false },
      { attributeId: 's', optionIds: ['o1'] },
    ]);
  });

  it('lists missing required attributes', () => {
    const req = attr('r', 'text', { isRequired: true });
    expect(missingRequired([req], {}).map((a) => a.id)).toEqual(['r']);
    expect(missingRequired([req], { r: { text: 'ok' } })).toEqual([]);
  });
});
