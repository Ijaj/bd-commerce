import { HttpStatus, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { invalid, notFound, taken } from './coupon-helpers';
import { detailInclude, shapeOf } from './coupon-mapper';
import { assertRefs } from './coupon-refs';
import {
  activationIssues,
  type CouponShape,
  normalizeConfig,
  shapeIssues,
} from './coupon-validation';
import { CouponError } from './coupons.errors';
import type { couponCreateSchema, couponUpdateSchema } from './coupons.schemas';
import { CouponsAdminService } from './coupons-admin.service';

type CreateBody = z.infer<typeof couponCreateSchema>;
type UpdateBody = z.infer<typeof couponUpdateSchema>;

const date = (s: string | null | undefined) => (s ? new Date(s) : null);

@Injectable()
export class CouponsWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: CouponsAdminService,
  ) {}

  async create(body: CreateBody) {
    const code = body.code ? body.code.toUpperCase() : null;
    const shape: CouponShape = {
      kind: body.kind,
      code,
      isBulk: body.isBulk ?? false,
      type: body.type,
      value: body.value ?? 0,
      config: body.config ?? {},
      visibility: body.visibility ?? 'hidden',
      isCollectable: body.isCollectable ?? false,
      startsAt: date(body.startsAt),
      endsAt: date(body.endsAt),
      segment: body.segment ?? 'all',
      segmentParam: body.segmentParam ?? null,
      tiers: sortedTiers(body.tiers),
    };
    this.assertShape(shape);
    const targets = dedupeTargets(body.targets);
    const id = await this.prisma.$transaction(async (tx) => {
      await assertRefs(tx, {
        targets,
        zoneIds: body.zoneIds ?? [],
        customerIds: body.customerIds ?? [],
        type: shape.type,
        config: shape.config,
      });
      if (code) await this.assertCodeFree(tx, code, null);
      try {
        const c = await tx.coupon.create({
          data: {
            name: body.name,
            kind: shape.kind,
            code,
            isBulk: shape.isBulk,
            termsEn: body.termsEn ?? null,
            termsBn: body.termsBn ?? null,
            visibility: shape.visibility,
            isCollectable: shape.isCollectable,
            type: shape.type,
            value: shape.value,
            maxDiscountP: body.maxDiscountP ?? null,
            config: normalizeConfig(shape.type, shape.config) as Prisma.InputJsonValue,
            minOrderP: body.minOrderP ?? null,
            minQty: body.minQty ?? null,
            startsAt: shape.startsAt,
            endsAt: shape.endsAt,
            segment: shape.segment,
            segmentParam: shape.segmentParam,
            paymentMethods: body.paymentMethods ?? [],
            platform: body.platform ?? 'both',
            maxUsesTotal: body.maxUsesTotal ?? null,
            maxPerCustomer: body.maxPerCustomer ?? null,
            maxPerPhone: body.maxPerPhone ?? null,
            maxPerDevice: body.maxPerDevice ?? null,
            budgetCapP: body.budgetCapP ?? null,
            stacksWithSalePrice: body.stacksWithSalePrice ?? false,
            stacksWithOtherCoupons: body.stacksWithOtherCoupons ?? false,
            stacksWithPoints: body.stacksWithPoints ?? true,
            priority: body.priority ?? 0,
            targets: { create: targets },
            zones: { create: unique(body.zoneIds ?? []).map((zoneId) => ({ zoneId })) },
            tiers: { create: shape.tiers },
            customers: {
              create: unique(body.customerIds ?? []).map((customerId) => ({ customerId })),
            },
          },
        });
        return c.id;
      } catch (e) {
        throw mapUnique(e);
      }
    });
    return this.admin.detail(id);
  }

  async update(id: string, body: UpdateBody) {
    await this.prisma.$transaction(async (tx) => {
      const cur = await tx.coupon.findUnique({ where: { id }, include: detailInclude });
      if (!cur) throw notFound();
      const code = body.code === undefined ? cur.code : body.code ? body.code.toUpperCase() : null;
      const shape: CouponShape = {
        ...shapeOf(cur),
        code,
        isBulk: body.isBulk ?? cur.isBulk,
        type: body.type ?? cur.type,
        value: body.value ?? cur.value,
        config: body.config ?? cur.config,
        visibility: body.visibility ?? cur.visibility,
        isCollectable: body.isCollectable ?? cur.isCollectable,
        startsAt: body.startsAt === undefined ? cur.startsAt : date(body.startsAt),
        endsAt: body.endsAt === undefined ? cur.endsAt : date(body.endsAt),
        segment: body.segment ?? cur.segment,
        segmentParam: body.segmentParam === undefined ? cur.segmentParam : body.segmentParam,
        tiers: body.tiers ? sortedTiers(body.tiers) : shapeOf(cur).tiers,
      };
      if (
        (shape.type !== cur.type || shape.isBulk !== cur.isBulk || code !== cur.code) &&
        (await tx.couponRedemption.count({ where: { couponId: id } })) > 0
      ) {
        throw new CouponError(
          HttpStatus.CONFLICT,
          'COUPON_LOCKED',
          'Type, code and bulk mode cannot change once the coupon was redeemed.',
        );
      }
      this.assertShape(shape);
      const targets = body.targets ? dedupeTargets(body.targets) : null;
      const zoneIds = body.zoneIds ? unique(body.zoneIds) : null;
      const customerIds = body.customerIds ? unique(body.customerIds) : null;
      await assertRefs(tx, {
        targets: targets ?? [],
        zoneIds: zoneIds ?? [],
        customerIds: customerIds ?? [],
        type: shape.type,
        config: shape.config,
      });
      if (cur.status === 'active') {
        const codes = await tx.couponCode.count({ where: { couponId: id } });
        const customers = customerIds
          ? customerIds.length
          : await tx.couponCustomer.count({ where: { couponId: id } });
        const issues = activationIssues(shape, { customers, codes });
        if (issues.length > 0) throw invalid(issues);
      }
      if (code && code !== cur.code) await this.assertCodeFree(tx, code, id);
      try {
        await tx.coupon.update({
          where: { id },
          data: {
            name: body.name,
            code,
            isBulk: shape.isBulk,
            termsEn: body.termsEn,
            termsBn: body.termsBn,
            visibility: shape.visibility,
            isCollectable: shape.isCollectable,
            type: shape.type,
            value: shape.value,
            maxDiscountP: body.maxDiscountP,
            config: normalizeConfig(shape.type, shape.config) as Prisma.InputJsonValue,
            minOrderP: body.minOrderP,
            minQty: body.minQty,
            startsAt: shape.startsAt,
            endsAt: shape.endsAt,
            segment: shape.segment,
            segmentParam: shape.segmentParam,
            paymentMethods: body.paymentMethods,
            platform: body.platform,
            maxUsesTotal: body.maxUsesTotal,
            maxPerCustomer: body.maxPerCustomer,
            maxPerPhone: body.maxPerPhone,
            maxPerDevice: body.maxPerDevice,
            budgetCapP: body.budgetCapP,
            stacksWithSalePrice: body.stacksWithSalePrice,
            stacksWithOtherCoupons: body.stacksWithOtherCoupons,
            stacksWithPoints: body.stacksWithPoints,
            priority: body.priority,
          },
        });
      } catch (e) {
        throw mapUnique(e);
      }
      if (targets) {
        await tx.couponTarget.deleteMany({ where: { couponId: id } });
        await tx.couponTarget.createMany({ data: targets.map((t) => ({ ...t, couponId: id })) });
      }
      if (zoneIds) {
        await tx.couponZone.deleteMany({ where: { couponId: id } });
        await tx.couponZone.createMany({
          data: zoneIds.map((zoneId) => ({ zoneId, couponId: id })),
        });
      }
      if (body.tiers) {
        await tx.couponTier.deleteMany({ where: { couponId: id } });
        await tx.couponTier.createMany({ data: shape.tiers.map((t) => ({ ...t, couponId: id })) });
      }
      if (customerIds) {
        await tx.couponCustomer.deleteMany({ where: { couponId: id } });
        await tx.couponCustomer.createMany({
          data: customerIds.map((customerId) => ({ customerId, couponId: id })),
        });
      }
    });
    return this.admin.detail(id);
  }

  private assertShape(shape: CouponShape) {
    const issues = shapeIssues(shape);
    if (issues.length > 0) throw invalid(issues);
  }

  /** Codes share one namespace: single coupon codes and generated bulk codes. */
  private async assertCodeFree(
    db: Prisma.TransactionClient,
    code: string,
    exceptId: string | null,
  ) {
    const [a, b] = await Promise.all([
      db.coupon.findFirst({
        where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { id: true },
      }),
      db.couponCode.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (a || b) throw taken();
  }
}

function sortedTiers(tiers: CreateBody['tiers']) {
  return [...(tiers ?? [])].sort((a, b) => a.minSpendP - b.minSpendP);
}

function dedupeTargets(targets: CreateBody['targets']) {
  const seen = new Set<string>();
  return (targets ?? []).filter((t) => {
    const k = `${t.targetType}:${t.targetId}:${t.mode}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const unique = <T>(xs: T[]) => [...new Set(xs)];

/** A concurrent insert can still hit the unique index after the pre-check. */
function mapUnique(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return taken();
  return e;
}
