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
  | 'cancelled';
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
  page: number;
  pageSize: number;
}

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
};
