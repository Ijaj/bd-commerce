import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { type Page, type SaleStatus, srApi } from './api';

export const srKeys = {
  all: ['sr'] as const,
  me: ['sr', 'me'] as const,
  shop: (id: string) => ['sr', 'shop', id] as const,
  sale: (id: string) => ['sr', 'sale', id] as const,
};

const nextPage = (last: Page<unknown>) =>
  last.page * last.pageSize < last.total ? last.page + 1 : undefined;

export const srMeQuery = queryOptions({ queryKey: srKeys.me, queryFn: srApi.me });

/** Server-side search + paging (the API supports q/page on shops). */
export const srShopsQuery = (q: string) =>
  infiniteQueryOptions({
    queryKey: ['sr', 'shops', q] as const,
    queryFn: ({ pageParam }) => srApi.shops({ q, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });

export const srShopQuery = (id: string) =>
  queryOptions({ queryKey: srKeys.shop(id), queryFn: () => srApi.shop(id) });

export const srSalesQuery = (status?: SaleStatus) =>
  infiniteQueryOptions({
    queryKey: ['sr', 'sales', status ?? 'all'] as const,
    queryFn: ({ pageParam }) => srApi.sales({ status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });

/** Just the newest few (home). */
export const srRecentSalesQuery = queryOptions({
  queryKey: ['sr', 'sales-recent'] as const,
  queryFn: () => srApi.sales({ pageSize: 3 }),
});

/** Count of sales waiting for approval (tab badge, home). */
export const srPendingQuery = queryOptions({
  queryKey: ['sr', 'sales-pending'] as const,
  queryFn: async () => (await srApi.sales({ status: 'submitted', pageSize: 1 })).total,
});

/** All of the shop's sales are not filterable server-side: newest 100, filtered on the client. */
export const srRecentHundredQuery = queryOptions({
  queryKey: ['sr', 'sales-100'] as const,
  queryFn: () => srApi.sales({ pageSize: 100 }),
});

export const srSaleQuery = (id: string) =>
  queryOptions({ queryKey: srKeys.sale(id), queryFn: () => srApi.sale(id) });

export const srCollectionsQuery = infiniteQueryOptions({
  queryKey: ['sr', 'collections'] as const,
  queryFn: ({ pageParam }) => srApi.collections(pageParam),
  initialPageParam: 1,
  getNextPageParam: nextPage,
});

export const srProductsQuery = (q: string) =>
  queryOptions({
    queryKey: ['sr', 'products', q] as const,
    queryFn: () => srApi.products(q),
    staleTime: 15_000,
  });
