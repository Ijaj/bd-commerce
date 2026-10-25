import type { Prisma } from '../../generated/prisma/client';
import type { CouponCandidate, CouponRow, CouponTargetRow } from './engine.types';

type Db = Prisma.TransactionClient;

export const couponInclude = {
  targets: true,
  zones: { select: { zoneId: true } },
  tiers: true,
  customers: { select: { customerId: true } },
} satisfies Prisma.CouponInclude;

type CouponWithRels = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;

export function toCandidate(
  c: CouponWithRels,
  codeRow: CouponCandidate['codeRow'],
  typedCode: string | null,
): CouponCandidate {
  return {
    coupon: c as CouponRow,
    targets: c.targets as CouponTargetRow[],
    zoneIds: c.zones.map((z) => z.zoneId),
    tiers: c.tiers.map((t) => ({ minSpendP: t.minSpendP, discountP: t.discountP })),
    customerIds: c.customers.map((x) => x.customerId),
    codeRow,
    typedCode,
  };
}

export function liveWindow(now: Date): Prisma.CouponWhereInput {
  return {
    status: 'active',
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

/** Active automatic coupons plus the coupons the typed codes point to (even inactive ones, for the reason). */
export async function loadCandidates(db: Db, now: Date, codes: string[]) {
  const upper = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  // Sequential on purpose: `db` can be a transaction, which runs one query at a time.
  const autos = await db.coupon.findMany({
    where: { kind: 'auto', ...liveWindow(now) },
    include: couponInclude,
  });
  const byCode = upper.length
    ? await db.coupon.findMany({
        where: { kind: 'code', code: { in: upper } },
        include: couponInclude,
      })
    : [];
  const bulk = upper.length
    ? await db.couponCode.findMany({
        where: { code: { in: upper } },
        include: { coupon: { include: couponInclude } },
      })
    : [];
  return [
    ...autos.map((c) => toCandidate(c, null, null)),
    ...byCode.map((c) => toCandidate(c, null, c.code)),
    ...bulk.map((b) =>
      toCandidate(
        b.coupon,
        { id: b.id, assignedCustomerId: b.assignedCustomerId, usedAt: b.usedAt },
        b.code,
      ),
    ),
  ];
}
