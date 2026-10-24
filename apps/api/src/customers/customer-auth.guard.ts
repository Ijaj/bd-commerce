import {
  applyDecorators,
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { ENV, type Env } from '../config/env';
import {
  CUSTOMER_COOKIE,
  type CustomerAuthContext,
  CustomerAuthService,
} from './customer-auth.service';

type AuthedRequest = Request & { customerAuth?: CustomerAuthContext };

export function customerCookie(env: Env, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly auth: CustomerAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const ctx = await this.auth.resolve(req.cookies?.[CUSTOMER_COOKIE]);
    if (!ctx) throw new UnauthorizedException('Sign in required');
    if (ctx.refreshed) {
      // Sliding window: keep the browser cookie as long-lived as the server session.
      const maxAge = await this.auth.sessionMaxAgeMs();
      http
        .getResponse<Response>()
        .cookie(CUSTOMER_COOKIE, req.cookies[CUSTOMER_COOKIE], customerCookie(this.env, maxAge));
    }
    req.customerAuth = ctx;
    return true;
  }
}

/** Requires a signed-in customer (cookie `bdc_cs`). Reusable by cart/checkout controllers. */
export const CustomerAuth = () =>
  applyDecorators(
    UseGuards(CustomerAuthGuard),
    ApiCookieAuth(CUSTOMER_COOKIE),
    ApiUnauthorizedResponse({ description: 'No valid customer session' }),
  );

export const CurrentCustomer = createParamDecorator(
  (_: unknown, context: ExecutionContext): CustomerAuthContext => {
    const ctx = context.switchToHttp().getRequest<AuthedRequest>().customerAuth;
    if (!ctx) throw new UnauthorizedException();
    return ctx;
  },
);
