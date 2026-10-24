import { api } from '~/api';
import { HttpError, send } from '~/features/categories/http';

export interface SaleFilters {
  status?: 'submitted' | 'approved' | 'rejected' | 'delivered' | 'cancelled';
  srId?: string;
  shopId?: string;
  page: number;
  pageSize: number;
}

async function postRaw<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
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

// TODO(lead): generated types after J (memo-link returns { token, url }).
const reverseRaw = (id: string, reason: string) =>
  postRaw(`/v1/admin/sr/sales/${id}/reverse`, { reason });
const memoLinkRaw = (id: string) =>
  postRaw<{ token: string; url: string }>(`/v1/admin/sr/sales/${id}/memo-link`);

export const memoUrl = (id: string, lang: 'en' | 'bn' = 'en') =>
  `/v1/admin/sr/sales/${id}/memo?lang=${lang}`;

export const srApi = {
  sales: (f: SaleFilters) => send(api.GET('/v1/admin/sr/sales', { params: { query: f } })),
  sale: (id: string) => send(api.GET('/v1/admin/sr/sales/{id}', { params: { path: { id } } })),
  approve: (id: string) =>
    send(api.POST('/v1/admin/sr/sales/{id}/approve', { params: { path: { id } } })),
  reject: (id: string, reason: string) =>
    send(
      api.POST('/v1/admin/sr/sales/{id}/reject', { params: { path: { id } }, body: { reason } }),
    ),
  deliver: (id: string) =>
    send(api.POST('/v1/admin/sr/sales/{id}/deliver', { params: { path: { id } } })),
  reverse: reverseRaw,
  memoLink: memoLinkRaw,

  profiles: () => send(api.GET('/v1/admin/sr/profiles')),
  updateProfile: (staffId: string, body: { area?: string | null; commissionBp?: number | null }) =>
    send(api.PUT('/v1/admin/sr/profiles/{staffId}', { params: { path: { staffId } }, body })),
  summary: (month: string) =>
    send(api.GET('/v1/admin/sr/summary', { params: { query: { month } } })),
  targets: (month: string) =>
    send(api.GET('/v1/admin/sr/targets', { params: { query: { month } } })),
  setTargets: (month: string, targets: { srStaffId: string; targetP: number }[]) =>
    send(api.PUT('/v1/admin/sr/targets', { params: { query: { month } }, body: { targets } })),
  commissions: (month: string) =>
    send(api.GET('/v1/admin/sr/commissions', { params: { query: { month } } })),
  computeCommissions: (month: string) =>
    send(api.POST('/v1/admin/sr/commissions/compute', { params: { query: { month } } })),
  approveCommission: (id: string) =>
    send(api.POST('/v1/admin/sr/commissions/{id}/approve', { params: { path: { id } } })),
  payCommission: (id: string) =>
    send(api.POST('/v1/admin/sr/commissions/{id}/paid', { params: { path: { id } } })),
};
