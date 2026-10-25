import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];

export const bulkApi = {
  list: (query: { page: number; pageSize: number }) =>
    send(api.GET('/v1/admin/bulk-sales', { params: { query } })),
  detail: (id: string, query: { page: number; pageSize: number }) =>
    send(api.GET('/v1/admin/bulk-sales/{id}', { params: { path: { id }, query } })),
  preview: (body: S['BulkSalePreviewDto']) =>
    send(api.POST('/v1/admin/bulk-sales/preview', { body })),
  apply: (body: S['BulkSaleCreateDto']) => send(api.POST('/v1/admin/bulk-sales', { body })),
  undo: (id: string) =>
    send(api.POST('/v1/admin/bulk-sales/{id}/undo', { params: { path: { id } } })),
  products: (q: string) =>
    send(
      api.GET('/v1/admin/products', {
        params: { query: { q, page: 1, pageSize: 10, sort: 'title', order: 'asc' } },
      }),
    ),
};
