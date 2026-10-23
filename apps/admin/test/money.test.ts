import { describe, expect, it } from 'vitest';
import { formatPrice } from '~/lib/format';
import { paisaToTaka, takaToPaisa } from '~/lib/money';

describe('money helpers', () => {
  it('converts taka to integer paisa without float drift', () => {
    expect(takaToPaisa('19.99')).toBe(1999);
    expect(takaToPaisa(1.005)).toBe(101);
    expect(takaToPaisa('1,250.50')).toBe(125050);
    expect(takaToPaisa('')).toBeNull();
    expect(takaToPaisa('abc')).toBeNull();
  });

  it('converts paisa to taka', () => {
    expect(paisaToTaka(12550)).toBe(125.5);
    expect(paisaToTaka(null)).toBe('');
  });

  it('formats with lakh grouping', () => {
    expect(formatPrice(12500000)).toBe('৳1,25,000');
    expect(formatPrice(1050)).toBe('৳10.50');
  });
});
