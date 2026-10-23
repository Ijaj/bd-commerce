import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { brandsApi } from './api';

export type Brand = components['schemas']['BrandDto'];
export type BrandInput = components['schemas']['UpdateBrandDto'];

export const brandsQuery = queryOptions({
  queryKey: ['brands', 'list'],
  queryFn: brandsApi.list,
});

/** Brands also feed product forms; products caches that embed brand names go stale with them. */
export function useInvalidateBrands() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['brands'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  };
}
