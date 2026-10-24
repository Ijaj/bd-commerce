import { Injectable } from '@nestjs/common';
import { OrderStatusService } from '../orders/order-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DAY_MS, lockOrder, OPEN_STATUSES } from './returns.util';

/** Closes out delivered orders once nobody can return anything any more. */
@Injectable()
export class ReturnsCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly status: OrderStatusService,
  ) {}

  /** Marks delivered orders `completed` when every line's return window has passed and no return is open. Returns how many. */
  async completeDue(now = new Date()): Promise<number> {
    const windowDefault = (await this.settings.get('returns')).windowDays;
    const candidates = await this.prisma.order.findMany({
      where: {
        status: 'delivered',
        deliveredAt: { not: null },
        returns: { none: { status: { in: [...OPEN_STATUSES] } } },
      },
      select: {
        id: true,
        deliveredAt: true,
        items: { select: { returnWindowDays: true } },
      },
    });
    let done = 0;
    for (const o of candidates) {
      if (!o.deliveredAt) continue;
      const days = Math.max(0, ...o.items.map((i) => i.returnWindowDays ?? windowDefault));
      if (now.getTime() <= o.deliveredAt.getTime() + days * DAY_MS) continue;
      const ok = await this.prisma.$transaction(async (tx) => {
        await lockOrder(tx, o.id);
        // Re-check under the lock: a return may have been filed since the scan.
        const open = await tx.return.count({
          where: { orderId: o.id, status: { in: [...OPEN_STATUSES] } },
        });
        const cur = await tx.order.findUniqueOrThrow({
          where: { id: o.id },
          select: { status: true },
        });
        if (open > 0 || cur.status !== 'delivered') return false;
        await this.status.transition(
          tx,
          o.id,
          'completed',
          { type: 'system' },
          'Return window over',
          {
            completedAt: now,
          },
        );
        return true;
      });
      if (ok) done++;
    }
    return done;
  }
}
