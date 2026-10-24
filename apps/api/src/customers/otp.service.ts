import { randomInt, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { sha256 } from '../auth/crypto';
import { ThrottleService } from '../auth/throttle.service';
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
const HOUR_SEC = 3600;
const SHOP_NAME = 'bd-commerce';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly throttle: ThrottleService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private hash(phone: string, purpose: OtpPurpose, code: string) {
    return sha256(`${phone}:${purpose}:${code}`);
  }

  /**
   * Rate limits run for every phone, known or not, so a reset request cannot be used to probe
   * which numbers have an account. `deliver=false` goes through the motions without sending.
   */
  async request(phone: string, purpose: OtpPurpose, ip: string | undefined, deliver: boolean) {
    const ipKey = `cust-otp:ip:${ip ?? 'unknown'}`;
    const phoneKey = `cust-otp:phone:${phone}`;
    if (
      (await this.throttle.isBlocked(ipKey, IP_PER_HOUR)) ||
      (await this.throttle.isBlocked(phoneKey, PHONE_PER_HOUR))
    ) {
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
    await this.throttle.hit(ipKey, HOUR_SEC);
    await this.throttle.hit(phoneKey, HOUR_SEC);

    if (deliver) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const now = new Date();
      await this.prisma.$transaction([
        // Only the newest code works.
        this.prisma.otpCode.updateMany({
          where: { phone, purpose, usedAt: null },
          data: { usedAt: now },
        }),
        this.prisma.otpCode.create({
          data: {
            phone,
            purpose,
            ip,
            codeHash: this.hash(phone, purpose, code),
            expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000),
          },
        }),
      ]);
      this.sms.send({
        to: phone,
        text: `${SHOP_NAME} code: ${code}. Valid ${OTP_TTL_SEC / 60} minutes.`,
      });
    }
    return { sentTo: maskPhone(phone), expiresInSec: OTP_TTL_SEC, resendInSec: OTP_RESEND_SEC };
  }

  /** Checks and consumes the newest code. Wrong guesses count against the code; 5 kill it. */
  async consume(phone: string, purpose: OtpPurpose, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
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
      throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
    }
    const used = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) {
      throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
    }
  }
}
