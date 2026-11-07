import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { maskDetails, openDetails } from './affiliate-payout-details';
import { commissionInclude, commissionItem, moneyByAffiliate } from './affiliate-report.service';
import type {
  AffiliateAdminCommissionListDto,
  AffiliateAdminCommissionQueryDto,
  AffiliateAdminDetailDto,
  AffiliateAdminListDto,
  AffiliateAdminListQueryDto,
  AffiliateAdminUpdateDto,
} from './affiliates.dto';
import { AffiliateError } from './affiliates.errors';

const DAY_MS = 24 * 60 * 60_000;

const rowInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
} satisfies Prisma.AffiliateInclude;
type Row = Prisma.AffiliateGetPayload<{ include: typeof rowInclude }>;

const notFound = () =>
  new AffiliateError(HttpStatus.NOT_FOUND, 'AFFILIATE_NOT_FOUND', 'Affiliate not found.');

@Injectable()
export class AffiliateAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** List rows: money from commissions, 30-day traffic from clicks and attributed orders. */
  private async rows(list: Row[]) {
    const ids = list.map((a) => a.id);
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [money, clicks, orders, cfg] = await Promise.all([
      moneyByAffiliate(this.prisma, ids),
      this.prisma.affiliateClick.groupBy({
        by: ['affiliateId'],
        where: { affiliateId: { in: ids }, clickedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['affiliateId'],
        where: { affiliateId: { in: ids }, placedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.settings.get('affiliates'),
    ]);
    const c30 = new Map(clicks.map((r) => [r.affiliateId, r._count._all]));
    const o30 = new Map(orders.map((r) => [r.affiliateId, r._count._all]));
    return list.map((a) => ({
      id: a.id,
      code: a.code,
      displayName: a.displayName,
      customer: a.customer,
      status: a.status,
      commissionBp: a.commissionBp ?? cfg.defaultCommissionBp,
      rateOverridden: a.commissionBp !== null,
      clicks30: c30.get(a.id) ?? 0,
      orders30: o30.get(a.id) ?? 0,
      pendingP: money.get(a.id)?.pendingP ?? 0,
      balanceP: money.get(a.id)?.balanceP ?? 0,
      paidP: money.get(a.id)?.paidP ?? 0,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async list(q: AffiliateAdminListQueryDto): Promise<AffiliateAdminListDto> {
    const needle = q.q?.trim();
    const where: Prisma.AffiliateWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(needle
        ? {
            OR: [
              { code: { contains: needle.toUpperCase() } },
              { displayName: { contains: needle, mode: 'insensitive' } },
              { customer: { phone: { contains: needle.replace(/[\s-]/g, '') } } },
              { customer: { email: { contains: needle, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.affiliate.findMany({
        where,
        include: rowInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.affiliate.count({ where }),
    ]);
    return { items: await this.rows(list), total };
  }

  async detail(id: string, canSeePayout: boolean): Promise<AffiliateAdminDetailDto> {
    const a = await this.prisma.affiliate.findUnique({ where: { id }, include: rowInclude });
    if (!a) throw notFound();
    const [row] = await this.rows([a]);
    const details = openDetails(a.payoutDetailsEnc, this.env.AFFILIATE_PAYOUT_KEY);
    return {
      ...(row as NonNullable<typeof row>),
      website: a.website,
      suspendedAt: a.suspendedAt?.toISOString() ?? null,
      suspendedReason: a.suspendedReason,
      payoutMethod: a.payoutMethod === 'bkash' || a.payoutMethod === 'bank' ? a.payoutMethod : null,
      payoutDetails: canSeePayout ? details : maskDetails(details),
    };
  }

  /** Rate changes apply to new orders only: existing commissions keep their snapshot. */
  async update(id: string, body: AffiliateAdminUpdateDto, canSeePayout: boolean) {
    const cur = await this.prisma.affiliate.findUnique({ where: { id }, select: { status: true } });
    if (!cur) throw notFound();
    const data: Prisma.AffiliateUpdateInput = {};
    if (body.commissionBp !== undefined) data.commissionBp = body.commissionBp;
    if (body.status === 'suspended' && cur.status !== 'suspended') {
      if (!body.suspendedReason?.trim()) {
        throw new AffiliateError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'AFFILIATE_SUSPEND_REASON',
          'Say why the affiliate is being suspended.',
        );
      }
      data.status = 'suspended';
      data.suspendedAt = new Date();
      data.suspendedReason = body.suspendedReason.trim();
    } else if (body.status === 'active' && cur.status !== 'active') {
      data.status = 'active';
      data.suspendedAt = null;
      data.suspendedReason = null;
    }
    await this.prisma.affiliate.update({ where: { id }, data });
    return this.detail(id, canSeePayout);
  }

  async commissions(
    id: string,
    q: AffiliateAdminCommissionQueryDto,
  ): Promise<AffiliateAdminCommissionListDto> {
    if (!(await this.prisma.affiliate.findUnique({ where: { id }, select: { id: true } }))) {
      throw notFound();
    }
    const where: Prisma.AffiliateCommissionWhereInput = {
      affiliateId: id,
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
    return {
      items: rows.map((c) => ({
        ...commissionItem(c),
        order: { id: c.order.id, orderNo: c.order.orderNo },
      })),
      total,
    };
  }
}
