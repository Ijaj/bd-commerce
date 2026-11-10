import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];

export type PageRow = S['PageListDto']['items'][number];
export type PageFull = S['PageFullDto'];
export type PageCreateInput = S['PageCreateDto'];
export type PageUpdateInput = S['PageUpdateDto'];

const byId = (id: string) => ({ params: { path: { id } } });

export const pagesApi = {
  list: () => send(api.GET('/v1/admin/pages')),
  get: (id: string) => send(api.GET('/v1/admin/pages/{id}', byId(id))),
  create: (body: PageCreateInput) => send(api.POST('/v1/admin/pages', { body })),
  update: (id: string, body: PageUpdateInput) =>
    send(api.PATCH('/v1/admin/pages/{id}', { ...byId(id), body })),
  remove: (id: string) => send(api.DELETE('/v1/admin/pages/{id}', byId(id))),
};
