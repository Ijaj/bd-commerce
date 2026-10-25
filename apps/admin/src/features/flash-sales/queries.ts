import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type FlashFilters, flashApi } from './api';

type S = components['schemas'];
export type FlashRow = S['FlashSaleListDto']['items'][number];
export type FlashDetail = S['FlashSaleDetailDto'];
export type FlashItem = FlashDetail['items'][number];
export type FlashPhase = FlashRow['phase'];

export const flashListQuery = (f: FlashFilters) =>
  queryOptions({ queryKey: ['flash-sales', 'list', f], queryFn: () => flashApi.list(f) });

export const flashDetailQuery = (id: string) =>
  queryOptions({ queryKey: ['flash-sales', 'detail', id], queryFn: () => flashApi.detail(id) });

export const variantSearchQuery = (q: string) =>
  queryOptions({
    queryKey: ['flash-sales', 'variant-search', q],
    queryFn: () => flashApi.searchVariants(q),
    enabled: q.length >= 2,
  });

export function useInvalidateFlash() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['flash-sales'] });
}
