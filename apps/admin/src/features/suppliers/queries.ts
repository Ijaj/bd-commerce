import type { components } from '@bdc/api-client';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { type SupplierFilters, suppliersApi } from './api';

export type Supplier = components['schemas']['SupplierDetailDto'];
export type SupplierRow = components['schemas']['SupplierListDto']['items'][number];
export type SupplierLink = components['schemas']['SupplierLinkDto'];
export type LedgerEntry = components['schemas']['SupplierLedgerListDto']['items'][number];
export type VariantOption = components['schemas']['PoVariantOptionDto'];

export const suppliersQuery = (f: SupplierFilters) =>
  queryOptions({ queryKey: ['suppliers', 'list', f], queryFn: () => suppliersApi.list(f) });

export const supplierQuery = (id: string) =>
  queryOptions({ queryKey: ['suppliers', 'detail', id], queryFn: () => suppliersApi.detail(id) });

export const linksQuery = (id: string) =>
  queryOptions({ queryKey: ['suppliers', 'links', id], queryFn: () => suppliersApi.links(id) });

export const ledgerQuery = (id: string, page: number, pageSize: number) =>
  queryOptions({
    queryKey: ['suppliers', 'ledger', id, page, pageSize],
    queryFn: () => suppliersApi.ledger(id, page, pageSize),
  });

export const variantOptionsQuery = (supplierId: string, q: string) =>
  queryOptions({
    queryKey: ['suppliers', 'variant-options', supplierId, q],
    queryFn: () => suppliersApi.variantOptions(supplierId, q),
  });

/** Any supplier write can change the list counts, balance and PO screens, so refresh the lot. */
export function useInvalidateSuppliers() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['suppliers'] });
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  };
}
