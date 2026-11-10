import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];
export type CustomerRow = S['CustomerAdminListDto']['items'][number];
export type CustomerDetail = S['CustomerAdminDetailDto'];
export type CustomerOrderRow = S['CustomerAdminOrderListDto']['items'][number];
export type CustomerNote = S['CustomerAdminNoteDto'];

export interface CustomerFilters {
  q?: string;
  blocked?: '0' | '1';
  hasOrders?: '0' | '1';
  page: number;
  pageSize: number;
}

export const customersApi = {
  list: (f: CustomerFilters) => send(api.GET('/v1/admin/customers', { params: { query: f } })),
  detail: (id: string) => send(api.GET('/v1/admin/customers/{id}', { params: { path: { id } } })),
  orders: (id: string, q: { page: number; pageSize: number }) =>
    send(api.GET('/v1/admin/customers/{id}/orders', { params: { path: { id }, query: q } })),
  notes: (id: string) =>
    send(api.GET('/v1/admin/customers/{id}/notes', { params: { path: { id } } })),
  addNote: (id: string, body: string) =>
    send(api.POST('/v1/admin/customers/{id}/notes', { params: { path: { id } }, body: { body } })),
  block: (id: string, reason: string) =>
    send(
      api.POST('/v1/admin/customers/{id}/block', { params: { path: { id } }, body: { reason } }),
    ),
  unblock: (id: string) =>
    send(api.POST('/v1/admin/customers/{id}/unblock', { params: { path: { id } } })),
};
