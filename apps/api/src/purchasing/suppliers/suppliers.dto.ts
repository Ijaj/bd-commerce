import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MAX_P = 2_000_000_000;
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) =>
  text(max)
    .nullish()
    .transform((v) => (v ? v : null));

const shipMode = z.enum(['direct_to_customer', 'via_warehouse']);
const method = z.enum(['cash', 'bkash', 'nagad', 'bank']);
const ledgerType = z.enum(['receipt', 'payment', 'adjustment', 'dropship', 'reversal']);
const staffRef = z.object({ id: z.uuid(), name: z.string() });

// ---- requests -------------------------------------------------------------------------------

const supplierFields = {
  name: text(120).min(2),
  contactName: optText(120),
  phone: optText(30),
  email: z.email().max(160).nullish(),
  address: optText(500),
  pickupAddress: optText(500),
  shipMode,
  paymentTerms: optText(200),
  notes: optText(1000),
};

export class SupplierCreateDto extends createZodDto(z.object(supplierFields)) {}

export class SupplierUpdateDto extends createZodDto(
  z.object({
    name: supplierFields.name.optional(),
    contactName: z.string().trim().max(120).nullish(),
    phone: z.string().trim().max(30).nullish(),
    email: z.email().max(160).nullish(),
    address: z.string().trim().max(500).nullish(),
    pickupAddress: z.string().trim().max(500).nullish(),
    shipMode: shipMode.optional(),
    paymentTerms: z.string().trim().max(200).nullish(),
    notes: z.string().trim().max(1000).nullish(),
    isActive: z.boolean().optional(),
  }),
) {}

export class SupplierListQueryDto extends createZodDto(
  z.object({
    q: z.string().trim().max(100).optional(),
    active: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page,
    pageSize,
  }),
) {}

export class SupplierLinkListQueryDto extends createZodDto(
  z.object({ q: z.string().trim().max(100).optional(), page, pageSize }),
) {}

export class SupplierLinkUpsertDto extends createZodDto(
  z.object({
    supplierSku: z.string().trim().max(80).nullish(),
    costP: z.number().int().min(0).max(MAX_P).nullish(),
    leadTimeDays: z.number().int().min(0).max(365).nullish(),
    isDefault: z.boolean().optional(),
  }),
) {}

export class SupplierLedgerQueryDto extends createZodDto(z.object({ page, pageSize })) {}

export class SupplierPaymentDto extends createZodDto(
  z
    .object({
      amountP: z.number().int().min(1).max(MAX_P),
      method,
      reference: z.string().trim().max(120).optional(),
      note: z.string().trim().max(300).optional(),
    })
    .refine((v) => v.method === 'cash' || !!v.reference, {
      path: ['reference'],
      message: 'Reference is required for bank, bKash and Nagad payments',
    }),
) {}

export class SupplierAdjustmentDto extends createZodDto(
  z.object({
    amountP: z
      .number()
      .int()
      .min(-MAX_P)
      .max(MAX_P)
      .refine((v) => v !== 0, 'Amount cannot be zero'),
    note: z.string().trim().min(3).max(300),
  }),
) {}

export class SupplierLedgerReverseDto extends createZodDto(
  z.object({ note: z.string().trim().min(3).max(300) }),
) {}

// ---- responses ------------------------------------------------------------------------------

export class SupplierRowDto extends createZodDto(
  z.object({
    id: z.uuid(),
    name: z.string(),
    contactName: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    shipMode,
    paymentTerms: z.string().nullable(),
    isActive: z.boolean(),
    productCount: z.number().int(),
    openPoCount: z.number().int(),
    balanceP: z.number().int(),
  }),
) {}

export class SupplierListDto extends createZodDto(
  z.object({ items: z.array(SupplierRowDto.schema), total: z.number().int() }),
) {}

export class SupplierDetailDto extends createZodDto(
  SupplierRowDto.schema.extend({
    address: z.string().nullable(),
    pickupAddress: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.string(),
  }),
) {}

const linkItem = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productTitleEn: z.string(),
  sku: z.string(),
  options: z.array(z.object({ en: z.string(), bn: z.string().nullable() })),
  supplierSku: z.string().nullable(),
  costP: z.number().int().nullable(),
  leadTimeDays: z.number().int().nullable(),
  isDefault: z.boolean(),
  variantCostP: z.number().int().nullable(),
  fulfillment: z.enum(['stock', 'dropship']),
});

export class SupplierLinkDto extends createZodDto(linkItem) {}

export class SupplierLinkListDto extends createZodDto(
  z.object({ items: z.array(linkItem), total: z.number().int() }),
) {}

const ledgerEntry = z.object({
  id: z.uuid(),
  type: ledgerType,
  amountP: z.number().int(),
  balanceAfterP: z.number().int(),
  method: z.string().nullable(),
  reference: z.string().nullable(),
  note: z.string().nullable(),
  poReceiptId: z.uuid().nullable(),
  poId: z.uuid().nullable(),
  poNo: z.string().nullable(),
  reversesId: z.uuid().nullable(),
  reversedById: z.uuid().nullable(),
  recordedBy: staffRef,
  at: z.string(),
});

export class SupplierLedgerEntryDto extends createZodDto(
  ledgerEntry.extend({ balanceP: z.number().int() }),
) {}

export class SupplierLedgerListDto extends createZodDto(
  z.object({
    balanceP: z.number().int(),
    items: z.array(ledgerEntry),
    total: z.number().int(),
  }),
) {}

export class SupplierErrorDto extends createZodDto(
  z.object({ statusCode: z.number(), message: z.string(), code: z.string().optional() }),
) {}
