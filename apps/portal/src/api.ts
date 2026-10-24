import { createApiClient } from '@bdc/api-client';
import { QueryClient } from '@tanstack/react-query';

/** Same-origin client: Vite proxies /v1 to the API so the session cookie just works. */
// Absolute origin: openapi-fetch builds a Request, which needs a full URL (tests run in jsdom).
export const api = createApiClient({
  baseUrl: window.location.origin,
  credentials: 'include',
  // Late-bound so tests can stub globalThis.fetch after import.
  fetch: (req) => globalThis.fetch(req),
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Pulls a readable message out of Nest / nestjs-zod error bodies. */
export function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const b = body as { message?: unknown; errors?: unknown };
  if (Array.isArray(b.errors) && b.errors.length) {
    const parts = b.errors.map((e) => {
      const err = e as { path?: unknown[]; message?: string };
      const path = Array.isArray(err.path) && err.path.length ? `${err.path.join('.')}: ` : '';
      return `${path}${err.message ?? ''}`;
    });
    return parts.join('; ');
  }
  if (Array.isArray(b.message)) return b.message.join('; ');
  if (typeof b.message === 'string' && b.message) return b.message;
  return fallback;
}

/**
 * Unwraps an openapi-fetch result: returns `data` or throws ApiError with the API's message.
 *   const staff = await unwrap(api.GET('/v1/admin/staff'));
 */
export async function unwrap<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (!response.ok) {
    throw new ApiError(errorMessage(error, `Request failed (${response.status})`), response.status);
  }
  return data as T;
}

let onUnauthorized: (() => void) | null = null;

/** Registered once from main.tsx; called on any 401 outside the auth endpoints. */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.use({
  onResponse({ response }) {
    // Login / 2FA / me handle their own 401s (wrong password, expired step, guard).
    if (
      response.status === 401 &&
      !new URL(response.url, window.location.origin).pathname.startsWith('/v1/admin/auth/')
    ) {
      onUnauthorized?.();
    }
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

/**
 * Plain JSON fetch for endpoints not in the generated client yet (same error + 401 handling).
 * TODO(lead): drop this once /v1/portal/sr/* is in the generated types (use `api` + `unwrap`).
 */
export async function http<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) onUnauthorized?.();
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body (proxy error page)
  }
  if (!res.ok) {
    throw new ApiError(errorMessage(json, `Request failed (${res.status})`), res.status);
  }
  return json as T;
}
