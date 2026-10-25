import { api } from '~/api';
import { send } from '~/features/categories/http';
import type { Shipment, ShipmentStatus } from './logic';

export interface ShipmentFilters {
  status?: ShipmentStatus;
  courier?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export const shipmentsApi = {
  list: (f: ShipmentFilters) =>
    send(api.GET('/v1/admin/shipments', { params: { query: { ...f, sort: 'newest' } } })),
  forOrder: (orderId: string) =>
    send(api.GET('/v1/admin/orders/{id}/shipments', { params: { path: { id: orderId } } })),
  order: (orderId: string) =>
    send(api.GET('/v1/admin/orders/{id}', { params: { path: { id: orderId } } })),
  create: (orderId: string, items: { orderItemId: string; qty: number }[], note?: string) =>
    send(
      api.POST('/v1/admin/orders/{id}/shipments', {
        params: { path: { id: orderId } },
        body: { items, note: note || undefined },
      }),
    ),
  book: (id: string, courierCode: string) =>
    send(
      api.POST('/v1/admin/shipments/{id}/book', {
        params: { path: { id } },
        body: { courierCode },
      }),
    ),
  rebook: (id: string, body: { courierCode?: string; manualCancel?: boolean }) =>
    send(api.POST('/v1/admin/shipments/{id}/rebook', { params: { path: { id } }, body })),
  cancel: (id: string, manualCancel: boolean) =>
    send(
      api.POST('/v1/admin/shipments/{id}/cancel', {
        params: { path: { id } },
        body: { manualCancel: manualCancel || undefined },
      }),
    ),
  handover: (id: string) =>
    send(api.POST('/v1/admin/shipments/{id}/handover', { params: { path: { id } } })),
  sync: (id: string) =>
    send(api.POST('/v1/admin/shipments/{id}/sync', { params: { path: { id } } })),
};

export type { Shipment };
