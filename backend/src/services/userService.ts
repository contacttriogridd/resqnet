import type { Prisma, User } from '@prisma/client';
import { adminCreateUserSchema, userAdminUpdateSchema, type Role } from '@resqnet/shared';
import type { z } from 'zod';
import { invalidateUserCache } from '../middleware/auth.js';
import { toPublicUser } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { badRequest, conflict, isUniqueViolation, notFound } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { audit } from './auditService.js';

export async function listUsers(filter: { role?: Role; q?: string }) {
  const where: Prisma.UserWhereInput = {};
  if (filter.role) where.role = filter.role;
  if (filter.q) {
    where.OR = [
      { name: { contains: filter.q, mode: 'insensitive' } },
      { email: { contains: filter.q, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
  return rows.map(toPublicUser);
}

/** Lightweight list for assignment dropdowns. */
export async function listAssignable(role: 'RESPONDER' | 'VOLUNTEER') {
  const roles: Role[] = role === 'RESPONDER' ? ['RESPONDER', 'ADMIN'] : ['VOLUNTEER'];
  return prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
}

async function ensureRoleProfile(user: User) {
  if (user.role === 'RESPONDER') {
    await prisma.responder.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  }
  if (user.role === 'VOLUNTEER') {
    await prisma.volunteer.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  }
}

export async function createUser(input: z.output<typeof adminCreateUserSchema>, actorId: string, ip?: string) {
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      },
    });
    await ensureRoleProfile(user);
    await audit({ actorId, action: 'USER_CREATED', entityType: 'User', entityId: user.id, metadata: { role: user.role }, ipAddress: ip });
    return toPublicUser(user);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('An account with this email already exists.');
    throw err;
  }
}

export async function updateUser(
  id: string,
  input: z.output<typeof userAdminUpdateSchema>,
  actorId: string,
  ip?: string,
) {
  if (id === actorId && (input.role !== undefined || input.isActive === false)) {
    throw badRequest('You cannot change your own role or disable your own account.');
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('User');

  // Never leave the system without an active administrator.
  const losesAdmin =
    existing.role === 'ADMIN' && ((input.role && input.role !== 'ADMIN') || input.isActive === false);
  if (losesAdmin) {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (admins <= 1) throw badRequest('At least one active administrator is required.');
  }

  const user = await prisma.user.update({ where: { id }, data: input });
  if (input.isActive === false) {
    await prisma.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await ensureRoleProfile(user);
  invalidateUserCache(id);
  await audit({
    actorId,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: id,
    metadata: { from: { role: existing.role, isActive: existing.isActive }, to: input },
    ipAddress: ip,
  });
  return toPublicUser(user);
}
