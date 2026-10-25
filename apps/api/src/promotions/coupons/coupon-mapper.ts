import type { Prisma } from '../../generated/prisma/client';
import { type CouponShape, couponPhase } from './coupon-validation';

export const detailInclude = {
  targets: true,
  zones: { include: { zone: { select: { id: true, nameEn: true } } } },
  tiers: { orderBy: { minSpendP: 'asc' } },
  customers: {
    include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
  },
} satisfies Prisma.CouponInclude;

export type CouponRow = Prisma.CouponGetPayload<{ include: typeof detailInclude }>;
export type CouponBase = Prisma.CouponGetPayload<object>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toListItem(c: CouponBase, now: Date) {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    code: c.code,
    isBulk: c.isBulk,
    type: c.type,
    value: c.value,
    status: c.status,
    phase: couponPhase(c, now),
    visibility: c.visibility,
    isCollectable: c.isCollectable,
    startsAt: iso(c.startsAt),
    endsAt: iso(c.endsAt),
    usesCount: c.usesCount,
    discountGivenP: c.discountGivenP,
    maxUsesTotal: c.maxUsesTotal,
    budgetCapP: c.budgetCapP,
    priority: c.priority,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toDetail(
  c: CouponRow,
  now: Date,
  labels: Map<string, string>,
  codeStats: { total: number; used: number; assigned: number },
) {
  return {
    ...toListItem(c, now),
    termsEn: c.termsEn,
    termsBn: c.termsBn,
    maxDiscountP: c.maxDiscountP,
    config: c.config as Record<string, unknown>,
    minOrderP: c.minOrderP,
    minQty: c.minQty,
    segment: c.segment,
    segmentParam: c.segmentParam,
    paymentMethods: c.paymentMethods,
    platform: c.platform,
    maxPerCustomer: c.maxPerCustomer,
    maxPerPhone: c.maxPerPhone,
    maxPerDevice: c.maxPerDevice,
    stacksWithSalePrice: c.stacksWithSalePrice,
    stacksWithOtherCoupons: c.stacksWithOtherCoupons,
    stacksWithPoints: c.stacksWithPoints,
    source: c.source,
    updatedAt: c.updatedAt.toISOString(),
    targets: c.targets.map((t) => ({
      targetType: t.targetType as 'product' | 'category' | 'brand',
      targetId: t.targetId,
      mode: t.mode as 'include' | 'exclude',
      label: labels.get(`${t.targetType}:${t.targetId}`) ?? null,
    })),
    zones: c.zones.map((z) => ({ id: z.zone.id, name: z.zone.nameEn })),
    tiers: c.tiers.map((t) => ({ minSpendP: t.minSpendP, discountP: t.discountP })),
    customers: c.customers.map((x) => x.customer),
    codeStats,
  };
}

export function shapeOf(c: CouponRow): CouponShape {
  return {
    kind: c.kind,
    code: c.code,
    isBulk: c.isBulk,
    type: c.type,
    value: c.value,
    config: c.config,
    visibility: c.visibility,
    isCollectable: c.isCollectable,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    segment: c.segment,
    segmentParam: c.segmentParam,
    tiers: c.tiers.map((t) => ({ minSpendP: t.minSpendP, discountP: t.discountP })),
  };
}
