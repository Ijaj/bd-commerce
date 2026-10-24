import { queryOptions } from '@tanstack/react-query';
import { srApi } from './api';

export const srKeys = {
  all: ['sr'] as const,
  me: ['sr', 'me'] as const,
  shops: ['sr', 'shops'] as const,
  shop: (id: string) => ['sr', 'shop', id] as const,
  sales: ['sr', 'sales'] as const,
  sale: (id: string) => ['sr', 'sale', id] as const,
  collections: ['sr', 'collections'] as const,
};

export const srMeQuery = queryOptions({ queryKey: srKeys.me, queryFn: srApi.me });
export const srShopsQuery = queryOptions({
  queryKey: srKeys.shops,
  queryFn: async () => (await srApi.shops()).items,
});
export const srShopQuery = (id: string) =>
  queryOptions({ queryKey: srKeys.shop(id), queryFn: () => srApi.shop(id) });
export const srSalesQuery = queryOptions({
  queryKey: srKeys.sales,
  queryFn: async () => (await srApi.sales()).items,
});
export const srSaleQuery = (id: string) =>
  queryOptions({ queryKey: srKeys.sale(id), queryFn: () => srApi.sale(id) });
export const srCollectionsQuery = queryOptions({
  queryKey: srKeys.collections,
  queryFn: async () => (await srApi.collections()).items,
});
export const srProductsQuery = (q: string) =>
  queryOptions({
    queryKey: ['sr', 'products', q] as const,
    queryFn: () => srApi.products(q),
    staleTime: 15_000,
  });
