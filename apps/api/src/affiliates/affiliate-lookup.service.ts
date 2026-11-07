import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export interface ActiveAffiliate {
  id: string;
  code: string;
  displayName: string;
  customerId: string;
}

/** Finds an affiliate that may earn right now: program on and not suspended. */
@Injectable()
export class AffiliateLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async programEnabled() {
    return (await this.settings.get('affiliates')).enabled;
  }

  async findActive(code: string | null | undefined): Promise<ActiveAffiliate | null> {
    if (!code || !(await this.programEnabled())) return null;
    const a = await this.prisma.affiliate.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true, code: true, displayName: true, customerId: true, status: true },
    });
    return a && a.status === 'active' ? a : null;
  }

  /** What a buyer may see about a typed code. */
  async refFor(code: string | null | undefined) {
    const a = await this.findActive(code);
    return a ? { code: a.code, displayName: a.displayName } : null;
  }
}
