import { Injectable } from '@nestjs/common';
import { sha256 } from '../auth/crypto';
import type { Customer, CustomerSession } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export const CUSTOMER_COOKIE = 'bdc_cs';

const DAY_MS = 24 * 60 * 60_000;
const TOUCH_EVERY_MS = 60_000;

export interface CustomerAuthContext {
  customer: Customer;
  session: CustomerSession;
  /** The idle window was extended, so the cookie should be re-issued. */
  refreshed: boolean;
}

/** Cookie-session lookups, split from CustomerAuthService so cart/checkout can use them without a module cycle. */
@Injectable()
export class CustomerSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async sessionMaxAgeMs() {
    return (await this.settings.get('customer_session_days')) * DAY_MS;
  }

  /** Loads a live session; enforces revoke, idle expiry and disabled customers. Slides the window. */
  async resolve(token: unknown): Promise<CustomerAuthContext | null> {
    // cookie-parser turns `j:{...}` cookies into objects; only a plain string can be a token.
    if (typeof token !== 'string' || !token) return null;
    const row = await this.prisma.customerSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { customer: true },
    });
    const now = Date.now();
    if (!row || row.revokedAt || row.expiresAt.getTime() <= now) return null;
    const { customer, ...session } = row;
    if (customer.disabledAt) return null;

    if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      const updated = await this.prisma.customerSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(now),
          expiresAt: new Date(now + (await this.sessionMaxAgeMs())),
        },
      });
      return { customer, session: updated, refreshed: true };
    }
    return { customer, session, refreshed: false };
  }

  async revoke(sessionId: string) {
    await this.prisma.customerSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(customerId: string, exceptSessionId?: string) {
    await this.prisma.customerSession.updateMany({
      where: {
        customerId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }
}
