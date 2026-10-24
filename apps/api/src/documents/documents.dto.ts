import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const iso = z.iso.datetime();

export class DocIssueInvoiceDto extends createZodDto(
  z.object({ reissue: z.boolean().optional() }),
) {}

const invoiceView = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  orderNo: z.string(),
  invoiceNo: z.string(),
  issuedAt: iso,
  vatRateBp: z.number().int(),
  vatTotalP: z.number().int(),
  grandTotalP: z.number().int(),
  bin: z.string().nullable(),
  /** Latest invoice of the order; older ones stay for reference after a reissue. */
  isCurrent: z.boolean(),
});

export class DocInvoiceDto extends createZodDto(invoiceView) {}
export class DocInvoiceListDto extends createZodDto(z.object({ items: z.array(invoiceView) })) {}

const party = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

export const invoiceSnapshot = z.object({
  lang: z.enum(['en', 'bn']),
  store: z.object({
    name: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    bin: z.string(),
    vatRateBp: z.number().int(),
  }),
  orderNo: z.string(),
  orderDate: iso,
  paymentMethod: z.string(),
  billTo: party,
  shipTo: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    placeText: z.string(),
  }),
  lines: z.array(
    z.object({
      titleSnapshot: z.string(),
      sku: z.string(),
      optionsText: z.string().nullable(),
      qty: z.number().int(),
      unitPriceP: z.number().int(),
      lineTotalP: z.number().int(),
    }),
  ),
  subtotalP: z.number().int(),
  autoDiscountP: z.number().int(),
  couponDiscountP: z.number().int(),
  deliveryChargeP: z.number().int(),
  deliveryDiscountP: z.number().int(),
  grandTotalP: z.number().int(),
  paidP: z.number().int(),
  codDueP: z.number().int(),
  /** Prices include VAT: netP + vatTotalP = grandTotalP. */
  vat: z.object({ rateBp: z.number().int(), totalP: z.number().int(), netP: z.number().int() }),
});

export class DocInvoiceDetailDto extends createZodDto(
  invoiceView.extend({ snapshot: invoiceSnapshot }),
) {}

export class DocLabelDto extends createZodDto(
  z.object({
    shipmentNo: z.string(),
    orderNo: z.string(),
    barcodeValue: z.string(),
    courier: z.object({ code: z.string(), name: z.string() }).nullable(),
    consignmentId: z.string().nullable(),
    store: z.object({ name: z.string(), phone: z.string() }),
    to: z.object({
      name: z.string(),
      phone: z.string(),
      address: z.string(),
      placeText: z.string(),
    }),
    codAmountP: z.number().int(),
    weightG: z.number().int().nullable(),
    itemsText: z.string(),
    note: z.string().nullable(),
    printedAt: iso,
  }),
) {}

export class DocLabelsRequestDto extends createZodDto(
  z.object({ ids: z.array(z.uuid()).min(1).max(50) }),
) {}
