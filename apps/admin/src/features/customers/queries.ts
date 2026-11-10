import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type CustomerFilters, customersApi } from './api';

export type { CustomerDetail, CustomerNote, CustomerOrderRow, CustomerRow } from './api';

export const customersQuery = (f: CustomerFilters) =>
  queryOptions({ queryKey: ['customers', 'list', f], queryFn: () => customersApi.list(f) });

export const customerQuery = (id: string) =>
  queryOptions({ queryKey: ['customers', 'detail', id], queryFn: () => customersApi.detail(id) });

export const customerOrdersQuery = (id: string, q: { page: number; pageSize: number }) =>
  queryOptions({
    queryKey: ['customers', 'orders', id, q],
    queryFn: () => customersApi.orders(id, q),
  });

export const customerNotesQuery = (id: string) =>
  queryOptions({ queryKey: ['customers', 'notes', id], queryFn: () => customersApi.notes(id) });

/** Blocking changes the list badge and the profile alike. */
export function useInvalidateCustomers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['customers'] });
}
