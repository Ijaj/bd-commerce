import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const poStatus = z.enum(['draft', 'sent', 'partially_received', 'received', 'closed', 'cancelled']);
const page = z.coerce.number().int().min(1).default(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const iso = z.string();

const createLine = z.object({
  variantId: z.uuid(),
  qtyOrdered: z.number().int().min(1).max(1_000_000),
  unitCostP: z.number().int().min(0).max(1_000_000_000),
});
const lines = z
  .array(createLine)
  .min(1)
  .max(200)
  .refine((l) => new Set(l.map((x) => x.variantId)).size === l.length, {
    message: 'Each variant can appear once',
  });

// ---- requests -------------------------------------------------------------------------------

export class PoListQueryDto extends createZodDto(
  z.object({
    status: poStatus.optional(),
    supplierId: z.uuid().optional(),
    q: z.string().trim().max(80).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

export class PoVariantOptionsQueryDto extends createZodDto(
  z.object({
    supplierId: z.uuid(),
    q: z.string().trim().max(80).optional(),
    limit: z.coerce.number().int().min(1).max(30).default(20),
  }),
) {}

export class PoCreateDto extends createZodDto(
  z.object({
    supplierId: z.uuid(),
    expectedAt: date.optional(),
    notes: z.string().trim().max(1000).optional(),
    items: lines,
  }),
) {}

export class PoPatchDto extends createZodDto(
  z.object({
    supplierId: z.uuid().optional(),
    expectedAt: date.nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    items: lines.optional(),
  }),
) {}

export class PoReceiveDto extends createZodDto(
  z.object({
    note: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          poItemId: z.uuid(),
          qtyGood: z.number().int().min(0).max(1_000_000),
          qtyRejected: z.number().int().min(0).max(1_000_000),
        }),
      )
      .min(1)
      .max(200)
      .refine((l) => new Set(l.map((x) => x.poItemId)).size === l.length, {
        message: 'Each line can appear once',
      }),
  }),
) {}

export class PoCloseDto extends createZodDto(
  z.object({ reason: z.string().trim().min(3).max(300) }),
) {}

export class PoCancelDto extends createZodDto(
  z.object({ reason: z.string().trim().min(3).max(300).optional() }),
) {}

// ---- responses ------------------------------------------------------------------------------

const optionLabel = z.object({ en: z.string(), bn: z.string().nullable() });
const staffRef = z.object({ id: z.uuid(), name: z.string() });

const poSummary = z.object({
  id: z.uuid(),
  poNo: z.string(),
  supplier: z.object({ id: z.uuid(), name: z.string() }),
  status: poStatus,
  expectedAt: date.nullable(),
  lineCount: z.number().int(),
  qtyOrdered: z.number().int(),
  qtyReceived: z.number().int(),
  qtyRejected: z.number().int(),
  subtotalP: z.number().int(),
  receivedValueP: z.number().int(),
  late: z.boolean(),
  createdAt: iso,
  sentAt: iso.nullable(),
});

export class PoListDto extends createZodDto(
  z.object({
    items: z.array(poSummary),
    total: z.number().int(),
    counts: z.object({
      all: z.number().int(),
      draft: z.number().int(),
      sent: z.number().int(),
      partially_received: z.number().int(),
      received: z.number().int(),
      closed: z.number().int(),
      cancelled: z.number().int(),
    }),
  }),
) {}

export class PoVariantOptionDto extends createZodDto(
  z.object({
    variantId: z.uuid(),
    productId: z.uuid(),
    productTitleEn: z.string(),
    sku: z.string(),
    options: z.array(optionLabel),
    fulfillment: z.enum(['stock', 'dropship']),
    onHand: z.number().int(),
    linked: z.boolean(),
    lastCostP: z.number().int().nullable(),
    variantCostP: z.number().int().nullable(),
  }),
) {}

export class PoDetailDto extends createZodDto(
  poSummary.extend({
    notes: z.string().nullable(),
    closeReason: z.string().nullable(),
    closedAt: iso.nullable(),
    closedBy: staffRef.nullable(),
    createdBy: staffRef,
    supplier: z.object({
      id: z.uuid(),
      name: z.string(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      address: z.string().nullable(),
    }),
    items: z.array(
      z.object({
        id: z.uuid(),
        variantId: z.uuid(),
        productId: z.uuid(),
        productTitleEn: z.string(),
        sku: z.string(),
        options: z.array(optionLabel),
        qtyOrdered: z.number().int(),
        qtyReceived: z.number().int(),
        qtyRejected: z.number().int(),
        remaining: z.number().int(),
        unitCostP: z.number().int(),
        lineTotalP: z.number().int(),
        onHand: z.number().int(),
        variantCostP: z.number().int().nullable(),
      }),
    ),
    receipts: z.array(
      z.object({
        id: z.uuid(),
        at: iso,
        note: z.string().nullable(),
        totalP: z.number().int(),
        receivedBy: staffRef,
        items: z.array(
          z.object({
            poItemId: z.uuid(),
            sku: z.string(),
            qtyGood: z.number().int(),
            qtyRejected: z.number().int(),
            unitCostP: z.number().int(),
            costBeforeP: z.number().int().nullable(),
            costAfterP: z.number().int().nullable(),
          }),
        ),
      }),
    ),
  }),
) {}

export class PoSendResultDto extends createZodDto(
  z.object({ po: PoDetailDto.schema, emailed: z.boolean() }),
) {}

export class PoPrintDto extends createZodDto(
  z.object({
    store: z.object({
      name: z.string(),
      address: z.string(),
      phone: z.string(),
      email: z.string(),
      bin: z.string(),
      vatRateBp: z.number().int(),
    }),
    supplier: z.object({
      name: z.string(),
      contactName: z.string().nullable(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      address: z.string().nullable(),
    }),
    po: z.object({
      poNo: z.string(),
      status: poStatus,
      createdAt: iso,
      sentAt: iso.nullable(),
      expectedAt: date.nullable(),
      notes: z.string().nullable(),
      subtotalP: z.number().int(),
      receivedValueP: z.number().int(),
    }),
    items: z.array(
      z.object({
        sku: z.string(),
        title: z.string(),
        options: z.array(optionLabel),
        qtyOrdered: z.number().int(),
        qtyReceived: z.number().int(),
        unitCostP: z.number().int(),
        lineTotalP: z.number().int(),
      }),
    ),
  }),
) {}

export class PoErrorDto extends createZodDto(
  z.object({ statusCode: z.number().int(), message: z.string(), code: z.string() }),
) {}
