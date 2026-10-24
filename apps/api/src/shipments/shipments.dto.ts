import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const iso = z.iso.datetime();
const json = z.record(z.string(), z.unknown());

const STATUSES = [
  'pending',
  'awaiting_supplier',
  'supplier_confirmed',
  'ready',
  'booked',
  'handed_over',
  'in_transit',
  'delivered',
  'failed',
  'returning',
  'returned',
  'cancelled',
] as const;

export const ShipmentCreateSchema = z.object({
  items: z
    .array(z.object({ orderItemId: z.uuid(), qty: z.number().int().min(1).max(100_000) }))
    .min(1)
    .max(200),
  note: z.string().trim().max(500).optional(),
});
export class ShipmentCreateDto extends createZodDto(ShipmentCreateSchema) {}

export class ShipmentListQueryDto extends createZodDto(
  z.object({
    status: z.enum(STATUSES).optional(),
    courier: z.string().trim().min(1).max(40).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  }),
) {}

export class ShipmentBookDto extends createZodDto(
  z.object({ courierCode: z.string().trim().min(1).max(40) }),
) {}

export class ShipmentRebookDto extends createZodDto(
  z.object({
    courierCode: z.string().trim().min(1).max(40).optional(),
    /** Couriers without a cancel API: staff cancelled in the courier's own panel. */
    manualCancel: z.boolean().optional(),
  }),
) {}

export class ShipmentCancelDto extends createZodDto(
  z.object({ manualCancel: z.boolean().optional() }),
) {}

const itemView = z.object({
  id: z.uuid(),
  orderItemId: z.uuid(),
  qty: z.number().int(),
  titleSnapshot: z.string(),
  sku: z.string(),
  optionsText: z.string().nullable(),
});

const bookingView = z.object({
  id: z.uuid(),
  attempt: z.number().int(),
  courierCode: z.string(),
  status: z.enum(['requested', 'booked', 'failed', 'cancelled']),
  consignmentId: z.string().nullable(),
  request: json.nullable(),
  response: z.unknown().nullable(),
  createdAt: iso,
});

const eventView = z.object({
  id: z.uuid(),
  bookingId: z.uuid(),
  rawStatus: z.string(),
  mappedStatus: z.string().nullable(),
  at: iso,
});

const shipmentBase = {
  id: z.uuid(),
  shipmentNo: z.string(),
  orderId: z.uuid(),
  orderNo: z.string(),
  status: z.enum(STATUSES),
  source: z.enum(['warehouse', 'supplier']),
  courier: z.object({ code: z.string(), name: z.string() }).nullable(),
  consignmentId: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  codAmountP: z.number().int(),
  deliveryChargeShareP: z.number().int(),
  weightG: z.number().int().nullable(),
  note: z.string().nullable(),
  recipient: z.object({ name: z.string(), phone: z.string(), placeText: z.string() }),
  items: z.array(itemView),
  packedAt: iso.nullable(),
  handedAt: iso.nullable(),
  deliveredAt: iso.nullable(),
  createdAt: iso,
};

export class ShipmentDto extends createZodDto(z.object(shipmentBase)) {}

export class ShipmentDetailDto extends createZodDto(
  z.object({
    ...shipmentBase,
    bookings: z.array(bookingView),
    events: z.array(eventView),
  }),
) {}

export class ShipmentListDto extends createZodDto(
  z.object({
    items: z.array(z.object(shipmentBase)),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}

export class ShipmentOrderListDto extends createZodDto(
  z.object({ items: z.array(z.object(shipmentBase)) }),
) {}

export class ShipmentSyncResultDto extends createZodDto(
  z.object({
    shipment: z.object(shipmentBase),
    rawStatus: z.string(),
    mapped: z.string().nullable(),
    changed: z.boolean(),
  }),
) {}

export class ShipmentWebhookAckDto extends createZodDto(z.object({ ok: z.literal(true) })) {}
