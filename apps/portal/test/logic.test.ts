import { describe, expect, it } from 'vitest';
import type { SrLedgerRow } from '~/features/sr/api';
import {
  belowListPct,
  type DraftLine,
  emptyDraft,
  hasErrors,
  ledgerNewestFirst,
  lineFromProduct,
  type SaleDraft,
  saleTotals,
  shopMatches,
  validateSale,
} from '~/features/sr/logic';

const line = (over: Partial<DraftLine> = {}): DraftLine => ({
  ...lineFromProduct({
    variantId: 'v1',
    sku: 'SKU1',
    titleEn: 'Rice 5kg',
    titleBn: null,
    optionsText: '',
    optionsTextBn: '',
    image: null,
    priceP: 50000,
    available: 10,
  }),
  ...over,
});

const draft = (over: Partial<SaleDraft> = {}): SaleDraft => ({
  ...emptyDraft(),
  shopId: 'shop1',
  lines: [line()],
  ...over,
});

describe('validateSale', () => {
  it('accepts a normal sale', () => {
    expect(hasErrors(validateSale(draft({ paidP: 20000 })))).toBe(false);
  });
  it('requires a shop and at least one item', () => {
    const e = validateSale(draft({ shopId: null, lines: [] }));
    expect(e.shop).toBeTruthy();
    expect(e.items).toBeTruthy();
  });
  it('blocks qty above available', () => {
    const e = validateSale(draft({ lines: [line({ qty: 11 })] }));
    expect(e.lines.v1).toMatch(/Only 10 available/);
  });
  it('blocks qty below 1 or empty', () => {
    expect(validateSale(draft({ lines: [line({ qty: 0 })] })).lines.v1).toBeTruthy();
    expect(validateSale(draft({ lines: [line({ qty: null })] })).lines.v1).toBeTruthy();
  });
  it('blocks a missing price but allows a price below list', () => {
    expect(validateSale(draft({ lines: [line({ unitPriceP: null })] })).lines.v1).toBeTruthy();
    expect(hasErrors(validateSale(draft({ lines: [line({ unitPriceP: 100 })] })))).toBe(false);
  });
  it('blocks paid above the total, allows equal', () => {
    const d = draft({ lines: [line({ qty: 2 })] }); // total 100000
    expect(validateSale({ ...d, paidP: 100001 }).paid).toBeTruthy();
    expect(validateSale({ ...d, paidP: 100000 }).paid).toBeUndefined();
  });
});

describe('saleTotals', () => {
  it('computes total, list total and due', () => {
    const d = draft({ lines: [line({ qty: 3, unitPriceP: 45000 })], paidP: 35000 });
    expect(saleTotals(d)).toEqual({ totalP: 135000, listP: 150000, paidP: 35000, dueP: 100000 });
  });
  it('flags price below list in whole percent', () => {
    expect(belowListPct(line({ unitPriceP: 45000 }))).toBe(-10);
    expect(belowListPct(line({ unitPriceP: 50000 }))).toBeNull();
  });
});

describe('ledgerNewestFirst', () => {
  const row = (id: string, at: string): SrLedgerRow => ({
    id,
    b2bShopId: 'shop1',
    shopName: 'Shop',
    type: 'sale_due',
    amountP: 100,
    method: null,
    memoNo: null,
    confirmed: true,
    note: null,
    at,
  });
  it('sorts newest first without mutating the input', () => {
    const rows = [row('a', '2026-10-01'), row('c', '2026-10-03'), row('b', '2026-10-02')];
    expect(ledgerNewestFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows[0]?.id).toBe('a');
  });
});

describe('shopMatches', () => {
  const shop = { name: 'Rahman Store', ownerName: 'Abdur', area: 'Mirpur', phone: '01712345678' };
  it('matches name, owner, area, phone, case-insensitive', () => {
    for (const q of ['rahman', 'ABDUR', 'mirpur', '0171', ''])
      expect(shopMatches(shop, q)).toBe(true);
    expect(shopMatches(shop, 'uttara')).toBe(false);
  });
});
