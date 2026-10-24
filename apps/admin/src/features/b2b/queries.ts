import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { b2bApi, type CollectionStatus, type ShopFilters } from './api';

export type Shop = components['schemas']['SrShopDto'];
export type ShopUpdate = components['schemas']['B2bUpdateShopDto'];
export type LedgerRow = components['schemas']['B2bLedgerRowDto'];

export const shopsQuery = (f: ShopFilters) =>
  queryOptions({ queryKey: ['b2b', 'shops', f], queryFn: () => b2bApi.shops(f) });

export const shopQuery = (id: string) =>
  queryOptions({ queryKey: ['b2b', 'shop', id], queryFn: () => b2bApi.shop(id) });

export const ledgerQuery = (id: string, page: number, pageSize: number) =>
  queryOptions({
    queryKey: ['b2b', 'ledger', id, page, pageSize],
    queryFn: () => b2bApi.ledger(id, page, pageSize),
  });

export const collectionsQuery = (status: CollectionStatus, page: number, pageSize: number) =>
  queryOptions({
    queryKey: ['b2b', 'collections', status, page, pageSize],
    queryFn: () => b2bApi.collections(status, page, pageSize),
  });

/** Ledger writes change shop dues, the collection queue and the SR summaries. */
export function useInvalidateB2b() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['b2b'] });
    qc.invalidateQueries({ queryKey: ['sr'] });
  };
}
