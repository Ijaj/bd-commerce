import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const iso = z.iso.datetime();
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);
const dateOrTime = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const ORDER_STATUSES = [
  'pending_payment',
  'processing',
  'on_hold',
  'partially_shipped',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;
export const PAYMENT_STATUSES = [
  'unpaid',
  'partially_paid',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
] as const;
export const CALL_STATUSES = [
  'not_needed',
  'pending',
  'confirmed',
  'unreachable',
  'cancelled',
] as const;
export const CALL_OUTCOMES = ['confirmed', 'unreachable', 'cancelled'] as const;

// ---- requests -------------------------------------------------------------

export class OrdersAdminListQueryDto extends createZodDto(
  z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    call: z.enum(CALL_STATUSES).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    /** Placed at or after (a plain date means 00:00 Asia/Dhaka). */
    from: dateOrTime.optional(),
    /** Placed before the end of this date (plain date: inclusive of the whole day, Asia/Dhaka). */
    to: dateOrTime.optional(),
    risk: z.enum(['0', '1']).optional(),
    page,
    pageSize,
  }),
) {}

export class OrdersAdminReasonDto extends createZodDto(
  z.object({ reason: z.string().trim().min(1).max(500) }),
) {}

export class OrdersAdminCallQueueQueryDto extends createZodDto(
  z.object({
    status: z.enum(['pending', 'done']).default('pending'),
    page,
    pageSize,
  }),
) {}

export class OrdersAdminCallOutcomeDto extends createZodDto(
  z.object({
    outcome: z.enum(CALL_OUTCOMES),
    note: z.string().trim().min(1).max(1000).optional(),
  }),
) {}

// ---- responses ------------------------------------------------------------

const person = z.object({
  id: z.uuid().nullable(),
  name: z.string(),
  phone: z.string(),
  isGuest: z.boolean(),
});

const listItem = z.object({
  id: z.uuid(),
  orderNo: z.string(),
  placedAt: iso,
  status: z.enum(ORDER_STATUSES),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  callStatus: z.enum(CALL_STATUSES),
  riskScore: z.number().int(),
  riskReasons: z.array(z.string()),
  callNote: z.string().nullable(),
  callAt: iso.nullable(),
  customer: person,
  shipPlaceText: z.string(),
  grandTotalP: z.number().int(),
  codDueP: z.number().int(),
  itemCount: z.number().int(),
  shipmentSummary: z.object({ total: z.number().int(), delivered: z.number().int() }),
});

const imageSet = z.object({
  alt: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  url320: z.string(),
  url640: z.string(),
  url1200: z.string(),
});

const detailItem = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  variantId: z.uuid(),
  titleSnapshot: z.string(),
  sku: z.string(),
  optionsText: z.string().nullable(),
  image: imageSet.nullable(),
  qty: z.number().int(),
  qtyCancelled: z.number().int(),
  qtyShipped: z.number().int(),
  qtyReturned: z.number().int(),
  unitPriceP: z.number().int(),
  lineTotalP: z.number().int(),
});

const detail = z.object({
  id: z.uuid(),
  orderNo: z.string(),
  placedAt: iso,
  deliveredAt: iso.nullable(),
  completedAt: iso.nullable(),
  status: z.enum(ORDER_STATUSES),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.string(),
  lang: z.enum(['en', 'bn']),
  platform: z.string(),
  isPreorder: z.boolean(),
  customerNote: z.string().nullable(),
  cancelReason: z.string().nullable(),
  heldReason: z.string().nullable(),
  customer: person,
  shipTo: z.object({
    name: z.string(),
    phone: z.string(),
    placeText: z.string(),
    line: z.string(),
    landmark: z.string().nullable(),
    districtId: z.number().int(),
    upazilaId: z.number().int(),
    areaId: z.number().int().nullable(),
  }),
  zone: z.object({ id: z.uuid(), nameEn: z.string(), nameBn: z.string().nullable() }),
  money: z.object({
    subtotalP: z.number().int(),
    autoDiscountP: z.number().int(),
    couponDiscountP: z.number().int(),
    deliveryChargeP: z.number().int(),
    deliveryDiscountP: z.number().int(),
    grandTotalP: z.number().int(),
    advanceRequiredP: z.number().int(),
    paidP: z.number().int(),
    refundedP: z.number().int(),
    codDueP: z.number().int(),
  }),
  items: z.array(detailItem),
  history: z.array(
    z.object({
      id: z.uuid(),
      fromStatus: z.enum(ORDER_STATUSES).nullable(),
      toStatus: z.enum(ORDER_STATUSES),
      actorType: z.string(),
      actorId: z.uuid().nullable(),
      actorName: z.string().nullable(),
      note: z.string().nullable(),
      at: iso,
    }),
  ),
  payments: z.array(
    z.object({
      id: z.uuid(),
      method: z.string(),
      purpose: z.string(),
      amountP: z.number().int(),
      status: z.string(),
      paidAt: iso.nullable(),
    }),
  ),
  shipments: z.array(
    z.object({
      id: z.uuid(),
      shipmentNo: z.string(),
      status: z.string(),
      courierCode: z.string().nullable(),
      consignmentId: z.string().nullable(),
      trackingUrl: z.string().nullable(),
      codAmountP: z.number().int(),
      items: z.array(z.object({ orderItemId: z.uuid(), qty: z.number().int() })),
    }),
  ),
  invoices: z.array(z.object({ id: z.uuid(), invoiceNo: z.string(), issuedAt: iso })),
  returns: z.array(z.object({ id: z.uuid(), returnNo: z.string(), status: z.string() })),
  refunds: z.array(
    z.object({ id: z.uuid(), amountP: z.number().int(), status: z.string(), method: z.string() }),
  ),
  risk: z.object({ score: z.number().int(), reasons: z.array(z.string()) }),
  call: z.object({
    status: z.enum(CALL_STATUSES),
    note: z.string().nullable(),
    staffName: z.string().nullable(),
    at: iso.nullable(),
  }),
});

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

export class OrdersAdminListItemDto extends createZodDto(listItem) {}
export class OrdersAdminListDto extends createZodDto(pageOf(listItem)) {}
export class OrdersAdminDetailDto extends createZodDto(detail) {}
export class OrdersAdminCallCountDto extends createZodDto(
  z.object({ pending: z.number().int() }),
) {}
