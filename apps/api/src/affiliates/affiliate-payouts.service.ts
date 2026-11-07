import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { openDetails } from './affiliate-payout-details';
import type {
  AffiliateDueListDto,
  AffiliatePayoutCreateDto,
  AffiliatePayoutListDto,
  AffiliatePayoutListQueryDto,
} from './affiliates.dto';
import { AffiliateError } from './affiliates.errors';

const DHAKA_OFFSET_MS = 6 * 60 * 60_000;

/** YYYY-MM in Bangladesh time. */
export function dhakaPeriod(d: Date) {
  const s = new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString();
  return s.slice(0, 7);
}

const payoutInclude = {
  affiliate: { select: { id: true, code: true, displayName: true } },
  paidBy: { select: { id: true, name: true } },
} satisfies Prisma.AffiliatePayoutInclude;

export function payoutRow(p: Prisma.AffiliatePayoutGetPayload<{ include: typeof payoutInclude }>) {
  return {
    id: p.id,
    affiliate: p.affiliate,
    period: p.period,
    amountP: p.amountP,
    method: p.method as 'bkash' | 'bank' | 'cash',
    reference: p.reference,
    note: p.note,
    paidBy: p.paidBy,
    paidAt: p.paidAt.toISOString(),
  };
}

/** Monthly payouts (Q78): staff pay outside the system, then record it here with a reference. */
@Injectable()
export class AffiliatePayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Affiliates whose approved, unpaid balance reaches the minimum (smaller balances carry over). */
  async due(): Promise<AffiliateDueListDto> {
    const { minPayoutP } = await this.settings.get('affiliates');
    const sums = await this.prisma.affiliateCommission.groupBy({
      by: ['affiliateId'],
      where: { status: 'approved', payoutId: null },
      _sum: { amountP: true },
      _count: { _all: true },
      having: { amountP: { _sum: { gte: Math.max(1, minPayoutP) } } },
    });
    if (sums.length === 0) return { items: [] };
    const affiliates = await this.prisma.affiliate.findMany({
      where: { id: { in: sums.map((s) => s.affiliateId) } },
    });
    const byId = new Map(affiliates.map((a) => [a.id, a]));
    const items = sums.flatMap((s) => {
      const a = byId.get(s.affiliateId);
      if (!a) return [];
      const details = openDetails(a.payoutDetailsEnc, this.env.AFFILIATE_PAYOUT_KEY);
      return [
        {
          affiliateId: a.id,
          code: a.code,
          displayName: a.displayName,
          balanceP: s._sum.amountP ?? 0,
          commissionCount: s._count._all,
          payoutMethod: details?.method ?? null,
          payoutDetails: details,
          hasPayoutDetails: details !== null,
        },
      ];
    });
    items.sort((x, y) => y.balanceP - x.balanceP || x.code.localeCompare(y.code));
    return { items };
  }

  /** Pays out every approved commission of the affiliate; the amount must match what staff saw. */
  async record(affiliateId: string, staffId: string, body: AffiliatePayoutCreateDto) {
    const { minPayoutP } = await this.settings.get('affiliates');
    const now = new Date();
    const payout = await this.prisma.$transaction(async (tx) => {
      const aff = await tx.affiliate.findUnique({
        where: { id: affiliateId },
        select: { id: true },
      });
      if (!aff) {
        throw new AffiliateError(
          HttpStatus.NOT_FOUND,
          'AFFILIATE_NOT_FOUND',
          'Affiliate not found.',
        );
      }
      // Row locks: a parallel payout for the same affiliate waits, then finds nothing left.
      const rows = await tx.$queryRaw<{ id: string; amount_p: number }[]>(Prisma.sql`
        SELECT id, amount_p FROM affiliate_commissions
        WHERE affiliate_id = ${affiliateId}::uuid AND status = 'approved' AND payout_id IS NULL
        ORDER BY id FOR UPDATE`);
      const sum = rows.reduce((n, r) => n + r.amount_p, 0);
      if (rows.length === 0 || sum === 0) {
        throw new AffiliateError(
          HttpStatus.CONFLICT,
          'AFFILIATE_NOTHING_DUE',
          'No approved commission is waiting for payout.',
        );
      }
      if (sum !== body.expectedAmountP) {
        throw new AffiliateError(
          HttpStatus.CONFLICT,
          'AFFILIATE_PAYOUT_CHANGED',
          'The balance changed since you opened it. Reload and check the amount.',
          { currentAmountP: sum },
        );
      }
      if (sum < minPayoutP) {
        throw new AffiliateError(
          HttpStatus.CONFLICT,
          'AFFILIATE_BELOW_MIN',
          'The balance is below the minimum payout; it carries over.',
          { minPayoutP, balanceP: sum },
        );
      }
      const created = await tx.affiliatePayout.create({
        data: {
          affiliateId,
          period: dhakaPeriod(now),
          amountP: sum,
          method: body.method,
          reference: body.reference,
          note: body.note ?? null,
          paidById: staffId,
          paidAt: now,
        },
        include: payoutInclude,
      });
      await tx.affiliateCommission.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: 'paid', payoutId: created.id },
      });
      return created;
    });
    return payoutRow(payout);
  }

  async list(q: AffiliatePayoutListQueryDto): Promise<AffiliatePayoutListDto> {
    const where: Prisma.AffiliatePayoutWhereInput = q.affiliateId
      ? { affiliateId: q.affiliateId }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.affiliatePayout.findMany({
        where,
        include: payoutInclude,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.affiliatePayout.count({ where }),
    ]);
    return { items: rows.map(payoutRow), total };
  }
}
