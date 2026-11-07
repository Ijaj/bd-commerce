import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];
export type AffiliateUpdate = S['AffiliateAdminUpdateDto'];
export type PayoutBody = S['AffiliatePayoutCreateDto'];

export interface AffiliateFilters {
  q?: string;
  status?: 'active' | 'suspended';
  page: number;
  pageSize: number;
}

export type CommissionStatus = 'pending' | 'approved' | 'reversed' | 'paid';

export const affiliatesApi = {
  list: (f: AffiliateFilters) => send(api.GET('/v1/admin/affiliates', { params: { query: f } })),
  detail: (id: string) => send(api.GET('/v1/admin/affiliates/{id}', { params: { path: { id } } })),
  update: (id: string, body: AffiliateUpdate) =>
    send(api.PATCH('/v1/admin/affiliates/{id}', { params: { path: { id } }, body })),
  commissions: (id: string, q: { status?: CommissionStatus; page: number; pageSize: number }) =>
    send(
      api.GET('/v1/admin/affiliates/{id}/commissions', {
        params: { path: { id }, query: q },
      }),
    ),
  due: () => send(api.GET('/v1/admin/affiliate-payouts/due')),
  payouts: (q: { affiliateId?: string; page: number; pageSize: number }) =>
    send(api.GET('/v1/admin/affiliate-payouts', { params: { query: q } })),
  pay: (id: string, body: PayoutBody) =>
    send(api.POST('/v1/admin/affiliates/{id}/payouts', { params: { path: { id } }, body })),
};
