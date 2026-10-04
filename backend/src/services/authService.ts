import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import type { AuthResponse, LoginInput } from '@resqnet/shared';
import type { z } from 'zod';
import type { registerSchema } from '@resqnet/shared';
import { env } from '../config/env.js';
import { toPublicUser } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { AppError, conflict, isUniqueViolation, notFound, unauthorized } from '../utils/errors.js';
import { getDummyHash, hashPassword, needsRehash, verifyPassword } from '../utils/password.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../utils/tokens.js';
import { audit } from './auditService.js';

export interface ClientContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessionResult extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

const REFRESH_TTL_MS = env.JWT_REFRESH_TTL_DAYS * 86_400_000;

async function issueSession(user: User, ctx: ClientContext, familyId: string = randomUUID()): Promise<SessionResult> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      userAgent: ctx.userAgent?.slice(0, 300) ?? null,
      ipAddress: ctx.ip ?? null,
      expiresAt: refreshExpiresAt,
    },
  });
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toPublicUser(user),
    refreshToken,
    refreshExpiresAt,
  };
}

export async function register(input: z.output<typeof registerSchema>, ctx: ClientContext): Promise<SessionResult> {
  const passwordHash = await hashPassword(input.password);
  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        role: input.role,
        ...(input.role === 'VOLUNTEER' ? { volunteer: { create: {} } } : {}),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('An account with this email already exists. Try signing in.');
    throw err;
  }
  await audit({ actorId: user.id, action: 'USER_REGISTERED', entityType: 'User', entityId: user.id, ipAddress: ctx.ip });
  return issueSession(user, ctx);
}

export async function login(input: LoginInput, ctx: ClientContext): Promise<SessionResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Always run a verification so timing doesn't reveal whether the email exists.
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);
  if (!user || !ok) {
    await audit({ action: 'LOGIN_FAILED', entityType: 'User', entityId: user?.id, ipAddress: ctx.ip });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Contact an administrator.');

  const data: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
  if (needsRehash(user.passwordHash)) data.passwordHash = await hashPassword(input.password);
  const updated = await prisma.user.update({ where: { id: user.id }, data });

  await audit({ actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ipAddress: ctx.ip });
  return issueSession(updated, ctx);
}

/**
 * Refresh-token rotation with reuse detection: presenting an already-rotated
 * token means it was likely stolen, so the whole token family is revoked.
 */
export async function refresh(token: string | undefined, ctx: ClientContext): Promise<SessionResult> {
  if (!token) throw unauthorized('Your session has expired. Please sign in again.');
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) throw unauthorized('Your session has expired. Please sign in again.');

  if (session.revokedAt) {
    await prisma.refreshSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit({
      actorId: session.userId,
      action: 'REFRESH_TOKEN_REUSE',
      entityType: 'RefreshSession',
      entityId: session.familyId,
      ipAddress: ctx.ip,
    });
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  if (session.expiresAt < new Date() || !session.user.isActive) {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  // Atomically claim the token so two concurrent refreshes can't both succeed.
  const claimed = await prisma.refreshSession.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count === 0) throw unauthorized('Your session has expired. Please sign in again.');

  return issueSession(session.user, ctx, session.familyId);
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Account');
  return toPublicUser(user);
}
