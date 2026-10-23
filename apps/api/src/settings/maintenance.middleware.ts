import { HttpStatus, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SettingsService } from './settings.service';

/** Paths that keep working in maintenance mode: admin, the site-status endpoint, health and docs. */
const OPEN = [/^\/v1\/admin(\/|$)/, /^\/v1\/public\/site$/, /^\/health$/, /^\/docs/];

/** While maintenance_mode is on, every other API route (customer-facing) answers 503. */
@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly settings: SettingsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0] ?? '';
    if (OPEN.some((re) => re.test(path))) return next();
    const mode = await this.settings.get('maintenance_mode');
    if (!mode.enabled) return next();
    res
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .set('Retry-After', '300')
      .json({ statusCode: 503, error: 'Maintenance', message: mode.message });
  }
}
