import { describe, expect, it } from 'vitest';
import { parseContentDisposition } from '~/features/import-export/filename';

describe('parseContentDisposition', () => {
  const fb = 'fallback.xlsx';

  it('reads a quoted filename', () => {
    expect(parseContentDisposition('attachment; filename="products-2026-10-23.xlsx"', fb)).toBe(
      'products-2026-10-23.xlsx',
    );
  });

  it('reads an unquoted filename', () => {
    expect(parseContentDisposition('attachment; filename=export.csv', fb)).toBe('export.csv');
  });

  it('prefers the UTF-8 filename* over filename', () => {
    const h = `attachment; filename="products.xlsx"; filename*=UTF-8''%E0%A6%AA%E0%A6%A3%E0%A7%8D%E0%A6%AF.xlsx`;
    expect(parseContentDisposition(h, fb)).toBe('পণ্য.xlsx');
  });

  it('falls back on a bad filename* escape', () => {
    expect(
      parseContentDisposition(`attachment; filename*=UTF-8''%E0%A6%; filename="ok.csv"`, fb),
    ).toBe('ok.csv');
  });

  it('unescapes quotes and strips paths', () => {
    expect(parseContentDisposition('attachment; filename="a\\"b.csv"', fb)).toBe('a"b.csv');
    expect(parseContentDisposition('attachment; filename="../../etc/passwd"', fb)).toBe('passwd');
  });

  it('uses the fallback when missing', () => {
    expect(parseContentDisposition(null, fb)).toBe(fb);
    expect(parseContentDisposition('attachment', fb)).toBe(fb);
  });
});
