import { type NextRequest, NextResponse } from 'next/server';

/**
 * Locale routing (C26): English at the root, Bangla under /bn. Pages live in app/[lang]/...,
 * so English URLs are rewritten to the internal /en/... segment; /bn/... matches [lang]=bn as-is.
 * A literal /en/... URL is redirected to its canonical root form.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/bn' || pathname.startsWith('/bn/')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip the API rewrite (/v1), Next internals, and anything that looks like a file (sw.js, manifest, icons).
  matcher: ['/((?!v1/|_next/|.*\\.[^/]*$).*)'],
};
