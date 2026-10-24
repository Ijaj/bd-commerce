import { type CanActivate, type ExecutionContext, Injectable, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Personal data (cart, orders, account) must never be kept by a browser cache or a shared proxy.
 * A guard rather than an interceptor: class-level guards run before the route's auth guard, so even
 * the 401 answers carry the header.
 */
@Injectable()
export class NoStoreGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'private, no-store');
    return true;
  }
}

export const NoStore = () => UseGuards(NoStoreGuard);
