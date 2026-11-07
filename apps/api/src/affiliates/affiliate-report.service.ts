import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AffiliateMyCommissionListDto,
  AffiliateMyCommissionQueryDto,
  AffiliateMyPayoutListDto,
  AffiliateMyPayoutQueryDto,
  AffiliateStatsDto,
} from './affiliates.dto';
import { AffiliateError } from './affiliates.errors';

const commissionInclude = {
  order: {
    select: {
      id: true,
      orderNo: true,
      placedAt: true,
      affiliateAttribution: true,
      items: { select: { qty: true, titleSnapshot: true }, orderBy: { id: 'asc' as const } },
    },
  },
} satisfies Prisma.AffiliateCommissionInclude;

export type CommissionRow = Prisma.AffiliateCommissionGetPayload<{
  include: typeof commissionInclude;
}>;

/** Shared by the customer dashboard and the admin list; the buyer is never part of it. */
export function commissionItem(c: CommissionRow) {
  return {
    id: c.id,
    placedAt: c.order.placedAt.toISOString(),
    itemCount: c.order.items.reduce((n, i) => n + i.qty, 0),
    firstItemTitle: c.order.items[0]?.titleSnapshot ?? null,
    attribution: c.order.affiliateAttribution ?? 'link',
    baseP: c.baseP,
    commissionBp: c.commissionBp,
    amountP: c.amountP,
    status: c.status,
    availableAt: c.availableAt?.toISOString() ?? null,
    reverseReason: c.reverseReason,
  };
}

export { commissionInclude };

/** Sums per status for one or many affiliates. */
export async function moneyByAffiliate(db: PrismaService, affiliateIds: string[]) {
  const rows = await db.affiliateCommission.groupBy({
    by: ['affiliateId', 'status'],
    where: { affiliateId: { in: affiliateIds } },
    _sum: { amountP: true },
    _count: { _all: true },
  });
  const out = new Map<
    string,
    { pendingP: number; balanceP: number; paidP: number; reversedCount: number }
  >();
  for (const id of affiliateIds) {
    out.set(id, { pendingP: 0, balanceP: 0, paidP: 0, reversedCount: 0 });
  }
  for (const r of rows) {
    const m = out.get(r.affiliateId);
    if (!m) continue;
    const sum = r._sum.amountP ?? 0;
    if (r.status === 'pending') m.pendingP = sum;
    else if (r.status === 'approved') m.balanceP = sum;
    else if (r.status === 'paid') m.paidP = sum;
    else m.reversedCount = r._count._all;
  }
  return out;
}

@Injectable()
export class AffiliateReportService {
  constructor(private readonly prisma: PrismaService) {}

  private async affiliateId(customerId: string) {
    const a = await this.prisma.affiliate.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!a) {
      throw new AffiliateError(
        HttpStatus.NOT_FOUND,
        'AFFILIATE_NOT_JOINED',
        'You have not joined the affiliate program.',
      );
    }
    return a.id;
  }

  async stats(customerId: string, days: number): Promise<AffiliateStatsDto> {
    const id = await this.affiliateId(customerId);
    // One row per Dhaka calendar day, zeros included, oldest first.
    const rows = await this.prisma.$queryRaw<{ date: string; clicks: number; orders: number }[]>(
      Prisma.sql`
      WITH d AS (
        SELECT generate_series(
          ((now() AT TIME ZONE 'Asia/Dhaka')::date - ${days - 1}::int),
          (now() AT TIME ZONE 'Asia/Dhaka')::date, interval '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
        (SELECT count(*)::int FROM affiliate_clicks c
          WHERE c.affiliate_id = ${id}::uuid AND (c.clicked_at AT TIME ZONE 'Asia/Dhaka')::date = d.day) AS clicks,
        (SELECT count(*)::int FROM orders o
          WHERE o.affiliate_id = ${id}::uuid AND (o.placed_at AT TIME ZONE 'Asia/Dhaka')::date = d.day) AS orders
      FROM d ORDER BY d.day`,
    );
    const clicks = rows.reduce((n, r) => n + r.clicks, 0);
    const orders = rows.reduce((n, r) => n + r.orders, 0);
    const money = (await moneyByAffiliate(this.prisma, [id])).get(id);
    return {
      days: rows,
      totals: {
        clicks,
        orders,
        conversionBp: clicks === 0 ? 0 : Math.round((orders * 10_000) / clicks),
        pendingP: money?.pendingP ?? 0,
        balanceP: money?.balanceP ?? 0,
        paidP: money?.paidP ?? 0,
        reversedCount: money?.reversedCount ?? 0,
      },
    };
  }

  async commissions(
    customerId: string,
    q: AffiliateMyCommissionQueryDto,
  ): Promise<AffiliateMyCommissionListDto> {
    const affiliateId = await this.affiliateId(customerId);
    const where: Prisma.AffiliateCommissionWhereInput = {
      affiliateId,
      ...(q.status ? { status: q.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where,
        include: commissionInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.affiliateCommission.count({ where }),
    ]);
    return { items: rows.map(commissionItem), total };
  }

  async payouts(
    customerId: string,
    q: AffiliateMyPayoutQueryDto,
  ): Promise<AffiliateMyPayoutListDto> {
    const affiliateId = await this.affiliateId(customerId);
    const [rows, total] = await Promise.all([
      this.prisma.affiliatePayout.findMany({
        where: { affiliateId },
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.affiliatePayout.count({ where: { affiliateId } }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id,
        period: p.period,
        amountP: p.amountP,
        method: p.method as 'bkash' | 'bank' | 'cash',
        reference: p.reference,
        paidAt: p.paidAt.toISOString(),
      })),
      total,
    };
  }
}
