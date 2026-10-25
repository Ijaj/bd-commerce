import { queryOptions, useQueryClient } from '@tanstack/react-query';
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
