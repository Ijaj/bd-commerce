import { HttpStatus, Injectable } from '@nestjs/common';
import { newToken, sha256 } from '../auth/crypto';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/password';
import { ThrottleService } from '../auth/throttle.service';
import type { Customer, CustomerSession } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CustomerError } from './customers.errors';
import { OtpService } from './otp.service';
import { normalizePhone } from './phone';

export const CUSTOMER_COOKIE = 'bdc_cs';

const DAY_MS = 24 * 60 * 60_000;
const TOUCH_EVERY_MS = 60_000;
const LOGIN_WINDOW_SEC = 15 * 60;
const LOGIN_LIMIT_PER_ID = 5;
const LOGIN_LIMIT_PER_IP = 30;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface CustomerAuthContext {
  customer: Customer;
  session: CustomerSession;
  /** The idle window was extended, so the cookie should be re-issued. */
  refreshed: boolean;
}

export function toMe(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    phoneVerified: c.phoneVerifiedAt !== null,
    email: c.email,
    lang: c.lang,
    createdAt: c.createdAt.toISOString(),
  };
}

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly throttle: ThrottleService,
    private readonly settings: SettingsService,
  ) {}

  async sessionMaxAgeMs() {
    return (await this.settings.get('customer_session_days')) * DAY_MS;
  }

  async requestOtp(phoneInput: string, purpose: 'signup' | 'reset', ip: string | undefined) {
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      throw new CustomerError(
        HttpStatus.BAD_REQUEST,
        'PHONE_INVALID',
        'Enter a valid Bangladesh mobile number.',
      );
    }
    const existing = await this.prisma.customer.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (purpose === 'signup' && existing) {
      throw new CustomerError(
        HttpStatus.CONFLICT,
        'PHONE_TAKEN',
        'This phone number is already registered.',
      );
    }
    return this.otp.request(phone, purpose, ip, purpose === 'signup' || existing !== null);
  }

  async signup(
    input: { name: string; phone: string; email?: string; password: string; code: string },
    meta: RequestMeta,
  ) {
    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new CustomerError(
        HttpStatus.BAD_REQUEST,
        'PHONE_INVALID',
        'Enter a valid Bangladesh mobile number.',
      );
    }
    const email = input.email?.trim().toLowerCase();
    await this.assertFree(phone, email);
    await this.otp.consume(phone, 'signup', input.code);

    let customer: Customer;
    try {
      customer = await this.prisma.customer.create({
        data: {
          name: input.name,
          phone,
          email,
          passwordHash: await hashPassword(input.password),
          phoneVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new CustomerError(
          HttpStatus.CONFLICT,
          'PHONE_TAKEN',
          'This phone number or email is already registered.',
        );
      }
      throw e;
    }
    return { customer, token: await this.startSession(customer.id, meta) };
  }

  async login(loginInput: string, password: string, meta: RequestMeta) {
    const raw = loginInput.trim();
    const isEmail = raw.includes('@');
    const id = isEmail ? raw.toLowerCase() : (normalizePhone(raw) ?? raw);
    const idKey = `cust-login:id:${id}`;
    const ipKey = `cust-login:ip:${meta.ip ?? 'unknown'}`;
    if (
      (await this.throttle.isBlocked(idKey, LOGIN_LIMIT_PER_ID)) ||
      (await this.throttle.isBlocked(ipKey, LOGIN_LIMIT_PER_IP))
    ) {
      throw new CustomerError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Too many failed logins. Try again later.',
      );
    }

    const customer = isEmail
      ? await this.prisma.customer.findUnique({ where: { email: id } })
      : normalizePhone(raw)
        ? await this.prisma.customer.findUnique({ where: { phone: id } })
        : null;
    const ok = customer?.passwordHash
      ? await verifyPassword(customer.passwordHash, password)
      : await burnPasswordCheck(password).then(() => false);
    if (!customer || !ok) {
      await this.throttle.hit(idKey, LOGIN_WINDOW_SEC);
      await this.throttle.hit(ipKey, LOGIN_WINDOW_SEC);
      throw new CustomerError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid phone/email or password.',
      );
    }
    // Only said after the password matched, so it does not reveal which accounts exist.
    if (customer.disabledAt) {
      throw new CustomerError(
        HttpStatus.FORBIDDEN,
        'ACCOUNT_DISABLED',
        'This account is disabled.',
      );
    }
    await this.throttle.clear(idKey);
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });
    return { customer: updated, token: await this.startSession(customer.id, meta) };
  }

  async resetPassword(phoneInput: string, code: string, password: string) {
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      throw new CustomerError(
        HttpStatus.BAD_REQUEST,
        'PHONE_INVALID',
        'Enter a valid Bangladesh mobile number.',
      );
    }
    await this.otp.consume(phone, 'reset', code);
    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer) throw new CustomerError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Invalid code.');
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash: await hashPassword(password),
        phoneVerifiedAt: customer.phoneVerifiedAt ?? new Date(),
      },
    });
    await this.revokeAll(customer.id);
  }

  async changePassword(ctx: CustomerAuthContext, currentPassword: string, newPassword: string) {
    const { customer } = ctx;
    const ok = customer.passwordHash
      ? await verifyPassword(customer.passwordHash, currentPassword)
      : false;
    if (!ok) {
      throw new CustomerError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Current password is wrong.',
      );
    }
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await this.revokeAll(customer.id, ctx.session.id);
  }

  async update(
    customer: Customer,
    input: { name?: string; email?: string | null; lang?: 'en' | 'bn' },
  ) {
    const email =
      input.email === undefined ? undefined : (input.email?.trim().toLowerCase() ?? null);
    if (email && email !== customer.email) await this.assertFree(undefined, email);
    try {
      return await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: input.name,
          lang: input.lang,
          ...(email !== undefined && email !== customer.email
            ? { email, emailVerifiedAt: null }
            : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new CustomerError(
          HttpStatus.CONFLICT,
          'EMAIL_TAKEN',
          'This email is already registered.',
        );
      }
      throw e;
    }
  }

  private async assertFree(phone: string | undefined, email: string | undefined) {
    if (
      phone &&
      (await this.prisma.customer.findUnique({ where: { phone }, select: { id: true } }))
    ) {
      throw new CustomerError(
        HttpStatus.CONFLICT,
        'PHONE_TAKEN',
        'This phone number is already registered.',
      );
    }
    if (
      email &&
      (await this.prisma.customer.findUnique({ where: { email }, select: { id: true } }))
    ) {
      throw new CustomerError(
        HttpStatus.CONFLICT,
        'EMAIL_TAKEN',
        'This email is already registered.',
      );
    }
  }

  private async startSession(customerId: string, meta: RequestMeta) {
    const token = newToken();
    await this.prisma.customerSession.create({
      data: {
        customerId,
        tokenHash: sha256(token),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + (await this.sessionMaxAgeMs())),
      },
    });
    return token;
  }

  /** Loads a live session; enforces revoke, idle expiry and disabled customers. Slides the window. */
  async resolve(token: string | undefined): Promise<CustomerAuthContext | null> {
    if (!token) return null;
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
