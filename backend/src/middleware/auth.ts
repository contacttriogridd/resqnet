import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@resqnet/shared';
import { prisma } from '../models/prisma.js';
import { AppError, forbidden, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Short-lived cache of account state so a deactivated or re-roled account
 * loses access within seconds, without a DB round-trip on every request.
 */
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { at: number; active: boolean; role: Role; name: string }>();

export function invalidateUserCache(userId: string) {
  userCache.delete(userId);
}

async function loadUserState(userId: string) {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < USER_CACHE_TTL_MS) return hit;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, name: true },
  });
  const state = { at: Date.now(), active: !!user?.isActive, role: (user?.role ?? 'CIVILIAN') as Role, name: user?.name ?? '' };
  userCache.set(userId, state);
  if (userCache.size > 5000) userCache.clear();
  return state;
}

/**
 * Optional authentication: attaches `req.auth` when a valid bearer token is
 * present. A *present but invalid* token is rejected (401) so the client knows
 * to refresh, rather than silently being treated as anonymous.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const deviceId = req.get('x-device-id');
  if (deviceId && UUID_RE.test(deviceId)) req.deviceId = deviceId.toLowerCase();

  const header = req.get('authorization');
  if (!header) return next();
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (err) {
    const expired = (err as Error).name === 'TokenExpiredError';
    return next(
      new AppError(401, expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN', 'Your session has expired. Please sign in again.'),
    );
  }

  try {
    const state = await loadUserState(claims.sub);
    if (!state.active) return next(new AppError(401, 'ACCOUNT_DISABLED', 'This account has been disabled.'));
    // Role is taken from the database, not the token, so demotions apply immediately.
    req.auth = { userId: claims.sub, role: state.role, name: state.name };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}
