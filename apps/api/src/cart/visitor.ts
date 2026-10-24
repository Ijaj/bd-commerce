import { randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env';

export const VISITOR_COOKIE = 'bdc_vid';
const YEAR_MS = 365 * 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function visitorCookie(env: Env): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: YEAR_MS,
  };
}

export function readVisitorId(req: Request): string | null {
  const v = req.cookies?.[VISITOR_COOKIE];
  return typeof v === 'string' && UUID.test(v) ? v : null;
}

/** Returns the visitor id, issuing the cookie when the browser has none yet. */
export function ensureVisitorId(req: Request, res: Response, env: Env): string {
  const existing = readVisitorId(req);
  if (existing) return existing;
  const id = randomUUID();
  res.cookie(VISITOR_COOKIE, id, visitorCookie(env));
  return id;
}
