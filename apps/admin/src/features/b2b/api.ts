import { api } from '~/api';
import { HttpError, send } from '~/features/categories/http';
import type { ShopUpdate } from './queries';

export interface ShopFilters {
  q?: string;
  status?: 'active' | 'blocked';
  isNew?: 'true' | 'false';
  hasDue?: 'true' | 'false';
  page: number;
  pageSize: number;
}

// TODO(lead): generated types after J (collection reject + 'rejected' status filter).
export type CollectionStatus = 'pending' | 'confirmed' | 'rejected' | 'all';

/** POST without generated types yet; same error shape as `send`. */
async function rawPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json as { message?: string } | null)?.message;
    throw new HttpError(
      typeof msg === 'string' ? msg : `Request failed (${res.status})`,
      res.status,
      json,
    );
  }
  return json as T;
}

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
        // 'rejected' is not in the generated union yet.
        params: { query: { status: status as 'all', page, pageSize } },
      }),
    ),
  confirmCollection: (id: string) =>
    send(api.POST('/v1/admin/b2b/ledger/{id}/confirm', { params: { path: { id } } })),
  // TODO(lead): generated types after J. Path assumed: POST /v1/admin/b2b/ledger/:id/reject {reason}.
  rejectCollection: (id: string, reason: string) =>
    rawPost(`/v1/admin/b2b/ledger/${id}/reject`, { reason }),
};
