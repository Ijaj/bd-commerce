import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);

export class InventoryQueryDto extends createZodDto(
  z.object({
    q: z.string().trim().max(100).optional(),
    lowStock: z.enum(['true', 'false']).optional(),
    categoryId: z.uuid().optional(),
    fulfillment: z.enum(['stock', 'dropship']).optional(),
    page,
    pageSize,
  }),
) {}

export class MovementsQueryDto extends createZodDto(z.object({ page, pageSize })) {}

const optionLabel = z.object({ en: z.string(), bn: z.string().nullable() });

export const inventoryRowSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productTitleEn: z.string(),
  productTitleBn: z.string().nullable(),
  fulfillment: z.enum(['stock', 'dropship']),
  sku: z.string(),
  optionLabels: z.array(optionLabel),
  onHand: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
  lowStockThreshold: z.number().int().nullable(),
  isLow: z.boolean(),
});

export class InventoryRowDto extends createZodDto(inventoryRowSchema) {}

export class InventoryListDto extends createZodDto(
  z.object({
    items: z.array(inventoryRowSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}

export class LowStockCountDto extends createZodDto(z.object({ count: z.number().int() })) {}

export class AdjustStockDto extends createZodDto(
  z.object({
    mode: z.enum(['delta', 'set']),
    qty: z.number().int().min(-1_000_000).max(1_000_000),
    note: z.string().trim().min(1).max(500),
  }),
) {}

export class UpdateInventoryDto extends createZodDto(
  z.object({ lowStockThreshold: z.number().int().min(0).max(1_000_000).nullable() }),
) {}

const movementSchema = z.object({
  id: z.uuid(),
  qtyDelta: z.number().int(),
  reservedDelta: z.number().int(),
  reason: z.enum([
    'po_receive',
    'order_reserve',
    'order_release',
    'ship',
    'return_restock',
    'adjust',
    'import',
    'sr_reserve',
    'sr_release',
    'sr_ship',
  ]),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  note: z.string().nullable(),
  staff: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  at: z.iso.datetime(),
});

export class MovementListDto extends createZodDto(
  z.object({
    items: z.array(movementSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}
