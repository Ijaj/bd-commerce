import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './schema';

export type { components, paths } from './schema';

/** Typed fetch client for the bd-commerce API. Types come from openapi.json (`pnpm api:gen`). */
export function createApiClient(options: ClientOptions) {
  return createClient<paths>(options);
}

export type ApiClient = ReturnType<typeof createApiClient>;
