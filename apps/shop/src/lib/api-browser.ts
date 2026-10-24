'use client';
import { createApiClient } from '@bdc/api-client';

/** Same-origin client for client components; the bdc_cs cookie travels with `credentials`. */
export const browserApi = createApiClient({ baseUrl: '', credentials: 'include' });
