/** Accepts only same-origin paths so ?redirect= cannot send people to another site. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : undefined;
}

export function validateRedirectSearch(search: Record<string, unknown>): { redirect?: string } {
  const redirect = safeRedirect(search.redirect);
  return redirect ? { redirect } : {};
}
