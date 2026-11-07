import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AffiliateError } from './affiliates.errors';
import { CODE_RE } from './affiliates.schemas';

type Db = Prisma.TransactionClient | PrismaService;

/** Affiliate codes share one namespace with coupon codes (both are typed in the same box). */
@Injectable()
export class AffiliateCodesService {
  async isFree(db: Db, code: string) {
    const [a, b, c] = await Promise.all([
      db.affiliate.findUnique({ where: { code }, select: { id: true } }),
      db.coupon.findFirst({ where: { code }, select: { id: true } }),
      db.couponCode.findUnique({ where: { code }, select: { id: true } }),
    ]);
    return !a && !b && !c;
  }

  async assertFree(db: Db, code: string) {
    if (!(await this.isFree(db, code))) {
      throw new AffiliateError(
        HttpStatus.CONFLICT,
        'AFFILIATE_CODE_TAKEN',
        'That code is already in use.',
      );
    }
  }

  /** Letters/digits of the page name (4–10), digits added until the code is unused. */
  async derive(db: Db, displayName: string) {
    let base = displayName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    if (base.length < 4) base = `${base}AFF`.slice(0, 10);
    for (let i = 0; i < 40; i++) {
      // First the bare name; then 2 digits, widening after a few collisions (max 16 chars total).
      const digits = i === 0 ? 0 : Math.min(2 + Math.floor(i / 5), 16 - base.length);
      const suffix = digits ? String(randomInt(10 ** digits)).padStart(digits, '0') : '';
      const code = `${base}${suffix}`;
      if (CODE_RE.test(code) && (await this.isFree(db, code))) return code;
    }
    throw new AffiliateError(
      HttpStatus.CONFLICT,
      'AFFILIATE_CODE_TAKEN',
      'Could not make a free code; pick one yourself.',
    );
  }
}
