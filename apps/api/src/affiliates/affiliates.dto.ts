import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  affiliateRefSchema,
  affiliateStatus,
  attribution,
  CODE_RE,
  commissionStatus,
  iso,
  page,
  pageSize,
  payoutDetailsInput,
  payoutDetailsOutput,
} from './affiliates.schemas';

const text = (max: number) => z.string().trim().max(max);
const staffRef = z.object({ id: z.uuid(), name: z.string() });
const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int() });

export class AffiliateErrorDto extends createZodDto(
  z.object({ statusCode: z.number(), message: z.string(), code: z.string().optional() }),
) {}

export class AffiliateRefDto extends createZodDto(affiliateRefSchema) {}

// ---- public ---------------------------------------------------------------------------------

export class AffiliateClickDto extends createZodDto(
  z.object({
    code: text(40).min(1),
    landingUrl: text(500).min(1),
    utm: z
      .object({
        source: text(100).optional(),
        medium: text(100).optional(),
        campaign: text(100).optional(),
      })
      .optional(),
  }),
) {}

// ---- customer -------------------------------------------------------------------------------

const meJoined = z.object({
  joined: z.literal(true),
  id: z.uuid(),
  code: z.string(),
  displayName: z.string(),
  website: z.string().nullable(),
  status: affiliateStatus,
  /// Effective rate: the override or the program default.
  commissionBp: z.number().int(),
  payoutMethod: z.enum(['bkash', 'bank']).nullable(),
  /// `017•••••566` or `…1234`; the full value is never sent back.
  payoutDetailsMasked: z.string().nullable(),
  clickWindowDays: z.number().int(),
  minPayoutP: z.number().int(),
  programEnabled: z.boolean(),
});

/// `{joined:false, ...program terms}` or `{joined:true, ...profile}`: profile fields only when joined.
export class AffiliateMeDto extends createZodDto(
  meJoined.omit({ joined: true }).partial().extend({ joined: z.boolean() }),
) {}

export class AffiliateJoinDto extends createZodDto(
  z.object({
    displayName: text(80).min(2),
    website: z.url().max(300).optional(),
    code: z.string().trim().toUpperCase().regex(CODE_RE, '4 to 16 letters or digits').optional(),
  }),
) {}

export class AffiliateUpdateDto extends createZodDto(
  z.object({
    displayName: text(80).min(2).optional(),
    website: z.url().max(300).nullable().optional(),
  }),
) {}

/// Send method 'bkash' with bkashNumber + holderName, or 'bank' with bankName, branch, accountNo, accountName.
export class AffiliatePayoutDetailsDto extends createZodDto(
  z
    .object({
      method: z.enum(['bkash', 'bank']),
      bkashNumber: z.string().optional(),
      holderName: z.string().optional(),
      bankName: z.string().optional(),
      branch: z.string().optional(),
      accountNo: z.string().optional(),
      accountName: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      const r = payoutDetailsInput.safeParse(v);
      if (r.success) return;
      for (const issue of r.error.issues)
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }),
) {}

export class AffiliateStatsQueryDto extends createZodDto(
  z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }),
) {}

export class AffiliateStatsDto extends createZodDto(
  z.object({
    days: z.array(
      z.object({ date: z.string(), clicks: z.number().int(), orders: z.number().int() }),
    ),
    totals: z.object({
      clicks: z.number().int(),
      orders: z.number().int(),
      conversionBp: z.number().int(),
      pendingP: z.number().int(),
      balanceP: z.number().int(),
      paidP: z.number().int(),
      reversedCount: z.number().int(),
    }),
  }),
) {}

export class AffiliateMyCommissionQueryDto extends createZodDto(
  z.object({ status: commissionStatus.optional(), page, pageSize }),
) {}

const myCommission = z.object({
  id: z.uuid(),
  placedAt: iso,
  itemCount: z.number().int(),
  firstItemTitle: z.string().nullable(),
  attribution,
  baseP: z.number().int(),
  commissionBp: z.number().int(),
  amountP: z.number().int(),
  status: commissionStatus,
  availableAt: iso.nullable(),
  reverseReason: z.string().nullable(),
});
export class AffiliateMyCommissionListDto extends createZodDto(pageOf(myCommission)) {}

export class AffiliateMyPayoutQueryDto extends createZodDto(z.object({ page, pageSize })) {}

export class AffiliateMyPayoutListDto extends createZodDto(
  pageOf(
    z.object({
      id: z.uuid(),
      period: z.string(),
      amountP: z.number().int(),
      method: z.enum(['bkash', 'bank', 'cash']),
      reference: z.string(),
      paidAt: iso,
    }),
  ),
) {}

// ---- admin ----------------------------------------------------------------------------------

export class AffiliateAdminListQueryDto extends createZodDto(
  z.object({
    q: z.string().trim().max(100).optional(),
    status: affiliateStatus.optional(),
    page,
    pageSize,
  }),
) {}

const adminRow = z.object({
  id: z.uuid(),
  code: z.string(),
  displayName: z.string(),
  customer: z.object({
    id: z.uuid(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  status: affiliateStatus,
  commissionBp: z.number().int(),
  rateOverridden: z.boolean(),
  clicks30: z.number().int(),
  orders30: z.number().int(),
  pendingP: z.number().int(),
  balanceP: z.number().int(),
  paidP: z.number().int(),
  createdAt: iso,
});
export class AffiliateAdminListDto extends createZodDto(pageOf(adminRow)) {}

export class AffiliateAdminDetailDto extends createZodDto(
  adminRow.extend({
    website: z.string().nullable(),
    suspendedAt: iso.nullable(),
    suspendedReason: z.string().nullable(),
    payoutMethod: z.enum(['bkash', 'bank']).nullable(),
    /// Full object only with affiliate_payouts.manage; otherwise the masked string.
    payoutDetails: z.union([z.string(), payoutDetailsOutput]).nullable(),
  }),
) {}

export class AffiliateAdminUpdateDto extends createZodDto(
  z.object({
    /// Null goes back to the program default.
    commissionBp: z.number().int().min(0).max(10_000).nullable().optional(),
    status: affiliateStatus.optional(),
    suspendedReason: text(300).optional(),
  }),
) {}

export class AffiliateAdminCommissionQueryDto extends createZodDto(
  z.object({ status: commissionStatus.optional(), page, pageSize }),
) {}

export class AffiliateAdminCommissionListDto extends createZodDto(
  pageOf(
    myCommission.extend({
      order: z.object({ id: z.uuid(), orderNo: z.string() }),
    }),
  ),
) {}

export class AffiliateDueListDto extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        affiliateId: z.uuid(),
        code: z.string(),
        displayName: z.string(),
        balanceP: z.number().int(),
        commissionCount: z.number().int(),
        payoutMethod: z.enum(['bkash', 'bank']).nullable(),
        payoutDetails: payoutDetailsOutput.nullable(),
        hasPayoutDetails: z.boolean(),
      }),
    ),
  }),
) {}

export class AffiliatePayoutCreateDto extends createZodDto(
  z.object({
    method: z.enum(['bkash', 'bank', 'cash']),
    reference: text(100).min(2),
    note: text(500).optional(),
    expectedAmountP: z.number().int().min(1),
  }),
) {}

const payoutRow = z.object({
  id: z.uuid(),
  affiliate: z.object({ id: z.uuid(), code: z.string(), displayName: z.string() }),
  period: z.string(),
  amountP: z.number().int(),
  method: z.enum(['bkash', 'bank', 'cash']),
  reference: z.string(),
  note: z.string().nullable(),
  paidBy: staffRef,
  paidAt: iso,
});
export class AffiliatePayoutDto extends createZodDto(payoutRow) {}

export class AffiliatePayoutListQueryDto extends createZodDto(
  z.object({ affiliateId: z.uuid().optional(), page, pageSize }),
) {}
export class AffiliatePayoutListDto extends createZodDto(pageOf(payoutRow)) {}
