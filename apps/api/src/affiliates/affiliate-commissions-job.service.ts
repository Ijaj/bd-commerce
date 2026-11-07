import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DAY_MS, lockOrder, OPEN_STATUSES } from '../returns/returns.util';
import { SettingsService } from '../settings/settings.service';

const BATCH = 500;

export interface CommissionJobResult {
  reversed: number;
  approved: number;
  scheduled: number;
}

/**
 * Moves pending commissions along (Q78, C69): cancelled orders reverse; delivered ones become
 * approved once every line's return window has passed and no return is open, counting only the units kept.
 */
@Injectable()
export class AffiliateCommissionsJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async run(now = new Date()): Promise<CommissionJobResult> {
    const reversed = await this.reverseCancelled(now);
    const scheduled = await this.scheduleDelivered();
    const settled = await this.settleDue(now);
    return { reversed: reversed + settled.reversed, approved: settled.approved, scheduled };
  }

  /** Status-guarded, so a second run (or a second instance) changes nothing. */
  private async reverseCancelled(now: Date) {
    const res = await this.prisma.affiliateCommission.updateMany({
      where: { status: 'pending', order: { status: 'cancelled' } },
      data: { status: 'reversed', reversedAt: now, reverseReason: 'order_cancelled' },
    });
    return res.count;
  }

  /** Stores delivered_at + longest line window so the due scan is a plain indexed query. */
  private async scheduleDelivered() {
    const windowDefault = (await this.settings.get('returns')).windowDays;
    const rows = await this.prisma.affiliateCommission.findMany({
      where: { status: 'pending', availableAt: null, order: { deliveredAt: { not: null } } },
      take: BATCH,
      select: {
        id: true,
        order: { select: { deliveredAt: true, items: { select: { returnWindowDays: true } } } },
      },
    });
    let n = 0;
    for (const r of rows) {
      const from = r.order.deliveredAt;
      if (!from) continue;
      const days = Math.max(0, ...r.order.items.map((i) => i.returnWindowDays ?? windowDefault));
      const res = await this.prisma.affiliateCommission.updateMany({
        where: { id: r.id, status: 'pending', availableAt: null },
        data: { availableAt: new Date(from.getTime() + days * DAY_MS) },
      });
      n += res.count;
    }
    return n;
  }

  private async settleDue(now: Date) {
    const due = await this.prisma.affiliateCommission.findMany({
      where: {
        status: 'pending',
        availableAt: { lte: now },
        order: {
          status: { not: 'cancelled' },
          returns: { none: { status: { in: [...OPEN_STATUSES] } } },
        },
      },
      orderBy: { availableAt: 'asc' },
      take: BATCH,
      select: { id: true, orderId: true },
    });
    let approved = 0;
    let reversed = 0;
    for (const c of due) {
      const out = await this.prisma.$transaction((tx) => this.settleOne(tx, c, now));
      if (out === 'approved') approved++;
      else if (out === 'reversed') reversed++;
    }
    return { approved, reversed };
  }

  private async settleOne(
    tx: Prisma.TransactionClient,
    c: { id: string; orderId: string },
    now: Date,
  ) {
    // Returns lock the order too, so the kept quantities below cannot move under us.
    await lockOrder(tx, c.orderId);
    const row = await tx.affiliateCommission.findUnique({
      where: { id: c.id },
      select: {
        status: true,
        commissionBp: true,
        order: {
          select: {
            status: true,
            items: {
              select: {
                qty: true,
                qtyCancelled: true,
                qtyReturned: true,
                lineTotalP: true,
                discountP: true,
              },
            },
          },
        },
      },
    });
    if (row?.status !== 'pending' || row.order.status === 'cancelled') return 'skipped';
    const open = await tx.return.count({
      where: { orderId: c.orderId, status: { in: [...OPEN_STATUSES] } },
    });
    if (open > 0) return 'skipped';

    const baseP = row.order.items.reduce((sum, i) => {
      const kept = Math.max(0, i.qty - i.qtyCancelled - i.qtyReturned);
      const paid = Math.max(0, i.lineTotalP - i.discountP);
      return sum + (i.qty > 0 ? Math.round((paid * kept) / i.qty) : 0);
    }, 0);
    const amountP = Math.round((baseP * row.commissionBp) / 10_000);
    const res = await tx.affiliateCommission.updateMany({
      where: { id: c.id, status: 'pending' },
      data:
        amountP === 0
          ? { status: 'reversed', baseP, amountP, reversedAt: now, reverseReason: 'nothing_kept' }
          : { status: 'approved', baseP, amountP, approvedAt: now },
    });
    if (res.count === 0) return 'skipped';
    return amountP === 0 ? 'reversed' : 'approved';
  }
}
