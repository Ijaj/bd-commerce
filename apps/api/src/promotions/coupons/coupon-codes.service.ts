import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponError } from './coupons.errors';

/** No 0/O/1/I: codes get read out over the phone and typed from print. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODES_PER_COUPON = 50_000;

export interface GenerateInput {
  count: number;
  prefix?: string | undefined;
  length: number;
}

export interface CodeListQuery {
  status?: 'used' | 'unused' | undefined;
  q?: string | undefined;
  page: number;
  limit: number;
}

function randomPart(length: number) {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** CSV cells starting with = + - @ are formulas to a spreadsheet; none of ours do, but guard anyway. */
function cell(v: string) {
  const safe = /^[=+@-]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

@Injectable()
export class CouponCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(couponId: string, input: GenerateInput) {
    const coupon = await this.bulkCoupon(couponId);
    const existing = await this.prisma.couponCode.count({ where: { couponId } });
    if (existing + input.count > MAX_CODES_PER_COUPON) {
      throw new CouponError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'COUPON_CODES_LIMIT',
        `At most ${MAX_CODES_PER_COUPON} codes per coupon.`,
      );
    }
    const prefix = input.prefix ? `${input.prefix.toUpperCase()}-` : '';
    let made = 0;
    // Collisions are rare; a few rounds top up whatever the unique index skipped.
    for (let round = 0; round < 10 && made < input.count; round++) {
      const batch = new Set<string>();
      while (batch.size < input.count - made) batch.add(`${prefix}${randomPart(input.length)}`);
      const codes = [...batch];
      // A bulk code must not equal a single coupon's code either (one namespace).
      const clash = new Set(
        (
          await this.prisma.coupon.findMany({
            where: { code: { in: codes } },
            select: { code: true },
          })
        ).map((c) => c.code),
      );
      const res = await this.prisma.couponCode.createMany({
        data: codes.filter((c) => !clash.has(c)).map((code) => ({ couponId: coupon.id, code })),
        skipDuplicates: true,
      });
      made += res.count;
    }
    if (made < input.count) {
      throw new CouponError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'COUPON_CODES_LIMIT',
        'Could not find enough unused codes; use a longer length or another prefix.',
        { generated: made },
      );
    }
    return { generated: made, total: existing + made };
  }

  async list(couponId: string, q: CodeListQuery) {
    await this.bulkCoupon(couponId);
    const where: Prisma.CouponCodeWhereInput = {
      couponId,
      ...(q.status === 'used' ? { usedAt: { not: null } } : {}),
      ...(q.status === 'unused' ? { usedAt: null } : {}),
      ...(q.q ? { code: { contains: q.q.toUpperCase() } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.couponCode.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { assignedCustomer: { select: { id: true, name: true, phone: true } } },
      }),
      this.prisma.couponCode.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        usedAt: r.usedAt?.toISOString() ?? null,
        assignedCustomer: r.assignedCustomer,
      })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async exportCsv(couponId: string) {
    await this.bulkCoupon(couponId);
    const lines = ['code,status,used_at,assigned_phone'];
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.couponCode.findMany({
        where: { couponId },
        orderBy: { id: 'asc' },
        take: 2000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { assignedCustomer: { select: { phone: true } } },
      });
      for (const r of rows) {
        lines.push(
          [
            cell(r.code),
            r.usedAt ? 'used' : 'unused',
            r.usedAt?.toISOString() ?? '',
            cell(r.assignedCustomer?.phone ?? ''),
          ].join(','),
        );
      }
      const last = rows.at(-1);
      if (!last || rows.length < 2000) break;
      cursor = last.id;
    }
    return `${lines.join('\n')}\n`;
  }

  /** All-or-nothing: hands `count` unused, unassigned codes to the customer. */
  async assign(couponId: string, customerId: string, count: number) {
    await this.bulkCoupon(couponId);
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer)
      throw new CouponError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
    const codes = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ code: string }[]>(Prisma.sql`
        UPDATE coupon_codes SET assigned_customer_id = ${customerId}::uuid
        WHERE id IN (
          SELECT id FROM coupon_codes
          WHERE coupon_id = ${couponId}::uuid AND used_at IS NULL AND assigned_customer_id IS NULL
          ORDER BY id LIMIT ${count} FOR UPDATE SKIP LOCKED
        ) RETURNING code`);
      if (rows.length < count) {
        throw new CouponError(
          HttpStatus.CONFLICT,
          'COUPON_NOT_ENOUGH_CODES',
          `Only ${rows.length} unassigned unused codes left.`,
          { available: rows.length },
        );
      }
      return rows.map((r) => r.code).sort();
    });
    return { assigned: codes.length, codes };
  }

  private async bulkCoupon(couponId: string) {
    const c = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, isBulk: true },
    });
    if (!c) throw new CouponError(HttpStatus.NOT_FOUND, 'COUPON_NOT_FOUND', 'Coupon not found.');
    if (!c.isBulk) {
      throw new CouponError(
        HttpStatus.CONFLICT,
        'COUPON_NOT_BULK',
        'This coupon does not use bulk codes.',
      );
    }
    return c;
  }
}
