import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { bulkApi } from './api';

type S = components['schemas'];
export type BulkBatch = S['BulkSaleListDto']['items'][number];
export type BulkDetail = S['BulkSaleDetailDto'];
export type BulkPreview = S['BulkSalePreviewResultDto'];
export type BulkBody = S['BulkSalePreviewDto'];

export const bulkListQuery = (page: number, pageSize: number) =>
  queryOptions({
    queryKey: ['bulk-sales', 'list', page, pageSize],
    queryFn: () => bulkApi.list({ page, pageSize }),
  });

export const bulkDetailQuery = (id: string, page: number, pageSize: number) =>
  queryOptions({
    queryKey: ['bulk-sales', 'detail', id, page, pageSize],
    queryFn: () => bulkApi.detail(id, { page, pageSize }),
    placeholderData: <T>(prev: T | undefined) => prev,
  });

export const productSearchQuery = (q: string) =>
  queryOptions({
    queryKey: ['bulk-sales', 'product-search', q],
    queryFn: () => bulkApi.products(q),
    enabled: q.length >= 2,
  });

/** Bulk sales change variant prices, so the catalog and storefront-facing lists go stale too. */
export function useInvalidateBulk() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['bulk-sales', 'products', 'flash-sales']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
