import type { components } from '@bdc/api-client';
import { api, unwrap } from '~/api';

type S = components['schemas'];

export type SrMe = S['SrPortalMeDto'];
export type SrProduct = S['SrPortalProductDto'];
export type SrShop = S['SrShopDto'];
export type SrShopDetail = S['SrShopDetailDto'];
export type SrLedgerRow = S['B2bLedgerRowDto'];
export type SrSaleSummary = S['SrSalePageDto']['items'][number];
export type SrSaleDetail = S['SrSaleDetailDto'];
export type NewSaleBody = S['SrCreateSaleDto'];
export type NewShopBody = S['SrCreateShopDto'];
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type SaleStatus = SrSaleSummary['status'];
export type LedgerType = SrLedgerRow['type'];
export type CollectionMethod = S['SrCreateCollectionDto']['method'];

export const PAGE_SIZE = 25;

export const srApi = {
  me: () => unwrap(api.GET('/v1/portal/sr/me')),
  products: (q: string) => unwrap(api.GET('/v1/portal/sr/products', { params: { query: { q } } })),
  shops: (p: { q?: string; page?: number; pageSize?: number }) =>
    unwrap(
      api.GET('/v1/portal/sr/shops', {
        params: {
          query: { q: p.q || undefined, page: p.page ?? 1, pageSize: p.pageSize ?? PAGE_SIZE },
        },
      }),
    ),
  shop: (id: string) => unwrap(api.GET('/v1/portal/sr/shops/{id}', { params: { path: { id } } })),
  createShop: (body: NewShopBody) => unwrap(api.POST('/v1/portal/sr/shops', { body })),
  sales: (p: { status?: SaleStatus; page?: number; pageSize?: number }) =>
    unwrap(
      api.GET('/v1/portal/sr/sales', {
        params: {
          query: { status: p.status, page: p.page ?? 1, pageSize: p.pageSize ?? PAGE_SIZE },
        },
      }),
    ),
  sale: (id: string) => unwrap(api.GET('/v1/portal/sr/sales/{id}', { params: { path: { id } } })),
  createSale: (body: NewSaleBody) => unwrap(api.POST('/v1/portal/sr/sales', { body })),
  cancelSale: (id: string) =>
    unwrap(api.POST('/v1/portal/sr/sales/{id}/cancel', { params: { path: { id } } })),
  collections: (page = 1) =>
    unwrap(
      api.GET('/v1/portal/sr/collections', { params: { query: { page, pageSize: PAGE_SIZE } } }),
    ),
  createCollection: (body: S['SrCreateCollectionDto']) =>
    unwrap(api.POST('/v1/portal/sr/collections', { body })),
  deliverSale: (id: string) =>
    unwrap(api.POST('/v1/portal/sr/sales/{id}/deliver', { params: { path: { id } } })),
  /** Public, unguessable share link for an approved/delivered sale (C38). */
  memoLink: (id: string) =>
    unwrap(api.POST('/v1/portal/sr/sales/{id}/memo-link', { params: { path: { id } } })),
  memoUrl: (id: string, lang: 'en' | 'bn' = 'en') => `/v1/portal/sr/sales/${id}/memo?lang=${lang}`,
};
