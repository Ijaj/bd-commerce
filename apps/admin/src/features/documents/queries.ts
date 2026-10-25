import type { components } from '@bdc/api-client';
import { queryOptions } from '@tanstack/react-query';
import { documentsApi } from './api';

export type InvoiceDetail = components['schemas']['DocInvoiceDetailDto'];
export type Label = components['schemas']['DocLabelDto'];

export const orderInvoicesQuery = (orderId: string) =>
  queryOptions({
    queryKey: ['documents', 'invoices', orderId],
    queryFn: () => documentsApi.invoices(orderId),
  });

export const invoiceQuery = (id: string) =>
  queryOptions({ queryKey: ['documents', 'invoice', id], queryFn: () => documentsApi.invoice(id) });

export const labelQuery = (id: string) =>
  queryOptions({ queryKey: ['documents', 'label', id], queryFn: () => documentsApi.label(id) });

export const labelsQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ['documents', 'labels', ids],
    queryFn: () => documentsApi.labels(ids),
  });
