import { HttpStatus, Injectable } from '@nestjs/common';
import { newToken, sha256 } from '../auth/crypto';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/password';
import { ThrottleService } from '../auth/throttle.service';
import type { Customer } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CUSTOMER_COOKIE,
  type CustomerAuthContext,
  CustomerSessionService,
} from './customer-session.service';
import { CustomerError } from './customers.errors';
import { OtpService } from './otp.service';
import { normalizePhone } from './phone';

export { CUSTOMER_COOKIE, type CustomerAuthContext };

const LOGIN_WINDOW_SEC = 15 * 60;
const LOGIN_LIMIT_PER_ID = 5;
const LOGIN_LIMIT_PER_IP = 30;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
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
    private readonly sessions: CustomerSessionService,
  ) {}

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
    await this.linkGuestOrders(customer);
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
    await this.linkGuestOrders(updated);
    return { customer: updated, token: await this.startSession(customer.id, meta) };
  }

  /** Q94: guest orders placed with this customer's verified phone join the account. */
  async linkGuestOrders(customer: Customer) {
    if (!customer.phone || !customer.phoneVerifiedAt) return;
    await this.prisma.order.updateMany({
      where: { customerId: null, guestPhone: customer.phone },
      data: { customerId: customer.id },
    });
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
        expiresAt: new Date(Date.now() + (await this.sessions.sessionMaxAgeMs())),
      },
    });
    return token;
  }

  sessionMaxAgeMs() {
    return this.sessions.sessionMaxAgeMs();
  }

  resolve(token: string | undefined) {
    return this.sessions.resolve(token);
  }

  revoke(sessionId: string) {
    return this.sessions.revoke(sessionId);
  }

  revokeAll(customerId: string, exceptSessionId?: string) {
    return this.sessions.revokeAll(customerId, exceptSessionId);
  }
}
