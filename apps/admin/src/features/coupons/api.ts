import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';
import { downloadFile } from '~/features/import-export/api';

type S = components['schemas'];

export interface CouponFilters {
  kind?: S['CouponListDto']['items'][number]['kind'];
  status?: S['CouponListDto']['items'][number]['status'];
  type?: S['CouponListDto']['items'][number]['type'];
  phase?: S['CouponListDto']['items'][number]['phase'];
  q?: string;
  page: number;
  limit: number;
}

export interface CodeFilters {
  status?: 'used' | 'unused';
  q?: string;
  page: number;
  limit: number;
}

export type CouponCreateBody = S['CouponCreateDto'];
export type CouponUpdateBody = S['CouponUpdateDto'];

const byId = (id: string) => ({ params: { path: { id } } });

export const couponsApi = {
  list: (query: CouponFilters) => send(api.GET('/v1/admin/coupons', { params: { query } })),
  detail: (id: string) => send(api.GET('/v1/admin/coupons/{id}', byId(id))),
  create: (body: CouponCreateBody) => send(api.POST('/v1/admin/coupons', { body })),
  update: (id: string, body: CouponUpdateBody) =>
    send(api.PATCH('/v1/admin/coupons/{id}', { ...byId(id), body })),
  activate: (id: string) => send(api.POST('/v1/admin/coupons/{id}/activate', byId(id))),
  pause: (id: string) => send(api.POST('/v1/admin/coupons/{id}/pause', byId(id))),
  duplicate: (id: string) => send(api.POST('/v1/admin/coupons/{id}/duplicate', byId(id))),
  remove: (id: string) => send(api.DELETE('/v1/admin/coupons/{id}', byId(id))),
  lookup: (q: string) =>
    send(api.GET('/v1/admin/coupons/customer-lookup', { params: { query: { q } } })),
  generate: (id: string, body: S['CouponCodesGenerateDto']) =>
    send(api.POST('/v1/admin/coupons/{id}/codes/generate', { ...byId(id), body })),
  codes: (id: string, query: CodeFilters) =>
    send(api.GET('/v1/admin/coupons/{id}/codes', { params: { path: { id }, query } })),
  assign: (id: string, body: S['CouponCodesAssignDto']) =>
    send(api.POST('/v1/admin/coupons/{id}/codes/assign', { ...byId(id), body })),
  exportCodes: (id: string) =>
    downloadFile(`/v1/admin/coupons/${id}/codes/export`, {}, 'coupon-codes.csv'),
  report: (id: string, range: { from?: string; to?: string }) =>
    send(api.GET('/v1/admin/coupons/{id}/report', { params: { path: { id }, query: range } })),
};
