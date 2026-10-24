import { createApiClient } from '@bdc/api-client';
import type { SiteStatus } from './types';

/** Server-only. Browser code calls the same-origin /v1 (rewritten to the API in next.config.ts). */
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

type Opts = {
  /** Raw Cookie header to forward (customer session). Disables caching. */
  cookie?: string;
  /** ISR seconds for cacheable public GETs (default 60). Ignored when `cookie` is set. */
  revalidate?: number | false;
  /** Cache tags for on-demand revalidation. */
  tags?: string[];
};

function init(o: Opts): RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } {
  if (o.cookie) return { cache: 'no-store' };
  return { next: { revalidate: o.revalidate ?? 60, ...(o.tags ? { tags: o.tags } : {}) } };
}

/** Typed openapi-fetch client for server components / route handlers. */
export function serverApi(o: Opts = {}) {
  return createApiClient({
    baseUrl: API_URL,
    headers: o.cookie ? { cookie: o.cookie } : undefined,
    fetch: (req) => fetch(req, init(o)),
  });
}

export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
    this.name = 'ApiHttpError';
  }
}

/**
 * Plain typed GET for endpoints the generated schema does not know yet.
 * Returns null on 404, throws ApiHttpError on other non-2xx.
 *   const p = await apiGet<ProductDetail>('/v1/public/products/foo');
 */
export async function apiGet<T>(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
  o: Opts = {},
): Promise<T | null> {
  const url = new URL(path, API_URL);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    ...init(o),
    headers: o.cookie ? { cookie: o.cookie } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiHttpError(res.status, await res.json().catch(() => null));
  return (await res.json()) as T;
}

/** Maintenance / announcement / contact. Fails open (shop stays up) if the API is unreachable. */
export async function getSite(): Promise<SiteStatus | null> {
  try {
    return await apiGet<SiteStatus>('/v1/public/site', undefined, { revalidate: 30 });
  } catch {
    return null;
  }
}
