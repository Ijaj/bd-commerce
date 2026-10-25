import type { components } from '@bdc/api-client';
import type { OrderDetail } from '~/features/orders/types';

export type CustomerReturn = components['schemas']['ReturnCustomerDto'];
export type CustomerReturnList = components['schemas']['ReturnCustomerListDto'];
export type InvoiceDetail = components['schemas']['DocInvoiceDetailDto'];
export type ReturnStatus = CustomerReturn['status'];
export type ReturnReason = CustomerReturn['items'][number]['reason'];

/**
 * The customer order carries what the return form needs per line: the order-line id and how many
 * units can still be returned (0 once the window closed). Optional so the UI also compiles
 * against an api-client generated before the API exposed them.
 */
export type ReturnableItem = { orderItemId?: string; returnableQty?: number };
export type OrderForReturn = Omit<OrderDetail, 'items'> & {
  items: (OrderDetail['items'][number] & ReturnableItem)[];
};
