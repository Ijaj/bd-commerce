import { HttpStatus, Injectable } from '@nestjs/common';
import type { Coupon, CouponCode } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isExhausted } from './coupon-validation';
import { CouponError } from './coupons.errors';

const EXPIRED_KEEP_MS = 30 * 86_400_000;

export type WalletState = 'usable' | 'expired' | 'used_up' | 'not_started';

type WalletSource = 'collected' | 'assigned' | 'bulk_code';

/** State of a coupon for one customer. `used` = how many times they already redeemed it. */
export function walletState(
  c: Coupon,
  used: number,
  now: Date,
  code: CouponCode | null = null,
): WalletState {
  if (code?.usedAt) return 'used_up';
  if (c.endsAt && c.endsAt <= now) return 'expired';
  if (c.startsAt && c.startsAt > now) return 'not_started';
  if (isExhausted(c)) return 'used_up';
  if (c.maxPerCustomer !== null && used >= c.maxPerCustomer) return 'used_up';
  return 'usable';
}

const ORDER: Record<WalletState, number> = { usable: 0, not_started: 1, used_up: 2, expired: 3 };

@Injectable()
export class CouponsWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string) {
    const now = new Date();
    const [collected, assigned, codes] = await Promise.all([
      this.prisma.couponWallet.findMany({ where: { customerId }, include: { coupon: true } }),
      this.prisma.couponCustomer.findMany({ where: { customerId }, include: { coupon: true } }),
      this.prisma.couponCode.findMany({
        where: { assignedCustomerId: customerId },
        include: { coupon: true },
      }),
    ]);
    const entries = new Map<
      string,
      { coupon: Coupon; code: CouponCode | null; source: WalletSource; collected: boolean }
    >();
    for (const a of assigned) {
      entries.set(a.couponId, {
        coupon: a.coupon,
        code: null,
        source: 'assigned',
        collected: false,
      });
    }
    for (const w of collected) {
      entries.set(w.couponId, {
        coupon: w.coupon,
        code: null,
        source: 'collected',
        collected: true,
      });
    }
    for (const code of codes) {
      entries.set(`code:${code.id}`, {
        coupon: code.coupon,
        code,
        source: 'bulk_code',
        collected: false,
      });
    }

    const live = [...entries.values()].filter(
      (e) =>
        e.coupon.status === 'active' &&
        (!e.coupon.endsAt || e.coupon.endsAt.getTime() > now.getTime() - EXPIRED_KEEP_MS),
    );
    const usedBy = await this.usage(
      customerId,
      live.map((e) => e.coupon.id),
    );
    const items = live.map((e) => this.item(e, usedBy.get(e.coupon.id) ?? 0, now));
    items.sort(
      (a, b) =>
        ORDER[a.state] - ORDER[b.state] ||
        (a.endsAt ?? '9').localeCompare(b.endsAt ?? '9') ||
        a.name.localeCompare(b.name),
    );
    return { items };
  }

  /** Idempotent. Only public, collectable, active coupons; hidden ones answer "not found". */
  async collect(customerId: string, couponId: string) {
    const c = await this.prisma.coupon.findFirst({
      where: { id: couponId, isCollectable: true, visibility: 'public', status: 'active' },
    });
    if (!c) throw new CouponError(HttpStatus.NOT_FOUND, 'COUPON_NOT_FOUND', 'Coupon not found.');
    const now = new Date();
    if ((c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt <= now) || isExhausted(c)) {
      throw new CouponError(
        HttpStatus.CONFLICT,
        'COUPON_NOT_ACTIVE',
        'This coupon is not available right now.',
      );
    }
    await this.prisma.couponWallet.upsert({
      where: { customerId_couponId: { customerId, couponId } },
      create: { customerId, couponId },
      update: {},
    });
    const usedBy = await this.usage(customerId, [couponId]);
    return this.item(
      { coupon: c, code: null, source: 'collected', collected: true },
      usedBy.get(couponId) ?? 0,
      now,
    );
  }

  async uncollect(customerId: string, couponId: string) {
    await this.prisma.couponWallet.deleteMany({ where: { customerId, couponId } });
  }

  private async usage(customerId: string, couponIds: string[]) {
    const rows = await this.prisma.couponRedemption.groupBy({
      by: ['couponId'],
      where: { customerId, status: 'applied', couponId: { in: couponIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.couponId, r._count._all]));
  }

  private item(
    e: { coupon: Coupon; code: CouponCode | null; source: WalletSource; collected: boolean },
    used: number,
    now: Date,
  ) {
    const c = e.coupon;
    return {
      couponId: c.id,
      name: c.name,
      kind: c.kind,
      code: e.code ? e.code.code : c.isBulk ? null : c.code,
      type: c.type,
      value: c.value,
      maxDiscountP: c.maxDiscountP,
      minOrderP: c.minOrderP,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      termsEn: c.termsEn,
      termsBn: c.termsBn,
      source: e.source,
      collected: e.collected,
      state: walletState(c, used, now, e.code),
    };
  }
}
