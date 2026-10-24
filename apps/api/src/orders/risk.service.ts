import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { SettingsService } from '../settings/settings.service';

export type RiskReason = 'velocity_phone' | 'velocity_ip' | 'cod_high' | 'first_guest';

const SCORE_PER_REASON = 10;

/**
 * Call-queue risk assessment (C53, Q54). Called by checkout inside the placement transaction
 * right after the order row exists. Sets riskScore / riskReasons / callStatus on the order.
 * Never blocks the order: odd data just yields fewer reasons.
 */
@Injectable()
export class RiskService {
  constructor(private readonly settings: SettingsService) {}

  async assess(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        guestPhone: true,
        shipPhone: true,
        ip: true,
        codDueP: true,
        placedAt: true,
      },
    });
    if (!order) return;
    const cfg = await this.settings.get('call_queue');
    const reasons: RiskReason[] = [];

    const phones = [
      ...new Set([order.shipPhone, order.guestPhone].filter((p): p is string => !!p)),
    ];
    const since = new Date(order.placedAt.getTime() - cfg.velocityWindowHours * 3_600_000);

    if (phones.length > 0) {
      const sameFrom = await tx.order.count({
        where: {
          placedAt: { gte: since },
          OR: [{ shipPhone: { in: phones } }, { guestPhone: { in: phones } }],
        },
      });
      if (sameFrom >= cfg.velocityCount) reasons.push('velocity_phone');
    }
    if (order.ip) {
      const sameIp = await tx.order.count({ where: { ip: order.ip, placedAt: { gte: since } } });
      if (sameIp >= cfg.velocityCount) reasons.push('velocity_ip');
    }
    if (order.codDueP >= cfg.codAboveP && order.codDueP > 0) reasons.push('cod_high');
    if (cfg.firstGuest && order.customerId === null && phones.length > 0) {
      const earlier = await tx.order.count({
        where: {
          id: { not: order.id },
          OR: [{ shipPhone: { in: phones } }, { guestPhone: { in: phones } }],
        },
      });
      if (earlier === 0) reasons.push('first_guest');
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        riskReasons: reasons,
        riskScore: reasons.length * SCORE_PER_REASON,
        callStatus: reasons.length > 0 ? 'pending' : 'not_needed',
      },
    });
  }
}
