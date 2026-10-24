import {
  applyDecorators,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import type { PermissionKey } from './permissions';
import { SESSION_COOKIE, type StaffAuthContext, StaffAuthService } from './staff-auth.service';

const PERMISSIONS_KEY = 'staff:permissions';
const PENDING_MFA_KEY = 'staff:pending-mfa';

type AuthedRequest = Request & { staffAuth?: StaffAuthContext };

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly auth: StaffAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const ctx = await this.auth.resolve(req.cookies?.[SESSION_COOKIE]);
    if (!ctx) throw new UnauthorizedException('Sign in required');

    const targets = [context.getHandler(), context.getClass()];
    const allowPending = this.reflector.getAllAndOverride<boolean>(PENDING_MFA_KEY, targets);
    if (!ctx.session.mfaVerifiedAt && !allowPending) {
      throw new UnauthorizedException('2FA required');
    }

    const needed =
      this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, targets) ?? [];
    const missing = needed.filter((p) => !ctx.permissions.has(p));
    if (missing.length) throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);

    req.staffAuth = ctx;
    return true;
  }
}

/** Requires a fully signed-in staff session holding every listed permission. */
export const StaffAuth = (...permissions: PermissionKey[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    UseGuards(StaffAuthGuard),
    ApiCookieAuth(SESSION_COOKIE),
  );

/** Also accepts a session that passed the password step but not 2FA yet. */
export const StaffAuthPendingMfa = () =>
  applyDecorators(
    SetMetadata(PENDING_MFA_KEY, true),
    UseGuards(StaffAuthGuard),
    ApiCookieAuth(SESSION_COOKIE),
  );

export const CurrentStaff = createParamDecorator(
  (_: unknown, context: ExecutionContext): StaffAuthContext => {
    const ctx = context.switchToHttp().getRequest<AuthedRequest>().staffAuth;
    if (!ctx) throw new UnauthorizedException();
    return ctx;
  },
);

export function requestMeta(req: Request, deviceCookie: string) {
  return {
    ip: clientIp(req),
    userAgent: req.headers['user-agent']?.slice(0, 500),
    deviceToken: req.cookies?.[deviceCookie] as string | undefined,
  };
}
