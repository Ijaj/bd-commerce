import { api } from '~/api';
import { send } from '~/features/categories/http';
import type { ShopUpdate } from './queries';

export interface ShopFilters {
  q?: string;
  status?: 'active' | 'blocked';
  isNew?: 'true' | 'false';
  hasDue?: 'true' | 'false';
  page: number;
  pageSize: number;
}

export type CollectionStatus = 'pending' | 'confirmed' | 'rejected' | 'all';

export const b2bApi = {
  shops: (f: ShopFilters) => send(api.GET('/v1/admin/b2b/shops', { params: { query: f } })),
  shop: (id: string) => send(api.GET('/v1/admin/b2b/shops/{id}', { params: { path: { id } } })),
  ledger: (id: string, page: number, pageSize: number) =>
    send(
      api.GET('/v1/admin/b2b/shops/{id}/ledger', {
        params: { path: { id }, query: { page, pageSize } },
      }),
    ),
  updateShop: (id: string, body: ShopUpdate) =>
    send(api.PATCH('/v1/admin/b2b/shops/{id}', { params: { path: { id } }, body })),
  adjust: (id: string, body: { amountP: number; note: string }) =>
    send(api.POST('/v1/admin/b2b/shops/{id}/adjust', { params: { path: { id } }, body })),
  collections: (status: CollectionStatus, page: number, pageSize: number) =>
    send(
      api.GET('/v1/admin/b2b/collections', {
        params: { query: { status, page, pageSize } },
      }),
    ),
  confirmCollection: (id: string) =>
    send(api.POST('/v1/admin/b2b/ledger/{id}/confirm', { params: { path: { id } } })),
  rejectCollection: (id: string, reason: string) =>
    send(
      api.POST('/v1/admin/b2b/ledger/{id}/reject', { params: { path: { id } }, body: { reason } }),
    ),
  dues: (asOf?: string) =>
    send(api.GET('/v1/admin/b2b/dues', { params: { query: asOf ? { asOf } : {} } })),
};
