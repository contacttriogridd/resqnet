import type { Prisma } from '@prisma/client';
import { safetyStatusCreateSchema } from '@resqnet/shared';
import type { z } from 'zod';
import { toSafetyStatusDTO } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { badRequest, isUniqueViolation } from '../utils/errors.js';
import type { ReporterContext } from './incidentService.js';

type Input = z.output<typeof safetyStatusCreateSchema>;

/** Idempotent on clientId, like incidents. */
export async function recordSafetyStatus(input: Input, ctx: ReporterContext) {
  const deviceId = ctx.deviceId ?? input.deviceId;
  if (!ctx.userId && !deviceId) throw badRequest('Sign in or allow this device to be identified to share your status.');

  const existing = await prisma.userSafetyStatus.findUnique({ where: { clientId: input.clientId } });
  if (existing) return { status: toSafetyStatusDTO(existing), created: false };

  try {
    const row = await prisma.userSafetyStatus.create({
      data: {
        clientId: input.clientId,
        userId: ctx.userId ?? null,
        deviceId: deviceId ?? null,
        status: input.status,
        note: input.note ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        clientCreatedAt: new Date(Math.min(new Date(input.clientCreatedAt).getTime(), Date.now())),
      },
    });
    return { status: toSafetyStatusDTO(row), created: true };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const row = await prisma.userSafetyStatus.findUniqueOrThrow({ where: { clientId: input.clientId } });
    return { status: toSafetyStatusDTO(row), created: false };
  }
}

export async function latestSafetyStatus(ctx: ReporterContext) {
  const owner: Prisma.UserSafetyStatusWhereInput[] = [];
  if (ctx.userId) owner.push({ userId: ctx.userId });
  if (ctx.deviceId) owner.push({ deviceId: ctx.deviceId });
  if (owner.length === 0) return null;
  const row = await prisma.userSafetyStatus.findFirst({
    where: { OR: owner },
    orderBy: { clientCreatedAt: 'desc' },
  });
  return row ? toSafetyStatusDTO(row) : null;
}
