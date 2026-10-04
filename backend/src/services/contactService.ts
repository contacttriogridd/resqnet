import { contactCreateSchema, contactUpdateSchema } from '@resqnet/shared';
import type { z } from 'zod';
import { toContactDTO } from '../models/mappers.js';
import { prisma } from '../models/prisma.js';
import { notFound } from '../utils/errors.js';
import { audit } from './auditService.js';

/** National contacts (region = NULL) are always included alongside regional ones. */
export async function listContacts(region?: string) {
  const rows = await prisma.emergencyContact.findMany({
    where: {
      isActive: true,
      ...(region ? { OR: [{ region: null }, { region: { equals: region, mode: 'insensitive' } }] } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toContactDTO);
}

export async function createContact(input: z.output<typeof contactCreateSchema>, actorId: string, ip?: string) {
  const row = await prisma.emergencyContact.create({ data: { ...input, region: input.region ?? null } });
  await audit({ actorId, action: 'CONTACT_CREATED', entityType: 'EmergencyContact', entityId: row.id, ipAddress: ip });
  return toContactDTO(row);
}

export async function updateContact(
  id: string,
  input: z.output<typeof contactUpdateSchema>,
  actorId: string,
  ip?: string,
) {
  const existing = await prisma.emergencyContact.findFirst({ where: { id, isActive: true } });
  if (!existing) throw notFound('Contact');
  const row = await prisma.emergencyContact.update({ where: { id }, data: input });
  await audit({ actorId, action: 'CONTACT_UPDATED', entityType: 'EmergencyContact', entityId: id, ipAddress: ip });
  return toContactDTO(row);
}

export async function removeContact(id: string, actorId: string, ip?: string) {
  const existing = await prisma.emergencyContact.findFirst({ where: { id, isActive: true } });
  if (!existing) throw notFound('Contact');
  await prisma.emergencyContact.update({ where: { id }, data: { isActive: false } });
  await audit({ actorId, action: 'CONTACT_REMOVED', entityType: 'EmergencyContact', entityId: id, ipAddress: ip });
}
