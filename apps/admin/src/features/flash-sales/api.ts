import type { components } from '@bdc/api-client';
import { api } from '~/api';
import { send } from '~/features/categories/http';

type S = components['schemas'];

export interface FlashFilters {
  phase?: S['FlashSaleListDto']['items'][number]['phase'];
  q?: string;
  page: number;
  pageSize: number;
}

const byId = (id: string) => ({ params: { path: { id } } });

export const flashApi = {
  list: (query: FlashFilters) => send(api.GET('/v1/admin/flash-sales', { params: { query } })),
  detail: (id: string) => send(api.GET('/v1/admin/flash-sales/{id}', byId(id))),
  create: (body: S['FlashSaleCreateDto']) => send(api.POST('/v1/admin/flash-sales', { body })),
  update: (id: string, body: S['FlashSaleUpdateDto']) =>
    send(api.PATCH('/v1/admin/flash-sales/{id}', { ...byId(id), body })),
  remove: (id: string) => send(api.DELETE('/v1/admin/flash-sales/{id}', byId(id))),
  replaceItems: (id: string, items: ItemBody[]) =>
    send(api.PUT('/v1/admin/flash-sales/{id}/items', { ...byId(id), body: { items } })),
  /** Variant lookup by SKU or product title. */
  searchVariants: (q: string) =>
    send(api.GET('/v1/admin/inventory', { params: { query: { q, page: 1, pageSize: 10 } } })),
  /** Regular prices are not in the inventory list, so the picker reads them from the product. */
  productPrices: (productId: string) =>
    send(api.GET('/v1/admin/products/{id}', { params: { path: { id: productId } } })),
};

export interface ItemBody {
  variantId: string;
  flashPriceP: number;
  qtyLimit: number;
  perCustomerLimit: number | null;
  sort: number;
}
