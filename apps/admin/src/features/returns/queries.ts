import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type RefundFilters, type ReturnFilters, returnsApi } from './api';

type S = components['schemas'];
export type ReturnRow = S['ReturnAdminListDto']['items'][number];
export type ReturnDetail = S['ReturnAdminDetailDto'];
export type ReturnStatus = ReturnRow['status'];
export type ReturnReason = S['ReturnAdminCreateDto']['items'][number]['reason'];
export type RefundRow = S['ReturnRefundListDto']['items'][number];
export type RefundDetail = S['ReturnRefundDetailDto'];
export type RefundStatus = RefundDetail['status'];
export type RefundMethod = RefundDetail['method'];
export type OrderDetail = S['OrdersAdminDetailDto'];

export const returnsQuery = (f: ReturnFilters) =>
  queryOptions({ queryKey: ['returns', 'list', f], queryFn: () => returnsApi.list(f) });

export const returnQuery = (id: string) =>
  queryOptions({ queryKey: ['returns', 'detail', id], queryFn: () => returnsApi.detail(id) });

export const refundsQuery = (f: RefundFilters) =>
  queryOptions({ queryKey: ['refunds', 'list', f], queryFn: () => returnsApi.refunds(f) });

export const refundQuery = (id: string) =>
  queryOptions({ queryKey: ['refunds', 'detail', id], queryFn: () => returnsApi.refund(id) });

/** Own key (not the orders feature's) so this section never depends on its cache shape. */
export const sectionOrderQuery = (id: string) =>
  queryOptions({ queryKey: ['returns', 'order', id], queryFn: () => returnsApi.order(id) });

/** Returns and refunds change order totals and stock, so refresh those too. */
export function useInvalidateReturns() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['returns', 'refunds', 'orders', 'inventory']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
