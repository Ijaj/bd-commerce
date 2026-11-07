import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type AffiliateFilters, affiliatesApi, type CommissionStatus } from './api';

type S = components['schemas'];
export type AffiliateRow = S['AffiliateAdminListDto']['items'][number];
export type AffiliateDetail = S['AffiliateAdminDetailDto'];
export type CommissionRow = S['AffiliateAdminCommissionListDto']['items'][number];
export type DueRow = S['AffiliateDueListDto']['items'][number];
export type PayoutRow = S['AffiliatePayoutListDto']['items'][number];

export const affiliatesQuery = (f: AffiliateFilters) =>
  queryOptions({ queryKey: ['affiliates', 'list', f], queryFn: () => affiliatesApi.list(f) });

export const affiliateQuery = (id: string) =>
  queryOptions({ queryKey: ['affiliates', 'detail', id], queryFn: () => affiliatesApi.detail(id) });

export const commissionsQuery = (
  id: string,
  q: { status?: CommissionStatus; page: number; pageSize: number },
) =>
  queryOptions({
    queryKey: ['affiliates', 'commissions', id, q],
    queryFn: () => affiliatesApi.commissions(id, q),
  });

export const dueQuery = queryOptions({
  queryKey: ['affiliates', 'due'],
  queryFn: affiliatesApi.due,
});

export const payoutsQuery = (q: { affiliateId?: string; page: number; pageSize: number }) =>
  queryOptions({ queryKey: ['affiliates', 'payouts', q], queryFn: () => affiliatesApi.payouts(q) });

/** Paying out or editing a rate changes balances on list, detail, due list and history alike. */
export function useInvalidateAffiliates() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['affiliates'] });
}
