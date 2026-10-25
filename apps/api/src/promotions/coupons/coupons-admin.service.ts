import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { invalid, notFound } from './coupon-helpers';
import { type CouponRow, detailInclude, shapeOf, toDetail, toListItem } from './coupon-mapper';
import { targetLabels } from './coupon-refs';
import { activationIssues, type CouponPhase, couponPhase, shapeIssues } from './coupon-validation';
import { CouponError } from './coupons.errors';

export interface ListQuery {
  kind?: 'code' | 'auto';
  status?: 'draft' | 'active' | 'paused';
  type?: 'percent' | 'fixed' | 'free_delivery' | 'bxgy' | 'tiered' | 'bundle';
  q?: string;
  phase?: CouponPhase;
  page: number;
  limit: number;
}

const PHASE_STATUS: Record<CouponPhase, 'draft' | 'active' | 'paused'> = {
  draft: 'draft',
  paused: 'paused',
  scheduled: 'active',
  live: 'active',
  expired: 'active',
  exhausted: 'active',
};

@Injectable()
export class CouponsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListQuery) {
    const now = new Date();
    const where: Prisma.CouponWhereInput = {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { code: { contains: q.q.toUpperCase() } },
            ],
          }
        : {}),
    };
    const status = q.phase ? PHASE_STATUS[q.phase] : q.status;
    if (q.phase && q.status && q.status !== status)
      return { items: [], total: 0, page: q.page, limit: q.limit };
    if (status) where.status = status;
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    // Phase also depends on counters vs limits, so it is filtered after loading (the table is small).
    if (q.phase && PHASE_STATUS[q.phase] === 'active') {
      const all = (await this.prisma.coupon.findMany({ where, orderBy })).filter(
        (c) => couponPhase(c, now) === q.phase,
      );
      const items = all
        .slice((q.page - 1) * q.limit, q.page * q.limit)
        .map((c) => toListItem(c, now));
      return { items, total: all.length, page: q.page, limit: q.limit };
    }
    const [rows, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items: rows.map((c) => toListItem(c, now)), total, page: q.page, limit: q.limit };
  }

  async detail(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id }, include: detailInclude });
    if (!c) throw notFound();
    return this.present(c);
  }

  async activate(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id }, include: detailInclude });
    if (!c) throw notFound();
    const codes = await this.prisma.couponCode.count({ where: { couponId: id } });
    const shape = shapeOf(c);
    const issues = [
      ...shapeIssues(shape),
      ...activationIssues(shape, { customers: c.customers.length, codes }),
    ];
    if (issues.length > 0) throw invalid(issues);
    if (c.status !== 'active')
      await this.prisma.coupon.update({ where: { id }, data: { status: 'active' } });
    return this.detail(id);
  }

  /** Pausing a draft makes no sense; pausing a paused coupon is a no-op. */
  async pause(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id }, select: { status: true } });
    if (!c) throw notFound();
    if (c.status === 'draft') {
      throw new CouponError(
        HttpStatus.CONFLICT,
        'COUPON_LOCKED',
        'A draft coupon is not live; edit or delete it.',
      );
    }
    if (c.status === 'active')
      await this.prisma.coupon.update({ where: { id }, data: { status: 'paused' } });
    return this.detail(id);
  }

  /** Copies settings, targets, zones, tiers and customers as a draft; the code and bulk codes are not copied. */
  async duplicate(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id }, include: detailInclude });
    if (!c) throw notFound();
    const copy = await this.prisma.coupon.create({
      data: {
        name: `${c.name} (copy)`.slice(0, 120),
        kind: c.kind,
        code: null,
        isBulk: c.isBulk,
        termsEn: c.termsEn,
        termsBn: c.termsBn,
        visibility: c.visibility,
        isCollectable: c.isCollectable,
        status: 'draft',
        type: c.type,
        value: c.value,
        maxDiscountP: c.maxDiscountP,
        config: c.config as Prisma.InputJsonValue,
        minOrderP: c.minOrderP,
        minQty: c.minQty,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        segment: c.segment,
        segmentParam: c.segmentParam,
        paymentMethods: c.paymentMethods,
        platform: c.platform,
        maxUsesTotal: c.maxUsesTotal,
        maxPerCustomer: c.maxPerCustomer,
        maxPerPhone: c.maxPerPhone,
        maxPerDevice: c.maxPerDevice,
        budgetCapP: c.budgetCapP,
        stacksWithSalePrice: c.stacksWithSalePrice,
        stacksWithOtherCoupons: c.stacksWithOtherCoupons,
        stacksWithPoints: c.stacksWithPoints,
        priority: c.priority,
        targets: {
          create: c.targets.map((t) => ({
            targetType: t.targetType,
            targetId: t.targetId,
            mode: t.mode,
          })),
        },
        zones: { create: c.zones.map((z) => ({ zoneId: z.zoneId })) },
        tiers: { create: c.tiers.map((t) => ({ minSpendP: t.minSpendP, discountP: t.discountP })) },
        customers: { create: c.customers.map((x) => ({ customerId: x.customerId })) },
      },
    });
    return this.detail(copy.id);
  }

  async remove(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw notFound();
    if ((await this.prisma.couponRedemption.count({ where: { couponId: id } })) > 0) {
      throw new CouponError(
        HttpStatus.CONFLICT,
        'COUPON_REDEEMED',
        'This coupon was already used; pause it instead of deleting.',
      );
    }
    await this.prisma.coupon.delete({ where: { id } });
  }

  /** Staff picks customers for a specific-audience coupon by phone, email or name. */
  async customerLookup(q: string) {
    const digits = q.replace(/\D/g, '');
    const rows = await this.prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q.toLowerCase() } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return { items: rows };
  }

  private async present(c: CouponRow) {
    const [labels, total, used, assigned] = await Promise.all([
      targetLabels(this.prisma, c.targets),
      this.prisma.couponCode.count({ where: { couponId: c.id } }),
      this.prisma.couponCode.count({ where: { couponId: c.id, usedAt: { not: null } } }),
      this.prisma.couponCode.count({
        where: { couponId: c.id, assignedCustomerId: { not: null } },
      }),
    ]);
    return toDetail(c, new Date(), labels, { total, used, assigned });
  }
}
