import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, unwrap } from '~/api';
import { visibleNav } from '~/lib/nav';
import { hasPermissions } from '~/lib/perm';
import { safeRedirect } from '~/lib/redirect';

describe('errorMessage', () => {
  it('reads Nest and nestjs-zod bodies', () => {
    expect(errorMessage({ message: 'Invalid credentials' }, 'x')).toBe('Invalid credentials');
    expect(errorMessage({ message: ['a', 'b'] }, 'x')).toBe('a; b');
    expect(
      errorMessage(
        { message: 'Validation failed', errors: [{ path: ['email'], message: 'Bad' }] },
        'x',
      ),
    ).toBe('email: Bad');
    expect(errorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('unwrap', () => {
  it('throws ApiError with the API message', async () => {
    const res = new Response(null, { status: 409 });
    await expect(
      unwrap(Promise.resolve({ error: { message: 'Taken' }, response: res })),
    ).rejects.toMatchObject({
      message: 'Taken',
      status: 409,
    });
    await expect(
      unwrap(Promise.resolve({ error: {}, response: new Response(null, { status: 500 }) })),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('returns data on success', async () => {
    const res = new Response('{}', { status: 200 });
    await expect(unwrap(Promise.resolve({ data: { ok: 1 }, response: res }))).resolves.toEqual({
      ok: 1,
    });
  });
});

describe('permissions and nav', () => {
  it('checks all-of permissions', () => {
    expect(hasPermissions(['a', 'b'], 'a', 'b')).toBe(true);
    expect(hasPermissions(['a'], 'a', 'b')).toBe(false);
    expect(hasPermissions(undefined, 'a')).toBe(false);
  });

  it('hides nav items without permission', () => {
    const labels = (p: string[]) => visibleNav(p).flatMap((s) => s.items.map((i) => i.label));
    expect(labels([])).toEqual(['Dashboard']);
    expect(labels(['products.view', 'settings.view'])).toEqual([
      'Dashboard',
      'Products',
      'Brands',
      'Settings',
    ]);
  });

  it('only allows same-origin redirects', () => {
    expect(safeRedirect('/staff?x=1')).toBe('/staff?x=1');
    expect(safeRedirect('//evil.com')).toBeUndefined();
    expect(safeRedirect('https://evil.com')).toBeUndefined();
  });
});
