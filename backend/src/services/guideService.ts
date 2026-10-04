import type { Prisma } from '@prisma/client';
import {
  disasterTypeCreateSchema,
  disasterTypeUpdateSchema,
  guideCreateSchema,
  guideUpdateSchema,
} from '@resqnet/shared';
import type { z } from 'zod';
import { toDisasterTypeDTO, toGuideDTO } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { badRequest, conflict, isUniqueViolation, notFound } from '../utils/errors.js';
import { audit } from './auditService.js';

const include = { disasterType: true } as const;

export async function listGuides() {
  const rows = await prisma.safetyGuide.findMany({
    where: { isPublished: true },
    include,
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  return rows.map(toGuideDTO);
}

/** Accepts either a UUID or a slug. */
export async function getGuide(idOrSlug: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const row = await prisma.safetyGuide.findFirst({
    where: { isPublished: true, ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug.toLowerCase() }) },
    include,
  });
  if (!row) throw notFound('Safety guide');
  return toGuideDTO(row);
}

async function typeIdFor(code: string) {
  const dt = await prisma.disasterType.findUnique({ where: { code: code.toUpperCase() } });
  if (!dt) throw badRequest(`Unknown disaster type "${code}".`);
  return dt.id;
}

export async function createGuide(input: z.output<typeof guideCreateSchema>, actorId: string, ip?: string) {
  try {
    const row = await prisma.safetyGuide.create({
      data: {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        sections: input.sections as Prisma.InputJsonValue,
        sortOrder: input.sortOrder,
        disasterTypeId: await typeIdFor(input.disasterTypeCode),
      },
      include,
    });
    await audit({ actorId, action: 'GUIDE_CREATED', entityType: 'SafetyGuide', entityId: row.id, ipAddress: ip });
    return toGuideDTO(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('A guide with this slug already exists.');
    throw err;
  }
}

export async function updateGuide(id: string, input: z.output<typeof guideUpdateSchema>, actorId: string, ip?: string) {
  const existing = await prisma.safetyGuide.findUnique({ where: { id } });
  if (!existing) throw notFound('Safety guide');
  const { disasterTypeCode, sections, ...rest } = input;
  try {
    const row = await prisma.safetyGuide.update({
      where: { id },
      data: {
        ...rest,
        ...(sections ? { sections: sections as Prisma.InputJsonValue } : {}),
        ...(disasterTypeCode ? { disasterTypeId: await typeIdFor(disasterTypeCode) } : {}),
      },
      include,
    });
    await audit({ actorId, action: 'GUIDE_UPDATED', entityType: 'SafetyGuide', entityId: id, ipAddress: ip });
    return toGuideDTO(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('A guide with this slug already exists.');
    throw err;
  }
}

export async function unpublishGuide(id: string, actorId: string, ip?: string) {
  const existing = await prisma.safetyGuide.findUnique({ where: { id } });
  if (!existing) throw notFound('Safety guide');
  await prisma.safetyGuide.update({ where: { id }, data: { isPublished: false } });
  await audit({ actorId, action: 'GUIDE_UNPUBLISHED', entityType: 'SafetyGuide', entityId: id, ipAddress: ip });
}

/* ── Disaster types ── */

export async function listDisasterTypes() {
  const rows = await prisma.disasterType.findMany({ orderBy: { name: 'asc' } });
  return rows.map(toDisasterTypeDTO);
}

export async function createDisasterType(input: z.output<typeof disasterTypeCreateSchema>, actorId: string) {
  try {
    const row = await prisma.disasterType.create({ data: { ...input, description: input.description ?? null } });
    await audit({ actorId, action: 'DISASTER_TYPE_CREATED', entityType: 'DisasterType', entityId: row.id });
    return toDisasterTypeDTO(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('A disaster type with this code already exists.');
    throw err;
  }
}

export async function updateDisasterType(id: string, input: z.output<typeof disasterTypeUpdateSchema>, actorId: string) {
  const existing = await prisma.disasterType.findUnique({ where: { id } });
  if (!existing) throw notFound('Disaster type');
  const row = await prisma.disasterType.update({ where: { id }, data: input });
  await audit({ actorId, action: 'DISASTER_TYPE_UPDATED', entityType: 'DisasterType', entityId: id });
  return toDisasterTypeDTO(row);
}
