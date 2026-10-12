/**
 * Idempotent seed: safe to run repeatedly. Creates:
 *   • disaster types and the built-in safety guides,
 *   • India's national emergency numbers (112, 100, 101, 108, 1078, 1070, 1077, 1091, 1098),
 *   • SAMPLE relief shelters for Coimbatore and Chennai (see SAMPLE_SHELTERS),
 *   • the administrator account (and optional staff test accounts).
 *
 * It creates no regional contacts, alerts or incidents — add real ones through
 * the admin screens (Manage data) or the API.
 */
import type { Prisma, Role } from '@prisma/client';
import {
  DEFAULT_DISASTER_TYPES,
  DEFAULT_EMERGENCY_CONTACTS,
  DEFAULT_SAFETY_GUIDES,
  type Facility,
} from '@resqnet/shared';
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

interface SampleShelter {
  name: string;
  address: string;
  region: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupancy: number;
  facilities: Facility[];
  accessibilityInfo: string;
}

/**
 * Sample relief shelters in real localities. The buildings and occupancy figures
 * are illustrative, not official relief-camp designations. The contact number is
 * 1077, the real District Emergency Operation Centre line that coordinates relief camps.
 */
const SAMPLE_SHELTERS: SampleShelter[] = [
  // Coimbatore
  { name: 'Gandhipuram Community Hall', address: 'Cross Cut Road, Gandhipuram, Coimbatore', region: 'Coimbatore', latitude: 11.0183, longitude: 76.9725, capacity: 300, occupancy: 120, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'WOMEN'], accessibilityInfo: 'Ground-floor hall, ramp at main entrance.' },
  { name: 'R.S. Puram Corporation School Relief Centre', address: 'D.B. Road, R.S. Puram, Coimbatore', region: 'Coimbatore', latitude: 11.0089, longitude: 76.9497, capacity: 450, occupancy: 410, facilities: ['FOOD', 'WATER', 'TOILETS', 'CHILD_FRIENDLY', 'ELECTRICITY'], accessibilityInfo: 'Classrooms on ground and first floor. No lift.' },
  { name: 'Peelamedu Multipurpose Stadium', address: 'Avinashi Road, Peelamedu, Coimbatore', region: 'Coimbatore', latitude: 11.0287, longitude: 77.027, capacity: 800, occupancy: 260, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'DISABLED_ACCESS', 'WOMEN', 'CHILD_FRIENDLY'], accessibilityInfo: 'Step-free access, accessible toilets, wheelchair available.' },
  { name: 'Saibaba Colony Kalyana Mandapam', address: 'N.S.R. Road, Saibaba Colony, Coimbatore', region: 'Coimbatore', latitude: 11.0247, longitude: 76.9411, capacity: 200, occupancy: 200, facilities: ['FOOD', 'WATER', 'TOILETS'], accessibilityInfo: 'Three steps at entrance; staff can assist.' },
  { name: 'Singanallur Government Higher Secondary School', address: 'Trichy Road, Singanallur, Coimbatore', region: 'Coimbatore', latitude: 10.9989, longitude: 77.0325, capacity: 350, occupancy: 90, facilities: ['WATER', 'TOILETS', 'ELECTRICITY', 'CHARGING'], accessibilityInfo: 'Ground floor available. Uneven path from gate.' },
  { name: 'Kuniyamuthur Panchayat Hall', address: 'Palakkad Main Road, Kuniyamuthur, Coimbatore', region: 'Coimbatore', latitude: 10.9636, longitude: 76.9525, capacity: 150, occupancy: 30, facilities: ['FOOD', 'WATER', 'TOILETS', 'MEDICAL'], accessibilityInfo: 'Ramp available.' },
  { name: 'Ganapathy Corporation Marriage Hall', address: 'Sathy Road, Ganapathy, Coimbatore', region: 'Coimbatore', latitude: 11.0418, longitude: 76.981, capacity: 280, occupancy: 75, facilities: ['FOOD', 'WATER', 'TOILETS', 'ELECTRICITY', 'WOMEN', 'CHILD_FRIENDLY', 'DISABLED_ACCESS'], accessibilityInfo: 'Ground-floor hall with a ramp; accessible toilet.' },
  { name: 'Vadavalli Community Hall', address: 'Marudhamalai Road, Vadavalli, Coimbatore', region: 'Coimbatore', latitude: 11.0236, longitude: 76.9037, capacity: 180, occupancy: 0, facilities: ['WATER', 'TOILETS', 'ELECTRICITY', 'CHARGING'], accessibilityInfo: 'Single-storey building; two low steps at entrance.' },
  // Chennai
  { name: 'Velachery Community Centre', address: '100 Feet Road, Velachery, Chennai', region: 'Chennai', latitude: 12.9815, longitude: 80.218, capacity: 500, occupancy: 340, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'WOMEN'], accessibilityInfo: 'Lift to first floor.' },
  { name: 'T. Nagar Corporation Higher Secondary School', address: 'Thyagaraya Road, T. Nagar, Chennai', region: 'Chennai', latitude: 13.0418, longitude: 80.2341, capacity: 400, occupancy: 120, facilities: ['FOOD', 'WATER', 'TOILETS', 'CHILD_FRIENDLY'], accessibilityInfo: 'Ground-floor classrooms.' },
  { name: 'Tambaram Municipal Kalyana Mandapam', address: 'GST Road, Tambaram, Chennai', region: 'Chennai', latitude: 12.9249, longitude: 80.1, capacity: 250, occupancy: 60, facilities: ['FOOD', 'WATER', 'TOILETS', 'DISABLED_ACCESS'], accessibilityInfo: 'Step-free entrance and accessible toilet.' },
  { name: 'Saidapet Corporation Community Hall', address: 'Anna Salai, Saidapet, Chennai', region: 'Chennai', latitude: 13.0213, longitude: 80.2231, capacity: 220, occupancy: 205, facilities: ['FOOD', 'WATER', 'TOILETS', 'ELECTRICITY'], accessibilityInfo: 'First-floor hall reached by stairs only.' },
  { name: 'Royapuram Multi-Purpose Cyclone Shelter', address: 'Suryanarayana Road, Royapuram, Chennai', region: 'Chennai', latitude: 13.1137, longitude: 80.2954, capacity: 600, occupancy: 150, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'WOMEN', 'CHILD_FRIENDLY', 'DISABLED_ACCESS'], accessibilityInfo: 'Raised ground floor with a ramp; accessible toilets.' },
  { name: 'Mudichur Government High School', address: 'Mudichur Main Road, Mudichur, Chennai', region: 'Chennai', latitude: 12.915, longitude: 80.07, capacity: 300, occupancy: 45, facilities: ['FOOD', 'WATER', 'TOILETS', 'CHARGING'], accessibilityInfo: 'Ground-floor classrooms; ramp at side gate.' },
];

/**
 * Creates each sample shelter only if no shelter with that name exists in the
 * region (active or removed), so admin edits and removals survive re-seeding.
 */
async function seedShelters() {
  let created = 0;
  for (const s of SAMPLE_SHELTERS) {
    const existing = await prisma.shelter.findFirst({ where: { name: s.name, region: s.region } });
    if (existing) continue;
    const resources = [
      { resourceType: 'Drinking water', quantity: s.capacity * 3, unit: 'litres' },
      { resourceType: 'Food packets', quantity: Math.round(s.capacity * 1.5), unit: 'packets' },
      { resourceType: 'Blankets', quantity: Math.round(s.capacity * 0.6), unit: 'pieces' },
      ...(s.facilities.includes('MEDICAL')
        ? [{ resourceType: 'First-aid kits', quantity: Math.ceil(s.capacity / 50), unit: 'kits' }]
        : []),
    ];
    await prisma.shelter.create({
      data: {
        ...s,
        contactPhone: '1077',
        status: s.occupancy >= s.capacity ? 'FULL' : 'OPEN',
        resources: { create: resources },
      },
    });
    created++;
  }
  log(`${SAMPLE_SHELTERS.length} sample shelters (${created} new)`);
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
  await seedShelters();
  await seedUsers();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
