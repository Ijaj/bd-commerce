import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

export type OrderStatus =
  | 'pending_payment'
  | 'processing'
  | 'on_hold'
  | 'partially_shipped'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'delivery_failed'
  | 'failed';
export type PaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed';
export type CallStatus = 'not_needed' | 'pending' | 'confirmed' | 'unreachable' | 'cancelled';
export type CallOutcome = 'confirmed' | 'unreachable' | 'cancelled';

export interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  call?: CallStatus;
  risk?: '0' | '1';
  q?: string;
  from?: string;
  to?: string;
  courierId?: string;
  zoneId?: string;
  paymentMethod?: string;
  source?: 'guest' | 'customer';
  page: number;
  pageSize: number;
}

export type EditInput = components['schemas']['OrderEditInputDto'];

export const ordersApi = {
  list: (query: OrderFilters) => send(api.GET('/v1/admin/orders', { params: { query } })),
  detail: (id: string) => send(api.GET('/v1/admin/orders/{id}', { params: { path: { id } } })),
  hold: (id: string, reason: string) =>
    send(api.POST('/v1/admin/orders/{id}/hold', { params: { path: { id } }, body: { reason } })),
  resume: (id: string) =>
    send(api.POST('/v1/admin/orders/{id}/resume', { params: { path: { id } } })),
  cancel: (id: string, reason: string) =>
    send(api.POST('/v1/admin/orders/{id}/cancel', { params: { path: { id } }, body: { reason } })),
  call: (id: string, outcome: CallOutcome, note?: string) =>
    send(
      api.POST('/v1/admin/orders/{id}/call', {
        params: { path: { id } },
        body: { outcome, ...(note ? { note } : {}) },
      }),
    ),
  callQueue: (status: 'pending' | 'done', page: number, pageSize: number) =>
    send(api.GET('/v1/admin/call-queue', { params: { query: { status, page, pageSize } } })),
  callCount: () => send(api.GET('/v1/admin/call-queue/count')),
  couriers: () => send(api.GET('/v1/admin/couriers')),
  editPreview: (id: string, body: EditInput) =>
    send(api.POST('/v1/admin/orders/{id}/edit/preview', { params: { path: { id } }, body })),
  edit: (id: string, body: EditInput) =>
    send(api.POST('/v1/admin/orders/{id}/edit', { params: { path: { id } }, body })),
  edits: (id: string) => send(api.GET('/v1/admin/orders/{id}/edits', { params: { path: { id } } })),
  /** Variant lookup by SKU or product title (the inventory list is the only variant-level search). */
  searchVariants: (q: string) =>
    send(api.GET('/v1/admin/inventory', { params: { query: { q, page: 1, pageSize: 10 } } })),
  districts: () => send(api.GET('/v1/public/geo/districts', { params: { query: {} } })),
  upazilas: (districtId: number) =>
    send(api.GET('/v1/public/geo/upazilas', { params: { query: { districtId } } })),
};
