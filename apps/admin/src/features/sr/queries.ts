import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type SaleFilters, srApi } from './api';

export type Sale = components['schemas']['SrSalePageDto']['items'][number];
export type SaleDetail = components['schemas']['SrSaleDetailDto'];
export type Profile = components['schemas']['SrProfileDto'];
export type Commission = components['schemas']['SrCommissionListDto']['items'][number];

export const salesQuery = (f: SaleFilters) =>
  queryOptions({ queryKey: ['sr', 'sales', f], queryFn: () => srApi.sales(f) });
export const saleQuery = (id: string) =>
  queryOptions({ queryKey: ['sr', 'sale', id], queryFn: () => srApi.sale(id) });
export const profilesQuery = queryOptions({
  queryKey: ['sr', 'profiles'],
  queryFn: srApi.profiles,
});
export const summaryQuery = (month: string) =>
  queryOptions({ queryKey: ['sr', 'summary', month], queryFn: () => srApi.summary(month) });
export const targetsQuery = (month: string) =>
  queryOptions({ queryKey: ['sr', 'targets', month], queryFn: () => srApi.targets(month) });
export const commissionsQuery = (month: string) =>
  queryOptions({ queryKey: ['sr', 'commissions', month], queryFn: () => srApi.commissions(month) });

/** A sale decision moves stock and shop dues, so refresh those caches too. */
export function useInvalidateSales() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['sr'] });
    qc.invalidateQueries({ queryKey: ['b2b'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
  };
}

export function useInvalidateSr() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['sr'] });
}
