import { describe, expect, it } from 'vitest';
import {
  problemMap,
  problemsFromServer,
  toOptionPayload,
  validateOptions,
} from '~/features/categories/options';

const row = (valueEn: string, valueBn = '', id?: string) => ({
  key: valueEn || 'k',
  id,
  valueEn,
  valueBn,
});

describe('validateOptions', () => {
  it('accepts distinct values and blank Bangla', () => {
    expect(validateOptions([row('Red'), row('Blue', 'নীল')])).toEqual([]);
  });

  it('flags blank English (whitespace counts as blank)', () => {
    expect(validateOptions([row('Red'), row('   ')])).toEqual([
      { index: 1, field: 'valueEn', reason: 'blank' },
    ]);
  });

  it('flags every row of a case-insensitive duplicate English group', () => {
    const p = validateOptions([row('Red'), row('Blue'), row(' red ')]);
    expect(p).toEqual([
      { index: 0, field: 'valueEn', reason: 'duplicate' },
      { index: 2, field: 'valueEn', reason: 'duplicate' },
    ]);
  });

  it('checks Bangla duplicates separately and ignores blank Bangla', () => {
    const p = validateOptions([row('A', 'লাল'), row('B', 'লাল'), row('C', ''), row('D', '')]);
    expect(p).toEqual([
      { index: 0, field: 'valueBn', reason: 'duplicate' },
      { index: 1, field: 'valueBn', reason: 'duplicate' },
    ]);
    expect(problemMap(p).get('1:valueBn')).toBe('duplicate');
  });
});

describe('toOptionPayload / problemsFromServer', () => {
  it('trims, nulls blank Bangla and keeps ids only for existing options', () => {
    expect(toOptionPayload([row(' Red ', ' ', 'id-1'), row('Blue', 'নীল')])).toEqual([
      { id: 'id-1', valueEn: 'Red', valueBn: null },
      { valueEn: 'Blue', valueBn: 'নীল' },
    ]);
  });

  it('reads the API 400 row list and drops unknown shapes', () => {
    expect(
      problemsFromServer([
        { index: 2, field: 'valueEn', reason: 'duplicate' },
        { index: 'x', field: 'valueEn', reason: 'blank' },
        { index: 1, field: 'id', reason: 'unknown' },
      ]),
    ).toEqual([{ index: 2, field: 'valueEn', reason: 'duplicate' }]);
    expect(problemsFromServer(undefined)).toEqual([]);
  });
});
