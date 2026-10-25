import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  couponCreateSchema,
  couponDetailSchema,
  couponKind,
  couponListItemSchema,
  couponPhase,
  couponStatus,
  couponType,
  couponUpdateSchema,
} from './coupons.schemas';

const page = z.coerce.number().int().min(1).default(1);
const iso = z.iso.datetime();
const day = z.iso.date();

// ---- admin CRUD -----------------------------------------------------------------------------

export class CouponCreateDto extends createZodDto(couponCreateSchema) {}
export class CouponUpdateDto extends createZodDto(couponUpdateSchema) {}
export class CouponDetailDto extends createZodDto(couponDetailSchema) {}
export class CouponListQueryDto extends createZodDto(
  z.object({
    kind: couponKind.optional(),
    status: couponStatus.optional(),
    type: couponType.optional(),
    phase: couponPhase.optional(),
    q: z.string().trim().max(120).optional(),
    page,
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }),
) {}
export class CouponListDto extends createZodDto(
  z.object({
    items: z.array(couponListItemSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  }),
) {}

export class CouponLookupQueryDto extends createZodDto(
  z.object({ q: z.string().trim().min(2).max(80) }),
) {}
export class CouponLookupDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
      }),
    ),
  }),
) {}

// ---- bulk codes -----------------------------------------------------------------------------

export class CouponCodesGenerateDto extends createZodDto(
  z.object({
    count: z.number().int().min(1).max(5000),
    prefix: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{1,12}$/)
      .optional(),
    length: z.number().int().min(6).max(12).default(8),
  }),
) {}
export class CouponCodesGeneratedDto extends createZodDto(
  z.object({ generated: z.number().int(), total: z.number().int() }),
) {}
export class CouponCodesQueryDto extends createZodDto(
  z.object({
    status: z.enum(['used', 'unused']).optional(),
    q: z.string().trim().max(40).optional(),
    page,
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
) {}
export class CouponCodesListDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        id: z.uuid(),
        code: z.string(),
        usedAt: iso.nullable(),
        assignedCustomer: z
          .object({ id: z.uuid(), name: z.string(), phone: z.string().nullable() })
          .nullable(),
      }),
    ),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  }),
) {}
export class CouponCodesAssignDto extends createZodDto(
  z.object({ customerId: z.uuid(), count: z.number().int().min(1).max(1000) }),
) {}
export class CouponCodesAssignedDto extends createZodDto(
  z.object({ assigned: z.number().int(), codes: z.array(z.string()) }),
) {}

// ---- report ---------------------------------------------------------------------------------

export class CouponReportQueryDto extends createZodDto(
  z.object({ from: day.optional(), to: day.optional() }),
) {}
export class CouponReportDto extends createZodDto(
  z.object({
    uses: z.number().int(),
    uniqueCustomers: z.number().int(),
    revenueP: z.number().int(),
    discountGivenP: z.number().int(),
    avgOrderP: z.number().int(),
    reversed: z.number().int(),
    daily: z.array(z.object({ date: day, uses: z.number().int(), discountP: z.number().int() })),
    topCustomers: z.array(
      z.object({
        customerId: z.uuid(),
        name: z.string(),
        uses: z.number().int(),
        discountP: z.number().int(),
      }),
    ),
  }),
) {}

// ---- customer wallet ------------------------------------------------------------------------

const walletItem = z.object({
  couponId: z.uuid(),
  name: z.string(),
  kind: couponKind,
  /** Null for automatic coupons. */
  code: z.string().nullable(),
  type: couponType,
  value: z.number().int(),
  maxDiscountP: z.number().int().nullable(),
  minOrderP: z.number().int().nullable(),
  startsAt: iso.nullable(),
  endsAt: iso.nullable(),
  termsEn: z.string().nullable(),
  termsBn: z.string().nullable(),
  source: z.enum(['collected', 'assigned', 'bulk_code']),
  /** true = in the customer's collected list, so it can be removed. */
  collected: z.boolean(),
  state: z.enum(['usable', 'expired', 'used_up', 'not_started']),
});
export class CouponWalletItemDto extends createZodDto(walletItem) {}
export class CouponWalletListDto extends createZodDto(z.object({ items: z.array(walletItem) })) {}

// ---- public ---------------------------------------------------------------------------------

const publicItem = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: couponKind,
  /** Only for single-code coupons. */
  code: z.string().nullable(),
  type: couponType,
  value: z.number().int(),
  maxDiscountP: z.number().int().nullable(),
  minOrderP: z.number().int().nullable(),
  startsAt: iso.nullable(),
  endsAt: iso.nullable(),
  termsEn: z.string().nullable(),
  termsBn: z.string().nullable(),
  isCollectable: z.boolean(),
  /** Present when a customer is signed in. */
  collected: z.boolean().optional(),
});
export class CouponPublicListDto extends createZodDto(z.object({ items: z.array(publicItem) })) {}
