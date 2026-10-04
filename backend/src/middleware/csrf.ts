import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { forbidden } from '../utils/errors.js';

/**
 * CSRF defence for the only endpoints that authenticate via cookie
 * (/auth/refresh and /auth/logout). Everything else uses a bearer token,
 * which browsers never attach automatically, so it is not CSRF-exposed.
 *
 *  1. The refresh cookie is HttpOnly + SameSite=Strict + Path=/api/auth.
 *  2. A custom header is required; cross-site forms cannot set it, and a
 *     cross-origin fetch that sets it triggers a CORS preflight we reject.
 *  3. If the browser sends Origin, it must be in the allow-list.
 */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'resqnet';

export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) return next(forbidden('Request blocked for your security.'));
  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin, req)) return next(forbidden('Request blocked for your security.'));
  next();
}

export function isAllowedOrigin(origin: string, req?: Request): boolean {
  if (env.CORS_ORIGINS.includes(origin)) return true;
  // Same-origin deployments (frontend served by the same host as the API).
  if (req) {
    const host = req.get('host');
    if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  }
  return false;
}
