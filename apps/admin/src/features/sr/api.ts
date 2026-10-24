import { api } from '~/api';
import { send } from '~/features/categories/http';

export interface SaleFilters {
  status?: 'submitted' | 'approved' | 'rejected' | 'delivered' | 'cancelled' | 'reversed';
  srId?: string;
  shopId?: string;
  /** YYYY-MM */
  month?: string;
  page: number;
  pageSize: number;
}

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
  reverse: (id: string, reason: string) =>
    send(
      api.POST('/v1/admin/sr/sales/{id}/reverse', { params: { path: { id } }, body: { reason } }),
    ),
  memoLink: (id: string) =>
    send(api.POST('/v1/admin/sr/sales/{id}/memo-link', { params: { path: { id } } })),
  srList: () => send(api.GET('/v1/admin/sr/list')),
  adjustments: (applied: 'true' | 'false', page: number, pageSize: number) =>
    send(
      api.GET('/v1/admin/sr/commission-adjustments', {
        params: { query: { applied, page, pageSize } },
      }),
    ),

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
