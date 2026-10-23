import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';

/** Runs before the multipart interceptor, so unauthorised uploads are never buffered. */
@Injectable()
export class MediaManageGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { staffAuth } = context
      .switchToHttp()
      .getRequest<Request & { staffAuth?: StaffAuthContext }>();
    const perms = staffAuth?.permissions;
    if (!perms?.has('products.edit') && !perms?.has('categories.edit')) {
      throw new ForbiddenException('Missing permission: products.edit or categories.edit');
    }
    return true;
  }
}

/** Signed-in staff holding products.edit or categories.edit. */
export const MediaAuth = () => applyDecorators(StaffAuth(), UseGuards(MediaManageGuard));
