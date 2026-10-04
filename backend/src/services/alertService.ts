import type { Prisma } from '@prisma/client';
import { alertCreateSchema, alertUpdateSchema } from '@resqnet/shared';
import type { z } from 'zod';
import { toAlertDTO } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { badRequest, notFound } from '../utils/errors.js';
import { audit } from './auditService.js';

/** Alerts whose region is one of these apply everywhere. */
export const GLOBAL_REGIONS = ['All', 'All regions', 'Nationwide'];

export function regionFilter(region?: string): Prisma.AlertWhereInput {
  if (!region) return {};
  return {
    OR: [
      { region: { equals: region, mode: 'insensitive' } },
      { region: { contains: region, mode: 'insensitive' } },
      { region: { in: GLOBAL_REGIONS, mode: 'insensitive' } },
    ],
  };
}

export function activeAlertWhere(now = new Date()): Prisma.AlertWhereInput {
  return { isActive: true, startsAt: { lte: now }, expiresAt: { gt: now } };
}

const include = { disasterType: true } as const;
const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, ADVISORY: 2, INFO: 3 } as const;

export async function listActiveAlerts(region?: string) {
  const rows = await prisma.alert.findMany({
    where: { AND: [activeAlertWhere(), regionFilter(region)] },
    include,
    orderBy: { startsAt: 'desc' },
    take: 100,
  });
  return rows
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || +b.startsAt - +a.startsAt)
    .map(toAlertDTO);
}

/** All alerts including expired/inactive (admin history view). */
export async function listAllAlerts(limit = 200) {
  const rows = await prisma.alert.findMany({ include, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map(toAlertDTO);
}

export async function getAlert(id: string) {
  const row = await prisma.alert.findUnique({ where: { id }, include });
  if (!row) throw notFound('Alert');
  return toAlertDTO(row);
}

async function disasterTypeId(code: string) {
  const dt = await prisma.disasterType.findUnique({ where: { code: code.toUpperCase() } });
  if (!dt) throw badRequest(`Unknown disaster type "${code}".`);
  return dt.id;
}

export async function createAlert(
  input: z.output<typeof alertCreateSchema>,
  actorId: string,
  opts: { isDemo?: boolean; ip?: string } = {},
) {
  const row = await prisma.alert.create({
    data: {
      title: input.title,
      disasterTypeId: await disasterTypeId(input.disasterTypeCode),
      severity: input.severity,
      region: input.region,
      message: input.message,
      instruction: input.instruction,
      startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
      expiresAt: new Date(input.expiresAt),
      isDemo: opts.isDemo ?? false,
      createdById: actorId,
    },
    include,
  });
  await audit({
    actorId,
    action: opts.isDemo ? 'DEMO_ALERT_CREATED' : 'ALERT_CREATED',
    entityType: 'Alert',
    entityId: row.id,
    metadata: { severity: row.severity, region: row.region },
    ipAddress: opts.ip,
  });
  return toAlertDTO(row);
}

export async function updateAlert(id: string, input: z.output<typeof alertUpdateSchema>, actorId: string, ip?: string) {
  const existing = await prisma.alert.findUnique({ where: { id } });
  if (!existing) throw notFound('Alert');
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
  if (expiresAt && expiresAt <= existing.startsAt) throw badRequest('Expiry must be after the start time.');
  const row = await prisma.alert.update({
    where: { id },
    data: { ...input, expiresAt },
    include,
  });
  await audit({ actorId, action: 'ALERT_UPDATED', entityType: 'Alert', entityId: id, metadata: input, ipAddress: ip });
  return toAlertDTO(row);
}

/** Alerts are deactivated, never hard-deleted, to keep the historical record. */
export async function deactivateAlert(id: string, actorId: string, ip?: string) {
  return updateAlert(id, { isActive: false }, actorId, ip);
}
