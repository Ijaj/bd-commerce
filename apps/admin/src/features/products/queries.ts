import { api } from '~/api';
import { call } from './http';

export interface ProductListSearch {
  page: number;
  pageSize: number;
  q?: string;
  status?: 'draft' | 'active' | 'archived';
  categoryId?: string;
  brandId?: string;
  fulfillment?: 'stock' | 'dropship';
  isUpcoming?: boolean;
  isPreorder?: boolean;
  lowStock?: boolean;
  sort: 'createdAt' | 'title' | 'price';
  order: 'asc' | 'desc';
}

const flag = (v: boolean | undefined) => (v ? ('true' as const) : undefined);

export const productsKey = ['products'] as const;

export const productListQuery = (s: ProductListSearch) => ({
  queryKey: [...productsKey, 'list', s] as const,
  queryFn: () =>
    call(
      api.GET('/v1/admin/products', {
        params: {
          query: {
            page: s.page,
            pageSize: s.pageSize,
            q: s.q || undefined,
            status: s.status,
            categoryId: s.categoryId,
            brandId: s.brandId,
            fulfillment: s.fulfillment,
            isUpcoming: flag(s.isUpcoming),
            isPreorder: flag(s.isPreorder),
            lowStock: flag(s.lowStock),
            sort: s.sort,
            order: s.order,
          },
        },
      }),
    ),
});

export const productDetailQuery = (id: string) => ({
  queryKey: [...productsKey, 'detail', id] as const,
  queryFn: () => call(api.GET('/v1/admin/products/{id}', { params: { path: { id } } })),
});

export const categoriesQuery = {
  queryKey: ['categories'] as const,
  queryFn: () => call(api.GET('/v1/admin/categories')),
  staleTime: 60_000,
};

export const categoryDetailQuery = (id: string) => ({
  queryKey: ['categories', 'detail', id] as const,
  queryFn: () => call(api.GET('/v1/admin/categories/{id}', { params: { path: { id } } })),
  staleTime: 60_000,
});

export const brandsQuery = {
  queryKey: ['brands'] as const,
  queryFn: () => call(api.GET('/v1/admin/brands')),
  staleTime: 60_000,
};
