import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { ThrottleService } from '../auth/throttle.service';
import { ENV, type Env } from '../config/env';
import type { OtpPurpose } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';
import { SmsService } from '../sms/sms.service';
import { CustomerError } from './customers.errors';
import { maskPhone } from './phone';

export const OTP_TTL_SEC = 5 * 60;
export const OTP_RESEND_SEC = 60;
const OTP_MAX_ATTEMPTS = 5;
const PHONE_PER_HOUR = 5;
const IP_PER_HOUR = 20;
/**
 * Wrong guesses across all codes of one phone+purpose (C49): locked for an hour after 10, for a day
 * after 30. The counter itself lives 24 h from the first miss.
 */
const FAIL_LOCK_SHORT_AFTER = 10;
const FAIL_LOCK_SHORT_SEC = 3600;
const FAIL_LOCK_LONG_AFTER = 30;
const FAIL_LOCK_LONG_SEC = 24 * 3600;
const FAIL_WINDOW_SEC = 24 * 3600;
const KEEP_ROWS_MS = 24 * 3600_000;
const HOUR_SEC = 3600;
const SHOP_NAME = 'bd-commerce';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly throttle: ThrottleService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hash(phone: string, purpose: OtpPurpose, code: string) {
    // Keyed: a leaked otp_codes row cannot be turned back into the 6-digit code without the secret.
    return createHmac('sha256', this.env.OTP_SECRET)
      .update(`${phone}:${purpose}:${code}`)
      .digest('hex');
  }

  /**
   * Per-IP budget for code requests. Callers run it FIRST, before any lookup that could answer
   * differently for known and unknown phones, so probing numbers costs the same as sending codes.
   */
  async countIp(ip: string | undefined) {
    const ipKey = `cust-otp:ip:${ip ?? 'unknown'}`;
    if (await this.throttle.isBlocked(ipKey, IP_PER_HOUR)) {
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Too many code requests. Try again later.',
      );
    }
    await this.throttle.hit(ipKey, HOUR_SEC);
  }

  /**
   * Rate limits run for every phone, known or not, so a reset request cannot be used to probe
   * which numbers have an account. `deliver=false` goes through the motions without sending.
   */
  async request(phone: string, purpose: OtpPurpose, ip: string | undefined, deliver: boolean) {
    const phoneKey = `cust-otp:phone:${phone}`;
    if (await this.throttle.isBlocked(phoneKey, PHONE_PER_HOUR)) {
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Too many code requests. Try again later.',
      );
    }
    const cooldownKey = `cust-otp:cooldown:${phone}`;
    const fresh = await this.redis.set(cooldownKey, '1', 'EX', OTP_RESEND_SEC, 'NX');
    if (fresh !== 'OK') {
      const retryAfter = Math.max(1, await this.redis.ttl(cooldownKey));
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'OTP_COOLDOWN',
        `Wait ${retryAfter}s before requesting another code.`,
        { retryAfterSec: retryAfter },
      );
    }
    await this.throttle.hit(phoneKey, HOUR_SEC);

    if (deliver) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        // Spent and stale rows are of no use after a day.
        await tx.otpCode.deleteMany({
          where: { createdAt: { lt: new Date(now.getTime() - KEEP_ROWS_MS) } },
        });
        // Only the newest code works.
        await tx.otpCode.updateMany({
          where: { phone, purpose, usedAt: null },
          data: { usedAt: now },
        });
        await tx.otpCode.create({
          data: {
            phone,
            purpose,
            ip,
            codeHash: this.hash(phone, purpose, code),
            expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000),
          },
        });
      });
      this.sms.send({
        to: phone,
        text: `${SHOP_NAME} code: ${code}. Valid ${OTP_TTL_SEC / 60} minutes.`,
      });
    }
    return { sentTo: maskPhone(phone), expiresInSec: OTP_TTL_SEC, resendInSec: OTP_RESEND_SEC };
  }

  private async recordFailure(failKey: string, lockKey: string) {
    const n = await this.redis.incr(failKey);
    if (n === 1) await this.redis.expire(failKey, FAIL_WINDOW_SEC);
    if (n === FAIL_LOCK_SHORT_AFTER) await this.redis.set(lockKey, '1', 'EX', FAIL_LOCK_SHORT_SEC);
    if (n === FAIL_LOCK_LONG_AFTER) await this.redis.set(lockKey, '1', 'EX', FAIL_LOCK_LONG_SEC);
  }

  /** Checks and consumes the newest code. Wrong guesses count against the code; 5 kill it. */
  async consume(phone: string, purpose: OtpPurpose, code: string) {
    // Wrong guesses add up across codes, so asking for a fresh code does not reset the budget.
    const failKey = `cust-otp:fail:${phone}:${purpose}`;
    const lockKey = `cust-otp:lock:${phone}:${purpose}`;
    const lockedFor = await this.redis.ttl(lockKey);
    if (lockedFor > 0) {
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ATTEMPTS',
        'Too many wrong codes. Try again later.',
        { retryAfterSec: lockedFor },
      );
    }
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      await this.recordFailure(failKey, lockKey);
      throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
    }
    if (otp.expiresAt.getTime() <= Date.now()) {
      throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_EXPIRED', 'This code has expired.');
    }
    // Atomic so parallel guesses cannot exceed the attempt budget.
    const counted = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, usedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count !== 1) {
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ATTEMPTS',
        'Too many wrong attempts. Request a new code.',
      );
    }
    const a = Buffer.from(this.hash(phone, purpose, code));
    const b = Buffer.from(otp.codeHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.recordFailure(failKey, lockKey);
      throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
    }
    const used = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) {
      throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
    }
    await this.redis.del(failKey, lockKey);
  }
}
