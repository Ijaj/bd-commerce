import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import type { Staff, StaffSession } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { decrypt, encrypt, newBackupCode, newToken, normalizeBackupCode, sha256 } from './crypto';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password';
import type { PermissionKey } from './permissions';
import { RbacService } from './rbac.service';
import { ThrottleService } from './throttle.service';
import { matchTotp, newTotpSecret, totpUri } from './totp';

export const SESSION_COOKIE = 'bdc_staff_session';
export const DEVICE_COOKIE = 'bdc_staff_device';

const MINUTE = 60_000;
/** Password-ok-but-no-2FA-yet sessions live briefly. */
const PENDING_TTL_MS = 10 * MINUTE;
/** Hard cap on a verified session regardless of activity. */
export const SESSION_MAX_MS = 7 * 24 * 60 * MINUTE;
const TOUCH_EVERY_MS = MINUTE;
const MFA_MAX_ATTEMPTS = 5;
const BACKUP_CODE_COUNT = 10;
const LOGIN_WINDOW_SEC = 15 * 60;
const LOGIN_LIMIT_PER_EMAIL = 5;
const LOGIN_LIMIT_PER_IP = 30;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  /** Raw device cookie, if the browser has one. */
  deviceToken?: string;
}

export interface StaffAuthContext {
  staff: Staff;
  session: StaffSession;
  permissions: Set<PermissionKey>;
}

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly throttle: ThrottleService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(emailInput: string, password: string, meta: RequestMeta) {
    const email = emailInput.trim().toLowerCase();
    const emailKey = `staff-login:email:${email}`;
    const ipKey = `staff-login:ip:${meta.ip ?? 'unknown'}`;
    if (
      (await this.throttle.isBlocked(emailKey, LOGIN_LIMIT_PER_EMAIL)) ||
      (await this.throttle.isBlocked(ipKey, LOGIN_LIMIT_PER_IP))
    ) {
      throw new HttpException(
        'Too many failed logins. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const staff = await this.prisma.staff.findUnique({ where: { email } });
    const ok =
      staff && !staff.disabledAt
        ? await verifyPassword(staff.passwordHash, password)
        : await burnPasswordCheck(password).then(() => false);
    if (!staff || !ok) {
      await this.throttle.hit(emailKey, LOGIN_WINDOW_SEC);
      await this.throttle.hit(ipKey, LOGIN_WINDOW_SEC);
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.throttle.clear(emailKey);

    const token = newToken();
    const session = await this.prisma.staffSession.create({
      data: {
        staffId: staff.id,
        tokenHash: sha256(token),
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      },
    });
    if (this.env.DISABLE_2FA) {
      const deviceToken = await this.completeLogin({ staff, session }, meta);
      return { token, next: 'authenticated' as const, deviceToken };
    }
    return { token, next: staff.totpEnabledAt ? ('mfa_verify' as const) : ('mfa_setup' as const) };
  }

  /** Loads a live session; enforces revoke, expiry, disabled staff and idle timeout. */
  async resolve(token: string | undefined): Promise<StaffAuthContext | null> {
    if (!token) return null;
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: sha256(token) },
      include: { staff: true },
    });
    const now = Date.now();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now) return null;
    const { staff, ...plain } = session;
    if (staff.disabledAt) return null;

    if (plain.mfaVerifiedAt) {
      const idleMin =
        staff.sessionTimeoutMin ?? (await this.settings.get('staff_session_timeout_min'));
      const idleMs = idleMin * MINUTE;
      if (now - plain.lastSeenAt.getTime() > idleMs) {
        await this.revoke(plain.id);
        return null;
      }
      if (now - plain.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
        await this.prisma.staffSession.update({
          where: { id: plain.id },
          data: { lastSeenAt: new Date(now) },
        });
      }
    }
    return { staff, session: plain, permissions: await this.rbac.permissionsOf(staff.id) };
  }

  async setupTotp({ staff }: StaffAuthContext) {
    if (staff.totpEnabledAt) throw new ConflictException('2FA is already set up');
    const secret = newTotpSecret();
    await this.prisma.staff.update({
      where: { id: staff.id },
      data: { totpSecret: encrypt(secret, this.env.STAFF_TOTP_KEY) },
    });
    return { secret, otpauthUri: totpUri(secret, staff.email) };
  }

  /** Confirms the first code, turns 2FA on, issues backup codes and completes the login. */
  async enableTotp(ctx: StaffAuthContext, code: string, meta: RequestMeta) {
    const { staff } = ctx;
    if (staff.totpEnabledAt) throw new ConflictException('2FA is already set up');
    if (!staff.totpSecret) throw new ConflictException('Start 2FA setup first');
    await this.countMfaAttempt(ctx.session);
    const step = matchTotp(decrypt(staff.totpSecret, this.env.STAFF_TOTP_KEY), code);
    if (step === null) throw new UnauthorizedException('Wrong code');

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, newBackupCode);
    await this.prisma.$transaction([
      this.prisma.staff.update({
        where: { id: staff.id },
        data: { totpEnabledAt: new Date(), totpLastStep: step },
      }),
      this.prisma.staffBackupCode.deleteMany({ where: { staffId: staff.id } }),
      this.prisma.staffBackupCode.createMany({
        data: backupCodes.map((c) => ({ staffId: staff.id, codeHash: sha256(c) })),
      }),
    ]);
    const deviceToken = await this.completeLogin(ctx, meta);
    return { backupCodes, deviceToken };
  }

  async verifyMfa(
    ctx: StaffAuthContext,
    input: { code?: string; backupCode?: string },
    meta: RequestMeta,
  ) {
    const { staff } = ctx;
    if (!staff.totpEnabledAt || !staff.totpSecret) throw new ConflictException('Set up 2FA first');
    await this.countMfaAttempt(ctx.session);

    if (input.code !== undefined) {
      const step = matchTotp(decrypt(staff.totpSecret, this.env.STAFF_TOTP_KEY), input.code);
      if (step === null || step <= (staff.totpLastStep ?? -1)) {
        throw new UnauthorizedException('Wrong code');
      }
      await this.prisma.staff.update({ where: { id: staff.id }, data: { totpLastStep: step } });
    } else {
      const used = await this.prisma.staffBackupCode.updateMany({
        where: {
          staffId: staff.id,
          codeHash: sha256(normalizeBackupCode(input.backupCode ?? '')),
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw new UnauthorizedException('Wrong code');
    }
    return this.completeLogin(ctx, meta);
  }

  async revoke(sessionId: string) {
    await this.prisma.staffSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(staffId: string, exceptSessionId?: string) {
    await this.prisma.staffSession.updateMany({
      where: { staffId, revokedAt: null, ...(exceptSessionId && { id: { not: exceptSessionId } }) },
      data: { revokedAt: new Date() },
    });
  }

  rolesOf(staffId: string) {
    return this.prisma.role.findMany({
      where: { staff: { some: { staffId } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async changePassword(ctx: StaffAuthContext, current: string, next: string) {
    if (!(await verifyPassword(ctx.staff.passwordHash, current))) {
      throw new UnauthorizedException('Current password is wrong');
    }
    await this.prisma.staff.update({
      where: { id: ctx.staff.id },
      data: { passwordHash: await hashPassword(next) },
    });
    await this.revokeAll(ctx.staff.id, ctx.session.id);
  }

  private async countMfaAttempt(session: StaffSession) {
    if (session.mfaVerifiedAt) throw new ConflictException('Already signed in');
    const { mfaAttempts } = await this.prisma.staffSession.update({
      where: { id: session.id },
      data: { mfaAttempts: { increment: 1 } },
    });
    if (mfaAttempts > MFA_MAX_ATTEMPTS) {
      await this.revoke(session.id);
      throw new UnauthorizedException('Too many wrong codes. Sign in again.');
    }
  }

  /**
   * Marks the session verified and records the device. Returns a new device token when
   * the browser had none (caller sets the cookie). Alerts by email on an unknown device,
   * except the very first one.
   */
  private async completeLogin(
    { staff, session }: Pick<StaffAuthContext, 'staff' | 'session'>,
    meta: RequestMeta,
  ) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.staffSession.update({
        where: { id: session.id },
        data: {
          mfaVerifiedAt: now,
          lastSeenAt: now,
          expiresAt: new Date(now.getTime() + SESSION_MAX_MS),
        },
      }),
      this.prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: now } }),
    ]);

    const deviceToken = meta.deviceToken ?? newToken();
    const fingerprintHash = sha256(deviceToken);
    const known = await this.prisma.staffKnownDevice.findUnique({
      where: { staffId_fingerprintHash: { staffId: staff.id, fingerprintHash } },
    });
    if (known) {
      await this.prisma.staffKnownDevice.update({
        where: { id: known.id },
        data: { lastSeenAt: now },
      });
    } else {
      const hadDevices = await this.prisma.staffKnownDevice.count({ where: { staffId: staff.id } });
      await this.prisma.staffKnownDevice.create({
        data: { staffId: staff.id, fingerprintHash, userAgent: meta.userAgent },
      });
      if (hadDevices > 0) {
        this.mail.send({
          to: staff.email,
          subject: 'New sign-in to your staff account',
          text: [
            `Hi ${staff.name},`,
            '',
            `Your bd-commerce staff account was signed in from a new device at ${now.toISOString()}.`,
            `Device: ${meta.userAgent ?? 'unknown'}`,
            `IP: ${meta.ip ?? 'unknown'}`,
            '',
            "If this wasn't you, change your password now and tell the owner.",
          ].join('\n'),
        });
      }
    }
    return meta.deviceToken ? undefined : deviceToken;
  }
}
