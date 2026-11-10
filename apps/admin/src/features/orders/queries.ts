import type { components } from '@bdc/api-client';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCan } from '~/lib/perm';
import { type OrderFilters, ordersApi } from './api';

export type OrderListItem = components['schemas']['OrdersAdminListDto']['items'][number];
export type OrderDetail = components['schemas']['OrdersAdminDetailDto'];
export type EditPreview = components['schemas']['OrderEditPreviewDto'];
export type EditRecord = components['schemas']['OrderEditHistoryDto']['items'][number];

export const ordersQuery = (f: OrderFilters) =>
  queryOptions({ queryKey: ['orders', 'list', f], queryFn: () => ordersApi.list(f) });

export const orderQuery = (id: string) =>
  queryOptions({ queryKey: ['orders', 'detail', id], queryFn: () => ordersApi.detail(id) });

export const couriersQuery = queryOptions({
  queryKey: ['orders', 'couriers'],
  queryFn: ordersApi.couriers,
  staleTime: 5 * 60_000,
});

export const editsQuery = (id: string) =>
  queryOptions({ queryKey: ['orders', 'edits', id], queryFn: () => ordersApi.edits(id) });

export const callQueueQuery = (status: 'pending' | 'done', page: number, pageSize: number) =>
  queryOptions({
    queryKey: ['orders', 'call-queue', status, page, pageSize],
    queryFn: () => ordersApi.callQueue(status, page, pageSize),
  });

/** Pending call-queue size for the sidebar badge; undefined until loaded or without orders.call. */
export function useCallQueueCount(): number | undefined {
  const enabled = useCan('orders.call');
  const { data } = useQuery({
    queryKey: ['orders', 'call-count'],
    queryFn: ordersApi.callCount,
    enabled,
    refetchInterval: 60_000,
  });
  return enabled ? data?.pending : undefined;
}

/** Any order write can change lists, the detail, the queue and its badge. */
export function useInvalidateOrders() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['orders'] });
}
