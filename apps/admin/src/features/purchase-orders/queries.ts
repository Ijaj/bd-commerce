import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type PoFilters, poApi } from './api';

export type PoStatus = components['schemas']['PoListDto']['items'][number]['status'];
export type PoList = components['schemas']['PoListDto'];
export type PoRow = PoList['items'][number];
export type PoDetail = components['schemas']['PoDetailDto'];
export type PoItem = PoDetail['items'][number];
export type PoVariantOption = components['schemas']['PoVariantOptionDto'];
export type PoPrint = components['schemas']['PoPrintDto'];
export type PoCreate = components['schemas']['PoCreateDto'];
export type PoPatch = components['schemas']['PoPatchDto'];
export type PoReceive = components['schemas']['PoReceiveDto'];

export const poListQuery = (f: PoFilters) =>
  queryOptions({
    queryKey: ['purchase-orders', 'list', f],
    queryFn: () => poApi.list(f),
    placeholderData: (prev) => prev,
  });

export const poQuery = (id: string) =>
  queryOptions({ queryKey: ['purchase-orders', 'detail', id], queryFn: () => poApi.detail(id) });

export const poPrintQuery = (id: string) =>
  queryOptions({ queryKey: ['purchase-orders', 'print', id], queryFn: () => poApi.print(id) });

export const variantOptionsQuery = (supplierId: string, q: string) =>
  queryOptions({
    queryKey: ['purchase-orders', 'variant-options', supplierId, q],
    queryFn: () => poApi.variantOptions(supplierId, q),
    enabled: !!supplierId,
    staleTime: 15_000,
  });

export const poSuppliersQuery = queryOptions({
  queryKey: ['purchase-orders', 'suppliers'],
  queryFn: () => poApi.suppliers(),
  staleTime: 30_000,
});

/** PO writes move stock and the supplier payable, so refresh those views too. */
export function useInvalidatePo() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
      qc.invalidateQueries({ queryKey: ['suppliers'] }),
      qc.invalidateQueries({ queryKey: ['inventory'] }),
    ]);
}
