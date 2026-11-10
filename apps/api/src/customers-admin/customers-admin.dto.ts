import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int() });
const flag = z.enum(['0', '1']).optional();
const staffRef = z.object({ id: z.uuid(), name: z.string() });

export class CustomerAdminErrorDto extends createZodDto(
  z.object({ statusCode: z.number(), message: z.string(), code: z.string().optional() }),
) {}

export class CustomerAdminListQueryDto extends createZodDto(
  z.object({
    q: z.string().trim().max(100).optional(),
    blocked: flag,
    hasOrders: flag,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

export class CustomerAdminPageQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

const row = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  lang: z.enum(['en', 'bn']),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
  blocked: z.boolean(),
  orderCount: z.number().int(),
  spentP: z.number().int(),
  lastOrderAt: z.string().nullable(),
});
export class CustomerAdminListDto extends createZodDto(pageOf(row)) {}

export class CustomerAdminDetailDto extends createZodDto(
  row.extend({
    phoneVerifiedAt: z.string().nullable(),
    emailVerifiedAt: z.string().nullable(),
    isFlagged: z.boolean(),
    blockedAt: z.string().nullable(),
    blockedReason: z.string().nullable(),
    blockedBy: staffRef.nullable(),
    cancelledCount: z.number().int(),
    addresses: z.array(
      z.object({
        id: z.uuid(),
        label: z.string().nullable(),
        name: z.string(),
        phone: z.string(),
        placeText: z.string(),
        line: z.string(),
        landmark: z.string().nullable(),
        isDefault: z.boolean(),
      }),
    ),
  }),
) {}

export class CustomerAdminOrderListDto extends createZodDto(
  pageOf(
    z.object({
      id: z.uuid(),
      orderNo: z.string(),
      placedAt: z.string(),
      status: z.string(),
      paymentStatus: z.string(),
      grandTotalP: z.number().int(),
      itemCount: z.number().int(),
    }),
  ),
) {}

const note = z.object({
  id: z.uuid(),
  staff: staffRef.nullable(),
  body: z.string(),
  createdAt: z.string(),
});
export class CustomerAdminNoteDto extends createZodDto(note) {}
export class CustomerAdminNoteListDto extends createZodDto(z.object({ items: z.array(note) })) {}
export class CustomerAdminNoteInputDto extends createZodDto(
  z.object({ body: z.string().trim().min(1).max(2000) }),
) {}
export class CustomerAdminBlockInputDto extends createZodDto(
  z.object({ reason: z.string().trim().min(1).max(300) }),
) {}
