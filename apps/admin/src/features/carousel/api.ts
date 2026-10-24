import { api } from '~/api';
import { send } from '~/features/categories/http';

// TODO(lead): use generated types after api:gen. Until then the routes are not in the
// generated schema, so the client is loosely typed here and the shapes are local.
// Same client as the rest of the admin (cookie auth, 401 handler, error bodies).

export type CarouselLang = 'all' | 'en' | 'bn';

export interface CarouselMedia {
  id: string;
  url: string;
  thumbUrl: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  imageDesktop: CarouselMedia;
  imageMobile: CarouselMedia | null;
  linkUrl: string | null;
  /** ISO timestamps; null = no bound on that side. */
  startsAt: string | null;
  endsAt: string | null;
  sort: number;
  isActive: boolean;
  lang: CarouselLang;
}

export interface CarouselSlideInput {
  title: string;
  imageDesktopMediaId: string;
  imageMobileMediaId: string | null;
  linkUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  lang: CarouselLang;
}

type Init = { params?: { path?: Record<string, string> }; body?: unknown };
type Method = <T = unknown>(
  path: string,
  init?: Init,
) => Promise<{ data?: T; error?: unknown; response: Response }>;
interface LooseClient {
  GET: Method;
  POST: Method;
  PATCH: Method;
  PUT: Method;
  DELETE: Method;
}
const client = api as unknown as LooseClient;

export const carouselApi = {
  list: () => send(client.GET<CarouselSlide[]>('/v1/admin/carousel')),
  create: (body: CarouselSlideInput) =>
    send(client.POST<CarouselSlide>('/v1/admin/carousel', { body })),
  update: (id: string, body: CarouselSlideInput) =>
    send(
      client.PATCH<CarouselSlide>('/v1/admin/carousel/{id}', { params: { path: { id } }, body }),
    ),
  remove: (id: string) =>
    send(client.DELETE<unknown>('/v1/admin/carousel/{id}', { params: { path: { id } } })),
  reorder: (ids: string[]) =>
    send(client.PUT<unknown>('/v1/admin/carousel/order', { body: { ids } })),
};
