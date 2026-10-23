import { describe, expect, it } from 'vitest';
import {
  adjustResult,
  checkAdjust,
  optionText,
  reasonLabel,
  signed,
} from '~/features/inventory/logic';
import { parseInventorySearch } from '~/features/inventory/search';

describe('reasonLabel', () => {
  it('maps every known ledger reason', () => {
    expect(reasonLabel('po_receive')).toBe('Purchase received');
    expect(reasonLabel('adjust')).toBe('Manual adjustment');
    expect(reasonLabel('order_reserve')).toBe('Order reserved');
    expect(reasonLabel('sr_ship')).toBe('Showroom sale');
    expect(reasonLabel('import')).toBe('Import');
  });

  it('title-cases unknown reasons', () => {
    expect(reasonLabel('damaged_goods')).toBe('Damaged goods');
    expect(reasonLabel('')).toBe('Unknown');
  });
});

describe('adjustResult', () => {
  it('adds in delta mode, replaces in set mode', () => {
    expect(adjustResult('delta', 10, 5)).toBe(15);
    expect(adjustResult('delta', 10, -4)).toBe(6);
    expect(adjustResult('set', 10, 3)).toBe(3);
  });

  it('is null without a whole number', () => {
    expect(adjustResult('delta', 10, null)).toBeNull();
    expect(adjustResult('set', 10, 1.5)).toBeNull();
  });
});

describe('checkAdjust', () => {
  it('accepts valid changes', () => {
    expect(checkAdjust('delta', 10, -10)).toEqual({ ok: true });
    expect(checkAdjust('set', 10, 0)).toEqual({ ok: true });
  });

  it('rejects negative results, zero deltas and empty input', () => {
    expect(checkAdjust('delta', 3, -4)).toMatchObject({ ok: false });
    expect(checkAdjust('delta', 3, 0)).toMatchObject({ ok: false });
    expect(checkAdjust('set', 3, -1)).toMatchObject({ ok: false });
    expect(checkAdjust('set', 3, null)).toMatchObject({ ok: false });
  });
});

describe('helpers', () => {
  it('formats option labels and signed numbers', () => {
    expect(optionText([{ en: 'Red' }, { en: 'XL' }])).toBe('Red / XL');
    expect(optionText([])).toBe('');
    expect(signed(5)).toBe('+5');
    expect(signed(-2)).toBe('-2');
    expect(signed(0)).toBe('0');
  });
});

describe('parseInventorySearch', () => {
  it('keeps valid params', () => {
    expect(
      parseInventorySearch({
        q: ' tee ',
        lowStock: true,
        fulfillment: 'dropship',
        page: '3',
        size: 50,
      }),
    ).toEqual({ q: 'tee', lowStock: true, fulfillment: 'dropship', page: 3, size: 50 });
  });

  it('drops invalid, default and empty values', () => {
    expect(
      parseInventorySearch({ q: '  ', lowStock: false, fulfillment: 'x', page: 1, size: 20 }),
    ).toEqual({});
    expect(parseInventorySearch({ page: -2, size: 33 })).toEqual({});
  });
});
