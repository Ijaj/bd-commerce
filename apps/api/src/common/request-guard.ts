import type { NextFunction, Request, Response } from 'express';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** The only routes that take multipart uploads. */
const MULTIPART = [/^\/v1\/admin\/media\/?$/, /^\/v1\/admin\/products\/import(\/preview)?\/?$/];

/**
 * CSRF hardening for cookie sessions, on top of SameSite=Lax:
 * - a browser that says the request is cross-site (`Sec-Fetch-Site`) may not change anything;
 * - a request with a body must be JSON, so a plain HTML form (urlencoded / text/plain) cannot
 *   reach the JSON handlers, except for the upload routes.
 */
export function requestGuard(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl.split('?')[0] ?? '';
  if (!MUTATING.has(req.method) || !path.startsWith('/v1/')) return next();

  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return void res.status(403).json({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Cross-site requests are not allowed',
      code: 'CROSS_SITE',
    });
  }

  const hasBody =
    req.headers['transfer-encoding'] !== undefined ||
    (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0');
  if (hasBody) {
    const type = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
    const ok =
      type === 'application/json' ||
      (type === 'multipart/form-data' && MULTIPART.some((re) => re.test(path)));
    if (!ok) {
      return void res.status(415).json({
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: 'Send application/json',
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
  }
  next();
}
