import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import { DEFAULT_DISASTER_TYPES, type IncidentCreateInput } from '@resqnet/shared';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/models/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/tokens.js';

export const app = createApp();
export const api = () => supertest(app);

export const TEST_PASSWORD = 'correct-horse-battery';

/** Wipes all data and restores minimal reference data. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await prisma.disasterType.createMany({ data: DEFAULT_DISASTER_TYPES });
}

let hashCache: string | undefined;

export async function createUser(role: Role, overrides: { email?: string; name?: string } = {}) {
  hashCache ??= await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`,
      name: overrides.name ?? `Test ${role.toLowerCase()}`,
      role,
      passwordHash: hashCache,
    },
  });
  const token = signAccessToken({ sub: user.id, role: user.role });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

export function incidentPayload(overrides: Partial<IncidentCreateInput> = {}): IncidentCreateInput {
  return {
    clientId: randomUUID(),
    type: 'FLOOD',
    severity: 'HIGH',
    peopleCount: 'TWO_TO_FIVE',
    specialRequirements: ['CHILD'],
    location: { latitude: 11.01834, longitude: 76.97251, accuracyMeters: 12, source: 'GPS' },
    description: 'Water rising in the ground floor',
    contactPhone: '+91 98765 43210',
    clientCreatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const deviceHeader = (deviceId: string) => ({ 'X-Device-Id': deviceId });

export { prisma };
