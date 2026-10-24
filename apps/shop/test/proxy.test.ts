import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '~/proxy';

const run = (path: string) => proxy(new NextRequest(`http://localhost:3100${path}`));

describe('locale proxy', () => {
  it('rewrites English URLs to the internal /en segment', () => {
    expect(run('/')?.headers.get('x-middleware-rewrite')).toBe('http://localhost:3100/en');
    expect(run('/c/shoes?x=1')?.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3100/en/c/shoes?x=1',
    );
  });
  it('passes /bn through', () => {
    const r = run('/bn/c/shoes');
    expect(r?.headers.get('x-middleware-rewrite')).toBeNull();
    expect(r?.headers.get('x-middleware-next')).toBe('1');
  });
  it('redirects literal /en URLs to the root form', () => {
    const r = run('/en/p/x');
    expect(r?.status).toBe(308);
    expect(r?.headers.get('location')).toBe('http://localhost:3100/p/x');
    expect(run('/en')?.headers.get('location')).toBe('http://localhost:3100/');
  });
});
