import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { deliveryApi } from './api';

export type Zone = components['schemas']['ZoneDto'];
/** Editable zone fields; sort and locations are managed elsewhere. */
export type ZoneBody = Omit<components['schemas']['CreateZoneDto'], 'sort' | 'locations'>;

export const zonesQuery = queryOptions({
  queryKey: ['delivery-zones', 'list'],
  queryFn: deliveryApi.list,
});

export const divisionsQuery = queryOptions({
  queryKey: ['geo', 'divisions'],
  queryFn: deliveryApi.divisions,
  staleTime: Number.POSITIVE_INFINITY,
});

export const districtsQuery = (divisionId: number) =>
  queryOptions({
    queryKey: ['geo', 'districts', divisionId],
    queryFn: () => deliveryApi.districts(divisionId),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const upazilasQuery = (districtId: number) =>
  queryOptions({
    queryKey: ['geo', 'upazilas', districtId],
    queryFn: () => deliveryApi.upazilas(districtId),
    staleTime: Number.POSITIVE_INFINITY,
  });

export function useInvalidateZones() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['delivery-zones'] });
}
