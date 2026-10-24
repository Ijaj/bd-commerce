import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MAX_MONEY_P } from './sr.util';

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);
const moneyP = z.number().int().min(0).max(MAX_MONEY_P);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM');
const iso = z.iso.datetime();
const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

export const SALE_STATUSES = [
  'submitted',
  'approved',
  'rejected',
  'delivered',
  'cancelled',
] as const;
export const COLLECTION_METHODS = ['cash', 'bkash', 'nagad', 'bank'] as const;

// ---- shared views --------------------------------------------------------

const nameRef = z.object({ id: z.uuid(), name: z.string() });

const imageSet = z.object({
  alt: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  url320: z.string(),
  url640: z.string(),
  url1200: z.string(),
});

const shopView = z.object({
  id: z.uuid(),
  name: z.string(),
  ownerName: z.string().nullable(),
  phone: z.string(),
  address: z.string(),
  area: z.string().nullable(),
  isNew: z.boolean(),
  status: z.enum(['active', 'blocked']),
  dueBalanceP: z.number().int(),
  notes: z.string().nullable(),
  createdBy: nameRef,
  createdAt: iso,
});

const saleItemView = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
  sku: z.string(),
  titleEn: z.string(),
  titleBn: z.string().nullable(),
  optionsText: z.string(),
  optionsTextBn: z.string(),
  qty: z.number().int(),
  unitPriceP: z.number().int(),
  lineTotalP: z.number().int(),
});

const saleView = z.object({
  id: z.uuid(),
  memoNo: z.string(),
  status: z.enum(SALE_STATUSES),
  totalP: z.number().int(),
  paidAtSaleP: z.number().int(),
  dueP: z.number().int(),
  note: z.string().nullable(),
  submittedAt: iso,
  approvedAt: iso.nullable(),
  approvedBy: nameRef.nullable(),
  rejectedReason: z.string().nullable(),
  deliveredAt: iso.nullable(),
  deliveredBy: nameRef.nullable(),
  shop: z.object({ id: z.uuid(), name: z.string(), phone: z.string() }),
  sr: nameRef,
  itemCount: z.number().int(),
});
const saleDetailView = saleView.extend({ items: z.array(saleItemView) });

const ledgerView = z.object({
  id: z.uuid(),
  b2bShopId: z.uuid(),
  shopName: z.string(),
  type: z.enum(['sale_due', 'collection', 'adjustment']),
  /** + adds due, - pays it (collections are negative). */
  amountP: z.number().int(),
  method: z.string().nullable(),
  srSaleId: z.uuid().nullable(),
  memoNo: z.string().nullable(),
  recordedBy: nameRef,
  confirmed: z.boolean(),
  confirmedBy: nameRef.nullable(),
  confirmedAt: iso.nullable(),
  note: z.string().nullable(),
  at: iso,
});

export type SrShopView = z.infer<typeof shopView>;
export type SrSaleListView = z.infer<typeof saleView>;
export type SrSaleDetailView = z.infer<typeof saleDetailView>;
export type B2bLedgerView = z.infer<typeof ledgerView>;

export class SrShopDto extends createZodDto(shopView) {}
export class SrShopPageDto extends createZodDto(pageOf(shopView)) {}
export class SrSaleDto extends createZodDto(saleView) {}
export class SrSalePageDto extends createZodDto(pageOf(saleView)) {}
export class SrSaleDetailDto extends createZodDto(saleDetailView) {}
export class B2bLedgerRowDto extends createZodDto(ledgerView) {}
export class B2bLedgerPageDto extends createZodDto(pageOf(ledgerView)) {}
export class SrShopDetailDto extends createZodDto(
  shopView.extend({
    /** Portal: only this SR's own entries. Admin uses the ledger endpoint instead. */
    ledger: z.array(ledgerView),
  }),
) {}

// ---- portal --------------------------------------------------------------

const monthStats = z.object({
  month: z.string(),
  targetP: z.number().int(),
  /** Sum of totals of sales approved in the month. */
  soldP: z.number().int(),
  /** Payment at sale (approved sales) + confirmed due collections in the month (Q120 base). */
  collectedP: z.number().int(),
  commissionP: z.number().int(),
  /** Own sale dues minus own confirmed collections, never below 0. */
  dueOutstandingP: z.number().int(),
  /** Collections recorded but not yet confirmed by staff. */
  pendingCollectionP: z.number().int(),
});

export class SrPortalMeDto extends createZodDto(
  z.object({
    staff: nameRef,
    profile: z.object({ area: z.string().nullable(), commissionBp: z.number().int() }),
    month: monthStats,
  }),
) {}

export class SrPortalProductsQueryDto extends createZodDto(
  z.object({ q: z.string().trim().max(100).optional() }),
) {}

export class SrPortalProductDto extends createZodDto(
  z.object({
    variantId: z.uuid(),
    sku: z.string(),
    titleEn: z.string(),
    titleBn: z.string().nullable(),
    optionsText: z.string(),
    optionsTextBn: z.string(),
    image: imageSet.nullable(),
    priceP: z.number().int(),
    available: z.number().int(),
  }),
) {}

export class SrShopsQueryDto extends createZodDto(
  z.object({ q: z.string().trim().max(100).optional(), page, pageSize }),
) {}

export class SrCreateShopDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(150),
    ownerName: z.string().trim().max(150).nullable().optional(),
    phone: z.string().trim().min(5).max(20),
    address: z.string().trim().min(1).max(500),
    area: z.string().trim().max(100).nullable().optional(),
  }),
) {}

export class SrSalesQueryDto extends createZodDto(
  z.object({ status: z.enum(SALE_STATUSES).optional(), page, pageSize }),
) {}

export class SrCreateSaleDto extends createZodDto(
  z.object({
    b2bShopId: z.uuid(),
    items: z
      .array(
        z.object({
          variantId: z.uuid(),
          qty: z.number().int().min(1).max(100_000),
          unitPriceP: moneyP,
        }),
      )
      .min(1)
      .max(100),
    paidAtSaleP: moneyP.default(0),
    note: z.string().trim().max(500).nullable().optional(),
  }),
) {}

export class SrMemoQueryDto extends createZodDto(
  z.object({ lang: z.enum(['en', 'bn']).default('en') }),
) {}

export class SrCreateCollectionDto extends createZodDto(
  z.object({
    b2bShopId: z.uuid(),
    amountP: z.number().int().min(1).max(MAX_MONEY_P),
    method: z.enum(COLLECTION_METHODS),
    note: z.string().trim().max(500).nullable().optional(),
  }),
) {}

export class SrCollectionsQueryDto extends createZodDto(z.object({ page, pageSize })) {}

// ---- admin: sales --------------------------------------------------------

export class SrAdminSalesQueryDto extends createZodDto(
  z.object({
    status: z.enum(SALE_STATUSES).optional(),
    srId: z.uuid().optional(),
    shopId: z.uuid().optional(),
    page,
    pageSize,
  }),
) {}

export class SrRejectSaleDto extends createZodDto(
  z.object({ reason: z.string().trim().min(1).max(500) }),
) {}

// ---- admin: shops + ledger -----------------------------------------------

export class B2bShopsQueryDto extends createZodDto(
  z.object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(['active', 'blocked']).optional(),
    isNew: z.enum(['true', 'false']).optional(),
    hasDue: z.enum(['true', 'false']).optional(),
    page,
    pageSize,
  }),
) {}

export class B2bUpdateShopDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(150).optional(),
    ownerName: z.string().trim().max(150).nullable().optional(),
    phone: z.string().trim().min(5).max(20).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    area: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    /** Send false to clear the "new" review flag. */
    isNew: z.boolean().optional(),
    status: z.enum(['active', 'blocked']).optional(),
  }),
) {}

export class B2bLedgerQueryDto extends createZodDto(z.object({ page, pageSize })) {}

export class B2bCollectionsQueryDto extends createZodDto(
  z.object({
    status: z.enum(['pending', 'confirmed', 'all']).default('pending'),
    page,
    pageSize,
  }),
) {}

export class B2bAdjustDto extends createZodDto(
  z.object({
    /** Signed: + adds due, - reduces it. */
    amountP: z
      .number()
      .int()
      .min(-MAX_MONEY_P)
      .max(MAX_MONEY_P)
      .refine((n) => n !== 0, 'amountP must not be 0'),
    note: z.string().trim().min(1).max(500),
  }),
) {}

// ---- admin: profiles, targets, commissions --------------------------------

const profileView = z.object({
  staffId: z.uuid(),
  name: z.string(),
  email: z.string(),
  disabled: z.boolean(),
  area: z.string().nullable(),
  /** null = store default. */
  commissionBp: z.number().int().nullable(),
  effectiveCommissionBp: z.number().int(),
});
export class SrProfileDto extends createZodDto(profileView) {}
export class SrProfileListDto extends createZodDto(z.array(profileView)) {}

export class SrUpdateProfileDto extends createZodDto(
  z.object({
    area: z.string().trim().max(100).nullable().optional(),
    commissionBp: z.number().int().min(0).max(10_000).nullable().optional(),
  }),
) {}

export class SrMonthQueryDto extends createZodDto(z.object({ month: month.optional() })) {}
export class SrMonthRequiredQueryDto extends createZodDto(z.object({ month })) {}

const targetsView = z.object({
  month: z.string(),
  items: z.array(
    z.object({ srStaffId: z.uuid(), name: z.string(), targetP: z.number().int().nullable() }),
  ),
});
export class SrTargetsDto extends createZodDto(targetsView) {}

export class SrSetTargetsDto extends createZodDto(
  z.object({
    targets: z
      .array(z.object({ srStaffId: z.uuid(), targetP: moneyP }))
      .min(1)
      .max(500),
  }),
) {}

export class SrSummaryDto extends createZodDto(
  z.object({
    month: z.string(),
    items: z.array(
      monthStats.omit({ month: true }).extend({ srStaffId: z.uuid(), name: z.string() }),
    ),
  }),
) {}

const commissionView = z.object({
  id: z.uuid(),
  sr: nameRef,
  month: z.string(),
  baseP: z.number().int(),
  commissionBp: z.number().int(),
  amountP: z.number().int(),
  status: z.enum(['pending', 'approved', 'paid']),
  paidAt: iso.nullable(),
});
export type SrCommissionView = z.infer<typeof commissionView>;
export class SrCommissionDto extends createZodDto(commissionView) {}
export class SrCommissionListDto extends createZodDto(
  z.object({ month: z.string(), items: z.array(commissionView) }),
) {}
export class SrCommissionComputeDto extends createZodDto(
  z.object({
    month: z.string(),
    items: z.array(commissionView),
    /** Rows left alone because they were already approved or paid. */
    skipped: z.number().int(),
  }),
) {}

export class B2bAdjustResultDto extends createZodDto(
  z.object({ entry: ledgerView, dueBalanceP: z.number().int() }),
) {}
