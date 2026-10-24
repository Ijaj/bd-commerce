import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];

export type CarouselSlide = S['SlideDto'];
export type CarouselMedia = CarouselSlide['imageDesktop'];
export type CarouselLang = CarouselSlide['lang'];
export type CarouselSlideInput = S['CreateSlideDto'];

export const carouselApi = {
  list: () => send(api.GET('/v1/admin/carousel')),
  create: (body: CarouselSlideInput) => send(api.POST('/v1/admin/carousel', { body })),
  update: (id: string, body: S['UpdateSlideDto']) =>
    send(api.PATCH('/v1/admin/carousel/{id}', { params: { path: { id } }, body })),
  remove: (id: string) => send(api.DELETE('/v1/admin/carousel/{id}', { params: { path: { id } } })),
  reorder: (ids: string[]) => send(api.PUT('/v1/admin/carousel/order', { body: { ids } })),
};
