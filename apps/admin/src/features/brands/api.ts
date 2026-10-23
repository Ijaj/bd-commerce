import { api } from '~/api';
import { send } from '~/features/categories/http';
import type { BrandInput } from './queries';

export const brandsApi = {
  list: () => send(api.GET('/v1/admin/brands')),
  create: (body: BrandInput & { nameEn: string }) => send(api.POST('/v1/admin/brands', { body })),
  update: (id: string, body: BrandInput) =>
    send(api.PATCH('/v1/admin/brands/{id}', { params: { path: { id } }, body })),
  remove: (id: string, force: boolean) =>
    send(
      api.DELETE('/v1/admin/brands/{id}', {
        params: { path: { id }, query: force ? { force: 'true' } : {} },
      }),
    ),
};
