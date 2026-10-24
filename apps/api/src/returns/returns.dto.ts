import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const reason = z.enum([
  'wrong_item',
  'damaged',
  'defective',
  'not_as_described',
  'change_of_mind',
  'other',
]);
const returnStatus = z.enum([
  'requested',
  'approved',
  'rejected',
  'pickup_booked',
  'received',
  'inspected',
  'closed',
]);
const refundStatus = z.enum([
  'pending_approval',
  'approved',
  'rejected',
  'processing',
  'done',
  'failed',
]);
const refundMethod = z.enum(['original', 'wallet']);
const page = z.coerce.number().int().min(1).default(1);

const requestItem = z.object({
  orderItemId: z.uuid(),
  qty: z.number().int().min(1).max(10_000),
  reason,
  note: z.string().trim().max(500).optional(),
});

// ---- requests -------------------------------------------------------------------------------

export class ReturnCustomerCreateDto extends createZodDto(
  z.object({
    orderNo: z.string().trim().min(1).max(40),
    items: z.array(requestItem).min(1).max(50),
    mediaIds: z.array(z.uuid()).max(10).optional(),
  }),
) {}

export class ReturnAdminCreateDto extends createZodDto(
  z.object({
    items: z.array(requestItem).min(1).max(50),
    mediaIds: z.array(z.uuid()).max(10).optional(),
    note: z.string().trim().max(1000).optional(),
    windowOverride: z.boolean().optional(),
  }),
) {}

export class ReturnCustomerListQueryDto extends createZodDto(
  z.object({ page, limit: z.coerce.number().int().min(1).max(50).default(10) }),
) {}

export class ReturnAdminListQueryDto extends createZodDto(
  z.object({
    status: returnStatus.optional(),
    q: z.string().trim().max(60).optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

export class ReturnApproveDto extends createZodDto(
  z.object({
    fault: z.enum(['ours', 'customer']),
    returnShippingP: z.number().int().min(0).max(100_000_000).optional(),
    note: z.string().trim().max(1000).optional(),
  }),
) {}

export class ReturnRejectDto extends createZodDto(
  z.object({ reason: z.string().trim().min(1).max(500) }),
) {}

export class ReturnNoteDto extends createZodDto(
  z.object({ note: z.string().trim().max(1000).optional() }),
) {}

export class ReturnInspectDto extends createZodDto(
  z.object({
    items: z
      .array(
        z.object({
          returnItemId: z.uuid(),
          condition: z.enum(['resellable', 'damaged']),
          restock: z.boolean(),
        }),
      )
      .min(1)
      .max(50),
  }),
) {}

export class ReturnRefundDto extends createZodDto(
  z.object({ method: refundMethod, note: z.string().trim().max(1000).optional() }),
) {}

export class ReturnOrderRefundDto extends createZodDto(
  z.object({
    items: z
      .array(z.object({ orderItemId: z.uuid(), qty: z.number().int().min(1).max(10_000) }))
      .max(50)
      .optional(),
    amountP: z.number().int().min(1).max(1_000_000_000).optional(),
    method: refundMethod,
    note: z.string().trim().min(1).max(1000),
  }),
) {}

export class ReturnRefundRejectDto extends createZodDto(
  z.object({ reason: z.string().trim().min(1).max(500) }),
) {}

export class ReturnRefundCompleteDto extends createZodDto(
  z.object({ providerRef: z.string().trim().max(120).optional() }),
) {}

export class ReturnRefundListQueryDto extends createZodDto(
  z.object({
    status: refundStatus.optional(),
    page,
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

// ---- responses ------------------------------------------------------------------------------

const refundSummary = z.object({
  id: z.string(),
  amountP: z.number(),
  method: refundMethod,
  status: refundStatus,
});

export class ReturnCustomerDto extends createZodDto(
  z.object({
    returnNo: z.string(),
    orderNo: z.string(),
    status: returnStatus,
    fault: z.enum(['ours', 'customer']).nullable(),
    returnShippingP: z.number(),
    rejectReason: z.string().nullable(),
    requestedAt: z.string(),
    items: z.array(
      z.object({
        orderItemId: z.string(),
        titleSnapshot: z.string(),
        sku: z.string(),
        optionsText: z.string().nullable(),
        qty: z.number(),
        reason,
        note: z.string().nullable(),
      }),
    ),
    mediaIds: z.array(z.string()),
    refunds: z.array(refundSummary),
  }),
) {}

export class ReturnCustomerListDto extends createZodDto(
  z.object({
    items: z.array(ReturnCustomerDto.schema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
) {}

export class ReturnAdminListDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        id: z.string(),
        returnNo: z.string(),
        orderId: z.string(),
        orderNo: z.string(),
        status: returnStatus,
        fault: z.enum(['ours', 'customer']).nullable(),
        itemCount: z.number(),
        customerName: z.string().nullable(),
        customerPhone: z.string().nullable(),
        requestedAt: z.string(),
      }),
    ),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
) {}

const refundRow = z.object({
  id: z.string(),
  orderId: z.string(),
  returnId: z.string().nullable(),
  amountP: z.number(),
  method: refundMethod,
  status: refundStatus,
  needsApproval: z.boolean(),
  requestedBy: z.string().nullable(),
  requestedByName: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedByName: z.string().nullable(),
  approvedAt: z.string().nullable(),
  providerRef: z.string().nullable(),
  note: z.string().nullable(),
  doneAt: z.string().nullable(),
  createdAt: z.string(),
  items: z.array(z.object({ orderItemId: z.string(), qty: z.number(), amountP: z.number() })),
});

export class ReturnRefundDetailDto extends createZodDto(refundRow) {}

export class ReturnRefundListDto extends createZodDto(
  z.object({
    items: z.array(refundRow.extend({ orderNo: z.string() })),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
) {}

export class ReturnAdminDetailDto extends createZodDto(
  z.object({
    id: z.string(),
    returnNo: z.string(),
    status: returnStatus,
    fault: z.enum(['ours', 'customer']).nullable(),
    returnShippingP: z.number(),
    note: z.string().nullable(),
    rejectReason: z.string().nullable(),
    staffId: z.string().nullable(),
    requestedAt: z.string(),
    updatedAt: z.string(),
    order: z.object({
      id: z.string(),
      orderNo: z.string(),
      status: z.string(),
      paymentStatus: z.string(),
      deliveredAt: z.string().nullable(),
      paidP: z.number(),
      refundedP: z.number(),
      customerName: z.string().nullable(),
      customerPhone: z.string().nullable(),
    }),
    items: z.array(
      z.object({
        id: z.string(),
        orderItemId: z.string(),
        titleSnapshot: z.string(),
        sku: z.string(),
        optionsText: z.string().nullable(),
        imageMediaId: z.string().nullable(),
        unitPriceP: z.number(),
        qty: z.number(),
        reason,
        note: z.string().nullable(),
        condition: z.enum(['resellable', 'damaged']).nullable(),
        restock: z.boolean(),
        /** Pro-rata refund value of this line (discounts spread over lines). */
        refundValueP: z.number(),
      }),
    ),
    mediaIds: z.array(z.string()),
    refunds: z.array(refundRow),
  }),
) {}

export class ReturnCompleteDueDto extends createZodDto(z.object({ completed: z.number() })) {}
