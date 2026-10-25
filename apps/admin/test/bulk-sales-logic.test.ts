import { describe, expect, it } from 'vitest';
import {
  describeRule,
  emptyForm,
  formProblem,
  percentToBp,
  toRule,
} from '~/features/bulk-sales/logic';

const pick = { productIds: ['p1'] };

describe('percentToBp', () => {
  it('avoids float noise', () => {
    expect(percentToBp(12.5)).toBe(1250);
    expect(percentToBp(1.1)).toBe(110);
    expect(percentToBp(33.33)).toBe(3333);
  });
});

describe('formProblem', () => {
  it('asks for a scope first', () => {
    expect(formProblem({ ...emptyForm(), percent: 10 })).toMatch(/at least one/i);
  });
  it('needs a value', () => {
    expect(formProblem({ ...emptyForm(), ...pick })).toMatch(/percentage/);
    expect(formProblem({ ...emptyForm(), ...pick, mode: 'fixed' })).toMatch(/amount/);
  });
  it('rejects 100 percent and above', () => {
    expect(formProblem({ ...emptyForm(), ...pick, percent: 100 })).toMatch(/below 100/);
  });
  it('rejects an end before the start', () => {
    const f = {
      ...emptyForm(),
      ...pick,
      percent: 10,
      startsAt: '2026-11-02 10:00:00',
      endsAt: '2026-11-01 10:00:00',
    };
    expect(formProblem(f)).toMatch(/end must be after/);
  });
  it('passes a valid form', () => {
    expect(formProblem({ ...emptyForm(), ...pick, percent: 10 })).toBeNull();
  });
});

describe('toRule', () => {
  it('sends basis points for percent and omits empty scope lists', () => {
    const r = toRule({ ...emptyForm(), ...pick, percent: 12.5 });
    expect(r).toMatchObject({
      mode: 'percent',
      value: 1250,
      scope: { productIds: ['p1'], categoryIds: undefined, brandIds: undefined },
      startsAt: null,
      endsAt: null,
      skipExistingSales: true,
    });
  });
  it('sends paisa for fixed amounts', () => {
    expect(toRule({ ...emptyForm(), ...pick, mode: 'fixed', valueP: 5000 }).value).toBe(5000);
  });
});

describe('describeRule', () => {
  it('reads naturally', () => {
    expect(describeRule('percent', 1250, (p) => `৳${p / 100}`)).toBe('12.5% off');
    expect(describeRule('fixed', 5000, (p) => `৳${p / 100}`)).toBe('৳50 off');
  });
});
