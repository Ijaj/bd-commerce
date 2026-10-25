import { z } from 'zod';

export const couponKind = z.enum(['code', 'auto']);
export const couponType = z.enum(['percent', 'fixed', 'free_delivery', 'bxgy', 'tiered', 'bundle']);
export const couponStatus = z.enum(['draft', 'active', 'paused']);
export const couponPhase = z.enum(['draft', 'scheduled', 'live', 'paused', 'expired', 'exhausted']);
export const couponVisibility = z.enum(['public', 'hidden']);
export const couponSegment = z.enum(['all', 'first_order', 'specific', 'inactive_days']);
export const couponPlatform = z.enum(['web', 'app', 'both']);
export const targetType = z.enum(['product', 'category', 'brand']);

const paisa = z.number().int().min(1).max(2_000_000_000);
const count = z.number().int().min(1).max(1_000_000);
const text = (max: number) => z.string().trim().max(max);

/** Shared by create (name/kind/type required) and update (kind fixed, rest optional). */
export const couponFields = z.object({
  name: z.string().trim().min(1).max(120),
  kind: couponKind,
  /** Case-insensitive on input; stored upper-case. */
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{3,32}$/, 'Use 3 to 32 letters, digits, - or _')
    .nullable()
    .optional(),
  isBulk: z.boolean().optional(),
  termsEn: text(2000).nullable().optional(),
  termsBn: text(2000).nullable().optional(),
  visibility: couponVisibility.optional(),
  isCollectable: z.boolean().optional(),
  type: couponType,
  /** percent: basis points (1..10000); fixed: paisa; other types 0. */
  value: z.number().int().min(0).max(2_000_000_000).optional(),
  maxDiscountP: paisa.nullable().optional(),
  /** bxgy / bundle only; validated against the shared zod schemas. */
  config: z.record(z.string(), z.unknown()).optional(),
  minOrderP: paisa.nullable().optional(),
  minQty: z.number().int().min(1).max(10_000).nullable().optional(),
  startsAt: z.iso.datetime().nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  segment: couponSegment.optional(),
  segmentParam: z.number().int().min(1).max(3650).nullable().optional(),
  paymentMethods: z
    .array(z.string().regex(/^[a-z_]{2,20}$/))
    .max(10)
    .optional(),
  platform: couponPlatform.optional(),
  maxUsesTotal: count.nullable().optional(),
  maxPerCustomer: count.nullable().optional(),
  maxPerPhone: count.nullable().optional(),
  maxPerDevice: count.nullable().optional(),
  budgetCapP: paisa.nullable().optional(),
  stacksWithSalePrice: z.boolean().optional(),
  stacksWithOtherCoupons: z.boolean().optional(),
  stacksWithPoints: z.boolean().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  targets: z
    .array(
      z.object({
        targetType,
        targetId: z.uuid(),
        mode: z.enum(['include', 'exclude']),
      }),
    )
    .max(200)
    .optional(),
  zoneIds: z.array(z.uuid()).max(100).optional(),
  tiers: z
    .array(z.object({ minSpendP: z.number().int().min(0).max(2_000_000_000), discountP: paisa }))
    .max(20)
    .optional(),
  customerIds: z.array(z.uuid()).max(500).optional(),
});

export const couponCreateSchema = couponFields;
export const couponUpdateSchema = couponFields.omit({ kind: true }).partial();

const iso = z.iso.datetime();

export const couponListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: couponKind,
  code: z.string().nullable(),
  isBulk: z.boolean(),
  type: couponType,
  value: z.number().int(),
  status: couponStatus,
  phase: couponPhase,
  visibility: couponVisibility,
  isCollectable: z.boolean(),
  startsAt: iso.nullable(),
  endsAt: iso.nullable(),
  usesCount: z.number().int(),
  discountGivenP: z.number().int(),
  maxUsesTotal: z.number().int().nullable(),
  budgetCapP: z.number().int().nullable(),
  priority: z.number().int(),
  createdAt: iso,
});

export const couponDetailSchema = couponListItemSchema.extend({
  termsEn: z.string().nullable(),
  termsBn: z.string().nullable(),
  maxDiscountP: z.number().int().nullable(),
  config: z.record(z.string(), z.unknown()),
  minOrderP: z.number().int().nullable(),
  minQty: z.number().int().nullable(),
  segment: couponSegment,
  segmentParam: z.number().int().nullable(),
  paymentMethods: z.array(z.string()),
  platform: couponPlatform,
  maxPerCustomer: z.number().int().nullable(),
  maxPerPhone: z.number().int().nullable(),
  maxPerDevice: z.number().int().nullable(),
  stacksWithSalePrice: z.boolean(),
  stacksWithOtherCoupons: z.boolean(),
  stacksWithPoints: z.boolean(),
  source: z.enum(['manual', 'referral_signup', 'referral_reward', 'system']),
  updatedAt: iso,
  targets: z.array(
    z.object({
      targetType,
      targetId: z.uuid(),
      mode: z.enum(['include', 'exclude']),
      /** Product title, category or brand name; null if it was deleted since. */
      label: z.string().nullable(),
    }),
  ),
  zones: z.array(z.object({ id: z.uuid(), name: z.string() })),
  tiers: z.array(z.object({ minSpendP: z.number().int(), discountP: z.number().int() })),
  customers: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
    }),
  ),
  codeStats: z.object({
    total: z.number().int(),
    used: z.number().int(),
    assigned: z.number().int(),
  }),
});
