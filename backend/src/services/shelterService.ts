import type { Prisma } from '@prisma/client';
import { shelterCreateSchema, shelterUpdateSchema } from '@resqnet/shared';
import type { z } from 'zod';
import { toShelterDTO } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { badRequest, notFound } from '../utils/errors.js';
import { audit } from './auditService.js';

const include = { resources: { orderBy: { resourceType: 'asc' as const } } } as const;

export function shelterRegionWhere(region?: string): Prisma.ShelterWhereInput {
  return {
    isActive: true,
    ...(region ? { region: { equals: region, mode: 'insensitive' as const } } : {}),
  };
}

export async function listShelters(region?: string) {
  const rows = await prisma.shelter.findMany({
    where: shelterRegionWhere(region),
    include,
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
    take: 500,
  });
  return rows.map(toShelterDTO);
}

export async function listRegions() {
  const rows = await prisma.shelter.groupBy({
    by: ['region'],
    where: { isActive: true },
    _count: { _all: true },
    orderBy: { region: 'asc' },
  });
  return rows.map((r) => ({ region: r.region, shelters: r._count._all }));
}

export async function getShelter(id: string) {
  const row = await prisma.shelter.findFirst({ where: { id, isActive: true }, include });
  if (!row) throw notFound('Shelter');
  return toShelterDTO(row);
}

/** Status follows occupancy unless the shelter was explicitly closed. */
function deriveStatus(capacity: number, occupancy: number, requested?: 'OPEN' | 'FULL' | 'CLOSED') {
  if (requested === 'CLOSED') return 'CLOSED' as const;
  if (occupancy >= capacity) return 'FULL' as const;
  return requested === 'FULL' ? ('FULL' as const) : ('OPEN' as const);
}

export async function createShelter(input: z.output<typeof shelterCreateSchema>, actorId: string, ip?: string) {
  const row = await prisma.shelter.create({
    data: { ...input, status: deriveStatus(input.capacity, input.occupancy, input.status) },
    include,
  });
  await audit({ actorId, action: 'SHELTER_CREATED', entityType: 'Shelter', entityId: row.id, ipAddress: ip });
  return toShelterDTO(row);
}

export async function updateShelter(
  id: string,
  input: z.output<typeof shelterUpdateSchema>,
  actorId: string,
  ip?: string,
) {
  const existing = await prisma.shelter.findFirst({ where: { id, isActive: true } });
  if (!existing) throw notFound('Shelter');
  const capacity = input.capacity ?? existing.capacity;
  const occupancy = input.occupancy ?? existing.occupancy;
  if (occupancy > capacity * 1.5) throw badRequest('Occupancy looks wrong for this capacity.');
  const requested = input.status ?? (existing.status === 'CLOSED' ? 'CLOSED' : undefined);
  const row = await prisma.shelter.update({
    where: { id },
    data: { ...input, status: deriveStatus(capacity, occupancy, requested) },
    include,
  });
  await audit({
    actorId,
    action: 'SHELTER_UPDATED',
    entityType: 'Shelter',
    entityId: id,
    metadata: { fields: Object.keys(input), occupancy: row.occupancy, capacity: row.capacity },
    ipAddress: ip,
  });
  return toShelterDTO(row);
}

/** Soft delete keeps the record for after-action review. */
export async function removeShelter(id: string, actorId: string, ip?: string) {
  const existing = await prisma.shelter.findFirst({ where: { id, isActive: true } });
  if (!existing) throw notFound('Shelter');
  await prisma.shelter.update({ where: { id }, data: { isActive: false, status: 'CLOSED' } });
  await audit({ actorId, action: 'SHELTER_REMOVED', entityType: 'Shelter', entityId: id, ipAddress: ip });
}
