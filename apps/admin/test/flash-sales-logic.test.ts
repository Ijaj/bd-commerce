import { describe, expect, it } from 'vitest';
import { HttpError } from '~/features/categories/http';
import {
  discountPercent,
  flashErrorMessage,
  type ItemDraft,
  itemProblem,
  toItemBodies,
} from '~/features/flash-sales/logic';

const draft = (over: Partial<ItemDraft> = {}): ItemDraft => ({
  variantId: 'v1',
  productTitleEn: 'Romper',
  sku: 'R-1',
  priceP: 100000,
  currentSalePriceP: null,
  qtySold: 0,
  flashPriceP: 80000,
  qtyLimit: 10,
  perCustomerLimit: null,
  sort: 0,
  ...over,
});

describe('itemProblem', () => {
  it('accepts a valid row', () => expect(itemProblem(draft())).toBeNull());
  it('needs a price below the regular price', () => {
    expect(itemProblem(draft({ flashPriceP: null }))).toMatch(/flash price/i);
    expect(itemProblem(draft({ flashPriceP: 100000 }))).toMatch(/below the regular/);
  });
  it('needs a quantity not below what is sold', () => {
    expect(itemProblem(draft({ qtyLimit: null }))).toMatch(/units/);
    expect(itemProblem(draft({ qtySold: 5, qtyLimit: 3 }))).toMatch(/At least 5/);
  });
});

describe('discountPercent', () => {
  it('rounds to a whole percent', () => expect(discountPercent(100000, 80000)).toBe(20));
  it('is null without a price', () => expect(discountPercent(100000, null)).toBeNull());
});

describe('toItemBodies', () => {
  it('maps drafts to the API body', () => {
    expect(toItemBodies([draft({ perCustomerLimit: 2, sort: 3 })])).toEqual([
      { variantId: 'v1', flashPriceP: 80000, qtyLimit: 10, perCustomerLimit: 2, sort: 3 },
    ]);
  });
});

describe('flashErrorMessage', () => {
  it('names the clashing sale for FLASH_OVERLAP', () => {
    const e = new HttpError('R-1 is already in "Eid" at the same time', 409, {
      code: 'FLASH_OVERLAP',
      saleName: 'Eid',
    });
    const msg = flashErrorMessage(e);
    expect(msg).toContain('already in "Eid"');
    expect(msg).toMatch(/one active flash sale/);
  });
  it('explains FLASH_HAS_SALES', () => {
    const e = new HttpError('x', 409, { code: 'FLASH_HAS_SALES' });
    expect(flashErrorMessage(e)).toMatch(/Deactivate/);
  });
  it('passes other messages through', () => {
    expect(
      flashErrorMessage(new HttpError('Flash price too high', 422, { code: 'FLASH_INVALID' })),
    ).toBe('Flash price too high');
  });
});
