import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type CodeFilters, type CouponFilters, couponsApi } from './api';

export const couponsQuery = (f: CouponFilters) =>
  queryOptions({ queryKey: ['coupons', 'list', f], queryFn: () => couponsApi.list(f) });

export const couponQuery = (id: string) =>
  queryOptions({ queryKey: ['coupons', 'detail', id], queryFn: () => couponsApi.detail(id) });

export const codesQuery = (id: string, f: CodeFilters) =>
  queryOptions({ queryKey: ['coupons', 'codes', id, f], queryFn: () => couponsApi.codes(id, f) });

export const reportQuery = (id: string, range: { from?: string; to?: string }) =>
  queryOptions({
    queryKey: ['coupons', 'report', id, range],
    queryFn: () => couponsApi.report(id, range),
  });

export const customerLookupQuery = (q: string) =>
  queryOptions({
    queryKey: ['coupons', 'customer-lookup', q],
    queryFn: () => couponsApi.lookup(q),
    staleTime: 30_000,
  });

export function useInvalidateCoupons() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['coupons'] });
}
