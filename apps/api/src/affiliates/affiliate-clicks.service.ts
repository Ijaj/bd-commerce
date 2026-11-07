import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateLookupService } from './affiliate-lookup.service';

const DEDUPE_MS = 30 * 60_000;

export interface ClickInput {
  code: string;
  landingUrl: string;
  utm?: { source?: string | undefined; medium?: string | undefined; campaign?: string | undefined };
  visitorId: string;
  ip: string | undefined;
}

@Injectable()
export class AffiliateClicksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: AffiliateLookupService,
  ) {}

  /** Records a click when everything checks out; returns nothing either way (no code enumeration). */
  async record(input: ClickInput, now = new Date()) {
    if (!/^\/|^https?:\/\//i.test(input.landingUrl)) return;
    const affiliate = await this.lookup.findActive(input.code);
    if (!affiliate) return;
    const last = await this.prisma.affiliateClick.findFirst({
      where: { visitorId: input.visitorId },
      orderBy: { clickedAt: 'desc' },
      select: { affiliateId: true, clickedAt: true },
    });
    // A reload or a second tab of the same link is not a new visit.
    if (
      last &&
      last.affiliateId === affiliate.id &&
      now.getTime() - last.clickedAt.getTime() < DEDUPE_MS
    ) {
      return;
    }
    const utm = input.utm && Object.values(input.utm).some(Boolean) ? input.utm : undefined;
    await this.prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        visitorId: input.visitorId,
        landingUrl: input.landingUrl,
        ...(utm ? { utm } : {}),
        ip: input.ip ?? null,
        clickedAt: now,
      },
    });
  }
}
