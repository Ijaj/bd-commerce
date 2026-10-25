import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];

export interface ReturnFilters {
  status?: S['ReturnAdminListDto']['items'][number]['status'];
  q?: string;
  page: number;
  pageSize: number;
}

export interface RefundFilters {
  status?: S['ReturnRefundListDto']['items'][number]['status'];
  page: number;
  pageSize: number;
}

const byId = (id: string) => ({ params: { path: { id } } });

export const returnsApi = {
  list: (query: ReturnFilters) => send(api.GET('/v1/admin/returns', { params: { query } })),
  detail: (id: string) => send(api.GET('/v1/admin/returns/{id}', byId(id))),
  create: (orderId: string, body: S['ReturnAdminCreateDto']) =>
    send(api.POST('/v1/admin/orders/{id}/returns', { params: { path: { id: orderId } }, body })),
  approve: (id: string, body: S['ReturnApproveDto']) =>
    send(api.POST('/v1/admin/returns/{id}/approve', { ...byId(id), body })),
  reject: (id: string, reason: string) =>
    send(api.POST('/v1/admin/returns/{id}/reject', { ...byId(id), body: { reason } })),
  pickupBooked: (id: string, note?: string) =>
    send(api.POST('/v1/admin/returns/{id}/pickup-booked', { ...byId(id), body: { note } })),
  receive: (id: string) => send(api.POST('/v1/admin/returns/{id}/receive', byId(id))),
  inspect: (id: string, body: S['ReturnInspectDto']) =>
    send(api.POST('/v1/admin/returns/{id}/inspect', { ...byId(id), body })),
  close: (id: string) => send(api.POST('/v1/admin/returns/{id}/close', byId(id))),
  refundReturn: (id: string, body: S['ReturnRefundDto']) =>
    send(api.POST('/v1/admin/returns/{id}/refund', { ...byId(id), body })),
  refundOrder: (orderId: string, body: S['ReturnOrderRefundDto']) =>
    send(api.POST('/v1/admin/orders/{id}/refund', { params: { path: { id: orderId } }, body })),
  refunds: (query: RefundFilters) => send(api.GET('/v1/admin/refunds', { params: { query } })),
  refund: (id: string) => send(api.GET('/v1/admin/refunds/{id}', byId(id))),
  approveRefund: (id: string) => send(api.POST('/v1/admin/refunds/{id}/approve', byId(id))),
  rejectRefund: (id: string, reason: string) =>
    send(api.POST('/v1/admin/refunds/{id}/reject', { ...byId(id), body: { reason } })),
  completeRefund: (id: string, providerRef?: string) =>
    send(api.POST('/v1/admin/refunds/{id}/complete', { ...byId(id), body: { providerRef } })),
  order: (id: string) => send(api.GET('/v1/admin/orders/{id}', byId(id))),
};
