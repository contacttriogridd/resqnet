/**
 * Idempotent seed: safe to run repeatedly. Creates REAL reference data only:
 *   • disaster types and the built-in safety guides,
 *   • India's national emergency numbers (112, 100, 101, 108, 1078, 1070, 1077, 1091, 1098),
 *   • the administrator account (and optional staff test accounts).
 *
 * It creates no shelters, regional contacts, alerts or incidents — add real
 * ones through the admin screens (Manage data) or the API.
 */
import type { Prisma, Role } from '@prisma/client';
import { DEFAULT_DISASTER_TYPES, DEFAULT_EMERGENCY_CONTACTS, DEFAULT_SAFETY_GUIDES } from '@resqnet/shared';
import { prisma } from '../models/prisma.js';
import { hashPassword } from '../utils/password.js';

const log = (msg: string) => console.log(`  • ${msg}`);

async function seedDisasterTypes() {
  for (const t of DEFAULT_DISASTER_TYPES) {
    await prisma.disasterType.upsert({
      where: { code: t.code },
      update: { name: t.name, description: t.description },
      create: t,
    });
  }
  log(`${DEFAULT_DISASTER_TYPES.length} disaster types`);
}

async function seedGuides() {
  for (const g of DEFAULT_SAFETY_GUIDES) {
    const dt = await prisma.disasterType.findUniqueOrThrow({ where: { code: g.disasterTypeCode } });
    const data = {
      title: g.title,
      summary: g.summary,
      sections: g.sections as unknown as Prisma.InputJsonValue,
      sortOrder: g.sortOrder,
      disasterTypeId: dt.id,
    };
    await prisma.safetyGuide.upsert({ where: { slug: g.slug }, update: data, create: { slug: g.slug, ...data } });
  }
  log(`${DEFAULT_SAFETY_GUIDES.length} safety guides`);
}

async function seedNationalContacts() {
  for (const { key: _key, ...c } of DEFAULT_EMERGENCY_CONTACTS) {
    const data = { ...c, region: null };
    const existing = await prisma.emergencyContact.findFirst({ where: { name: c.name, region: null } });
    if (existing) await prisma.emergencyContact.update({ where: { id: existing.id }, data });
    else await prisma.emergencyContact.create({ data });
  }
  log(`${DEFAULT_EMERGENCY_CONTACTS.length} national emergency numbers`);
}

async function upsertUser(email: string, name: string, role: Role, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const user = await prisma.user.create({
    data: { email, name, role, passwordHash: await hashPassword(password) },
  });
  if (role === 'RESPONDER') await prisma.responder.create({ data: { userId: user.id } });
  if (role === 'VOLUNTEER') await prisma.volunteer.create({ data: { userId: user.id } });
  return user;
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@resqnet.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) {
    throw new Error('Set SEED_ADMIN_PASSWORD (min 10 characters) in .env before seeding.');
  }
  await upsertUser(adminEmail, 'System Administrator', 'ADMIN', adminPassword);
  log(`admin account: ${adminEmail}`);

  // Optional accounts for trying each role. Leave SEED_DEMO_PASSWORD empty in production.
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (demoPassword && demoPassword.length >= 10) {
    await upsertUser('responder@resqnet.local', 'Demo Responder', 'RESPONDER', demoPassword);
    await upsertUser('volunteer@resqnet.local', 'Demo Volunteer', 'VOLUNTEER', demoPassword);
    await upsertUser('civilian@resqnet.local', 'Demo Civilian', 'CIVILIAN', demoPassword);
    log('role test accounts: responder@ / volunteer@ / civilian@resqnet.local (SEED_DEMO_PASSWORD)');
  }
}

async function main() {
  console.log('Seeding RESQNET database…');
  await seedDisasterTypes();
  await seedGuides();
  await seedNationalContacts();
  await seedUsers();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
