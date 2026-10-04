/**
 * Test fixtures for the Playwright E2E database ONLY (TEST_E2E_DATABASE_URL).
 * The production seed contains no shelters, so the offline-shelter scenario
 * needs one of its own. Idempotent.
 */
import { prisma } from '../src/models/prisma.js';

const name = 'E2E Test Shelter';
const data = {
  name,
  address: 'E2E fixture — not a real place',
  region: 'Coimbatore',
  latitude: 11.0287,
  longitude: 77.027,
  capacity: 800,
  occupancy: 260,
  facilities: ['FOOD', 'WATER', 'DISABLED_ACCESS'],
  status: 'OPEN' as const,
};

const existing = await prisma.shelter.findFirst({ where: { name } });
if (existing) await prisma.shelter.update({ where: { id: existing.id }, data });
else await prisma.shelter.create({ data });
await prisma.$disconnect();
