import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { orderDiscountSchema } from '../promotions/engine/order-discounts';
import { orderDetailSchema } from './orders-admin.dto';

const iso = z.iso.datetime();
const money = z.object({
  subtotalP: z.number().int(),
  autoDiscountP: z.number().int(),
  couponDiscountP: z.number().int(),
  deliveryChargeP: z.number().int(),
  deliveryDiscountP: z.number().int(),
  grandTotalP: z.number().int(),
  codDueP: z.number().int(),
});

// ---- requests -------------------------------------------------------------

/** Omitted field = unchanged. `lines`, when present, is the desired full list (qty 0 = remove). */
export class OrderEditInputDto extends createZodDto(
  z.object({
    lines: z
      .array(
        z.object({
          orderItemId: z.uuid().optional(),
          variantId: z.uuid().optional(),
          qty: z.number().int().min(0).max(1000),
        }),
      )
      .max(100)
      .optional(),
    ship: z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        phone: z.string().trim().min(5).max(20).optional(),
        upazilaId: z.number().int().optional(),
        areaId: z.number().int().nullable().optional(),
        line: z.string().trim().min(1).max(300).optional(),
        landmark: z.string().trim().max(200).nullable().optional(),
      })
      .optional(),
    customerNote: z.string().trim().max(500).nullable().optional(),
    note: z.string().trim().min(1).max(500).optional(),
  }),
) {}

// ---- responses ------------------------------------------------------------

const previewLine = z.object({
  orderItemId: z.uuid().nullable(),
  variantId: z.uuid(),
  title: z.string(),
  sku: z.string(),
  optionsText: z.string().nullable(),
  qty: z.number().int(),
  unitPriceP: z.number().int(),
  lineTotalP: z.number().int(),
  discountP: z.number().int(),
  change: z.enum(['same', 'qty', 'price', 'added', 'removed']),
});

export class OrderEditPreviewDto extends createZodDto(
  z.object({
    lines: z.array(previewLine),
    money,
    before: money,
    zone: z.object({ id: z.uuid(), name: z.string() }),
    warnings: z.array(z.string()),
  }),
) {}

export class OrderEditSavedDto extends createZodDto(
  z.object({
    order: orderDetailSchema,
    edit: z.object({ id: z.uuid(), createdAt: iso }).nullable(),
  }),
) {}

const snapshot = z.object({
  ship: z.object({
    name: z.string(),
    phone: z.string(),
    placeText: z.string(),
    line: z.string(),
    landmark: z.string().nullable(),
    zoneId: z.uuid(),
    zoneName: z.string(),
  }),
  lines: z.array(
    z.object({
      variantId: z.uuid(),
      title: z.string(),
      qty: z.number().int(),
      unitPriceP: z.number().int(),
      lineTotalP: z.number().int(),
      discountP: z.number().int(),
    }),
  ),
  money,
  discounts: z.array(orderDiscountSchema),
});

export class OrderEditHistoryDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        id: z.uuid(),
        createdAt: iso,
        staff: z.object({ id: z.uuid(), name: z.string() }).nullable(),
        note: z.string().nullable(),
        customerNotifiedAt: iso.nullable(),
        before: snapshot,
        after: snapshot,
      }),
    ),
  }),
) {}

export class CourierRowDto extends createZodDto(
  z.object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    isActive: z.boolean(),
  }),
) {}
