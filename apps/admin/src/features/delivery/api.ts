import { api } from '~/api';
import { send } from '~/features/categories/http';
import type { ZoneBody } from './queries';

export const deliveryApi = {
  list: () => send(api.GET('/v1/admin/delivery-zones')),
  create: (body: ZoneBody) =>
    send(api.POST('/v1/admin/delivery-zones', { body: { ...body, sort: 0 } })),
  update: (id: string, body: Partial<ZoneBody>) =>
    send(api.PATCH('/v1/admin/delivery-zones/{id}', { params: { path: { id } }, body })),
  remove: (id: string) =>
    send(api.DELETE('/v1/admin/delivery-zones/{id}', { params: { path: { id } } })),
  addLocation: (id: string, loc: LocationRef) =>
    send(
      api.POST('/v1/admin/delivery-zones/{id}/locations', {
        params: { path: { id } },
        body: { locations: [loc] },
      }),
    ),
  removeLocation: (id: string, locationId: string) =>
    send(
      api.DELETE('/v1/admin/delivery-zones/{id}/locations/{locationId}', {
        params: { path: { id, locationId } },
      }),
    ),
  divisions: () => send(api.GET('/v1/public/geo/divisions')),
  districts: (divisionId: number) =>
    send(api.GET('/v1/public/geo/districts', { params: { query: { divisionId } } })),
  upazilas: (districtId: number) =>
    send(api.GET('/v1/public/geo/upazilas', { params: { query: { districtId } } })),
};

/** Exactly one of the three ids (the API rejects anything else). */
export type LocationRef = { districtId: number } | { upazilaId: number };
