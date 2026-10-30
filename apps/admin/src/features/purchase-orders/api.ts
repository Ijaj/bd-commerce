import { api } from '~/api';
import { send } from '~/features/categories/http';
import type { PoCreate, PoPatch, PoReceive, PoStatus } from './queries';

export interface PoFilters {
  status?: PoStatus;
  supplierId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export const poApi = {
  list: (f: PoFilters) => send(api.GET('/v1/admin/purchase-orders', { params: { query: f } })),
  detail: (id: string) =>
    send(api.GET('/v1/admin/purchase-orders/{id}', { params: { path: { id } } })),
  print: (id: string) =>
    send(api.GET('/v1/admin/purchase-orders/{id}/print', { params: { path: { id } } })),
  variantOptions: (supplierId: string, q: string) =>
    send(
      api.GET('/v1/admin/purchase-orders/variant-options', {
        params: { query: { supplierId, ...(q ? { q } : {}), limit: 20 } },
      }),
    ),
  suppliers: () =>
    send(api.GET('/v1/admin/suppliers', { params: { query: { page: 1, pageSize: 100 } } })),
  create: (body: PoCreate) => send(api.POST('/v1/admin/purchase-orders', { body })),
  patch: (id: string, body: PoPatch) =>
    send(api.PATCH('/v1/admin/purchase-orders/{id}', { params: { path: { id } }, body })),
  send: (id: string) =>
    send(api.POST('/v1/admin/purchase-orders/{id}/send', { params: { path: { id } } })),
  receive: (id: string, body: PoReceive) =>
    send(api.POST('/v1/admin/purchase-orders/{id}/receive', { params: { path: { id } }, body })),
  close: (id: string, reason: string) =>
    send(
      api.POST('/v1/admin/purchase-orders/{id}/close', {
        params: { path: { id } },
        body: { reason },
      }),
    ),
  cancel: (id: string, reason?: string) =>
    send(
      api.POST('/v1/admin/purchase-orders/{id}/cancel', {
        params: { path: { id } },
        body: reason ? { reason } : {},
      }),
    ),
};
