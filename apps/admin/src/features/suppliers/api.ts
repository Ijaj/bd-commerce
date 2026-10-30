import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];
export type SupplierCreate = S['SupplierCreateDto'];
export type SupplierUpdate = S['SupplierUpdateDto'];
export type LinkUpsert = S['SupplierLinkUpsertDto'];
export type PaymentBody = S['SupplierPaymentDto'];
export type AdjustmentBody = S['SupplierAdjustmentDto'];

export interface SupplierFilters {
  q?: string;
  active?: 'true' | 'false';
  page: number;
  pageSize: number;
}

export const suppliersApi = {
  list: (f: SupplierFilters) => send(api.GET('/v1/admin/suppliers', { params: { query: f } })),
  detail: (id: string) => send(api.GET('/v1/admin/suppliers/{id}', { params: { path: { id } } })),
  create: (body: SupplierCreate) => send(api.POST('/v1/admin/suppliers', { body })),
  update: (id: string, body: SupplierUpdate) =>
    send(api.PATCH('/v1/admin/suppliers/{id}', { params: { path: { id } }, body })),
  links: (id: string) =>
    send(api.GET('/v1/admin/suppliers/{id}/variants', { params: { path: { id } } })),
  upsertLink: (id: string, variantId: string, body: LinkUpsert) =>
    send(
      api.PUT('/v1/admin/suppliers/{id}/variants/{variantId}', {
        params: { path: { id, variantId } },
        body,
      }),
    ),
  removeLink: (id: string, variantId: string) =>
    send(
      api.DELETE('/v1/admin/suppliers/{id}/variants/{variantId}', {
        params: { path: { id, variantId } },
      }),
    ),
  variantOptions: (supplierId: string, q: string) =>
    send(
      api.GET('/v1/admin/purchase-orders/variant-options', {
        params: { query: { supplierId, ...(q ? { q } : {}), limit: 20 } },
      }),
    ),
  ledger: (id: string, page: number, pageSize: number) =>
    send(
      api.GET('/v1/admin/suppliers/{id}/ledger', {
        params: { path: { id }, query: { page, pageSize } },
      }),
    ),
  pay: (id: string, body: PaymentBody) =>
    send(api.POST('/v1/admin/suppliers/{id}/payments', { params: { path: { id } }, body })),
  adjust: (id: string, body: AdjustmentBody) =>
    send(api.POST('/v1/admin/suppliers/{id}/adjustments', { params: { path: { id } }, body })),
  reverse: (entryId: string, note: string) =>
    send(
      api.POST('/v1/admin/supplier-ledger/{entryId}/reverse', {
        params: { path: { entryId } },
        body: { note },
      }),
    ),
};
