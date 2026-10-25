import { api } from '~/api';
import { send } from '~/features/categories/http';

export const documentsApi = {
  invoices: (orderId: string) =>
    send(api.GET('/v1/admin/orders/{id}/invoices', { params: { path: { id: orderId } } })),
  invoice: (id: string) => send(api.GET('/v1/admin/invoices/{id}', { params: { path: { id } } })),
  issue: (orderId: string, reissue: boolean) =>
    send(
      api.POST('/v1/admin/orders/{id}/invoice', {
        params: { path: { id: orderId } },
        body: { reissue: reissue || undefined },
      }),
    ),
  label: (id: string) =>
    send(api.GET('/v1/admin/shipments/{id}/label', { params: { path: { id } } })),
  labels: (ids: string[]) => send(api.POST('/v1/admin/shipments/labels', { body: { ids } })),
};
