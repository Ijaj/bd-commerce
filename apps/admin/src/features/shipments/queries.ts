import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { couriersQuery } from '~/features/orders/queries';
import { type ShipmentFilters, shipmentsApi } from './api';

export const shipmentsQuery = (f: ShipmentFilters) =>
  queryOptions({ queryKey: ['shipments', 'list', f], queryFn: () => shipmentsApi.list(f) });

export const orderShipmentsQuery = (orderId: string) =>
  queryOptions({
    queryKey: ['shipments', 'order', orderId],
    queryFn: () => shipmentsApi.forOrder(orderId),
  });

export const shipOrderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ['shipments', 'order-detail', orderId],
    queryFn: () => shipmentsApi.order(orderId),
  });

/** Shipment writes also move the order status and stock, so refresh orders too. */
export function useInvalidateShipments() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['shipments'] });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };
}

/** Select options from `GET /admin/couriers`; `activeOnly` for booking (the API refuses inactive ones). */
export function useCourierOptions(activeOnly: boolean) {
  const q = useQuery(couriersQuery);
  return (q.data ?? [])
    .filter((c) => !activeOnly || c.isActive)
    .map((c) => ({ value: c.code, label: c.name }));
}
