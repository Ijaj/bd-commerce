import { api, unwrap } from '~/api';
import type { InventorySearch } from './search';
import { DEFAULT_PAGE_SIZE } from './search';

export const inventoryKey = ['inventory'] as const;

export function inventoryListQuery(s: InventorySearch) {
  const pageSize = s.size ?? DEFAULT_PAGE_SIZE;
  const page = s.page ?? 1;
  return {
    queryKey: [...inventoryKey, 'list', s.q, s.lowStock, s.category, s.fulfillment, page, pageSize],
    queryFn: () =>
      unwrap(
        api.GET('/v1/admin/inventory', {
          params: {
            query: {
              q: s.q,
              lowStock: s.lowStock ? 'true' : undefined,
              categoryId: s.category,
              fulfillment: s.fulfillment,
              page,
              pageSize,
            },
          },
        }),
      ),
    placeholderData: <T>(prev: T | undefined) => prev,
  };
}

export const lowStockCountQuery = {
  queryKey: [...inventoryKey, 'low-stock-count'],
  queryFn: () => unwrap(api.GET('/v1/admin/inventory/low-stock-count')),
};

export function movementsQuery(variantId: string, page: number, pageSize: number) {
  return {
    queryKey: [...inventoryKey, 'movements', variantId, page, pageSize],
    queryFn: () =>
      unwrap(
        api.GET('/v1/admin/inventory/{variantId}/movements', {
          params: { path: { variantId }, query: { page, pageSize } },
        }),
      ),
    placeholderData: <T>(prev: T | undefined) => prev,
  };
}

export const categoriesQuery = {
  queryKey: ['categories'],
  queryFn: () => unwrap(api.GET('/v1/admin/categories')),
};

export type InventoryRow = Awaited<
  ReturnType<ReturnType<typeof inventoryListQuery>['queryFn']>
>['items'][number];
export type MovementRow = Awaited<
  ReturnType<ReturnType<typeof movementsQuery>['queryFn']>
>['items'][number];
