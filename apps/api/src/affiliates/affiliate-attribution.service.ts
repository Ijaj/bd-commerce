import { Injectable } from '@nestjs/common';
import { normalizePhone } from '../customers/phone';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { type ActiveAffiliate, AffiliateLookupService } from './affiliate-lookup.service';

const DAY_MS = 24 * 60 * 60_000;

export interface AttributeInput {
  orderId: string;
  /** Code typed in the cart (C81); beats any link click. */
  cartCode: string | null;
  customerId: string | null;
  visitorId: string | null;
  /** Every phone on the order (ship-to, guest, account); compared after normalising. */
  phones: (string | null | undefined)[];
  upazilaId: number;
  line: string;
  lines: { lineTotalP: number; discountP: number }[];
  now: Date;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Decides, at order placement, which affiliate (if any) earns on the order and books the pending commission. */
@Injectable()
export class AffiliateAttributionService {
  constructor(
    private readonly settings: SettingsService,
    private readonly lookup: AffiliateLookupService,
  ) {}

  /** C69: the affiliate may not earn on their own purchases (same account, phone or address). */
  async isSelfReferral(
    db: Prisma.TransactionClient | PrismaService,
    affiliate: Pick<ActiveAffiliate, 'customerId'>,
    buyer: Pick<AttributeInput, 'customerId' | 'phones' | 'upazilaId' | 'line'>,
  ) {
    if (buyer.customerId === affiliate.customerId) return true;
    const owner = await db.customer.findUnique({
      where: { id: affiliate.customerId },
      select: { phone: true, addresses: { select: { upazilaId: true, line: true, phone: true } } },
    });
    if (!owner) return false;
    const phones = buyer.phones.flatMap((p) => (p ? [normalizePhone(p) ?? p] : []));
    if (owner.phone && phones.includes(owner.phone)) return true;
    const line = squash(buyer.line);
    return owner.addresses.some((a) => a.upazilaId === buyer.upazilaId && squash(a.line) === line);
  }

  async attribute(tx: Prisma.TransactionClient, input: AttributeInput) {
    const cfg = await this.settings.get('affiliates');
    if (!cfg.enabled) return null;

    let affiliate = await this.lookup.findActive(input.cartCode);
    let how: 'code' | 'link' = 'code';
    if (!affiliate && input.visitorId) {
      // Last click wins; clicks of since-suspended affiliates are skipped over.
      const click = await tx.affiliateClick.findFirst({
        where: {
          visitorId: input.visitorId,
          clickedAt: { gte: new Date(input.now.getTime() - cfg.clickWindowDays * DAY_MS) },
          affiliate: { status: 'active' },
        },
        orderBy: { clickedAt: 'desc' },
        select: {
          affiliate: { select: { id: true, code: true, displayName: true, customerId: true } },
        },
      });
      if (click) {
        affiliate = click.affiliate;
        how = 'link';
      }
    }
    if (!affiliate) return null;
    if (await this.isSelfReferral(tx, affiliate, input)) return null;

    const own = await tx.affiliate.findUniqueOrThrow({
      where: { id: affiliate.id },
      select: { commissionBp: true },
    });
    const commissionBp = own.commissionBp ?? cfg.defaultCommissionBp;
    // C68: item totals after discounts; delivery never counts.
    const baseP = input.lines.reduce((n, l) => n + Math.max(0, l.lineTotalP - l.discountP), 0);
    await tx.order.update({
      where: { id: input.orderId },
      data: { affiliateId: affiliate.id, affiliateAttribution: how },
    });
    await tx.affiliateCommission.create({
      data: {
        affiliateId: affiliate.id,
        orderId: input.orderId,
        commissionBp,
        baseP,
        amountP: Math.round((baseP * commissionBp) / 10_000),
      },
    });
    return { code: affiliate.code, displayName: affiliate.displayName, attribution: how };
  }
}
