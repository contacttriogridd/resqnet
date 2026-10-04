/**
 * Idempotent seed: safe to run repeatedly. Creates reference data (disaster
 * types, guides, national contacts), an administrator, demo accounts and
 * SAMPLE shelters/alerts/incidents for demonstration.
 *
 * All shelters, regional contacts and incidents created here are FICTIONAL
 * sample data. Sample alerts and incidents are flagged is_demo = true and are
 * labelled DEMO in the app.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma, Role } from '@prisma/client';
import {
  DEFAULT_DISASTER_TYPES,
  DEFAULT_EMERGENCY_CONTACTS,
  DEFAULT_SAFETY_GUIDES,
  type Facility,
} from '@resqnet/shared';
import { prisma } from '../models/prisma.js';
import { createIncident } from '../services/incidentService.js';
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

async function upsertContact(c: {
  name: string;
  service: Prisma.EmergencyContactCreateInput['service'];
  phone: string;
  region: string | null;
  description: string;
  sortOrder: number;
}) {
  const existing = await prisma.emergencyContact.findFirst({ where: { name: c.name, region: c.region } });
  if (existing) await prisma.emergencyContact.update({ where: { id: existing.id }, data: c });
  else await prisma.emergencyContact.create({ data: c });
}

async function seedContacts() {
  for (const { key: _key, ...c } of DEFAULT_EMERGENCY_CONTACTS) {
    await upsertContact({ ...c, region: null });
  }
  // Fictional regional numbers for demonstration only.
  const regional = [
    { name: 'District Hospital Emergency (sample)', service: 'HOSPITAL' as const, phone: '0422 000 0108', region: 'Coimbatore', description: 'SAMPLE DATA — replace with the real number.', sortOrder: 20 },
    { name: 'Shelter Coordinator — Coimbatore (sample)', service: 'SHELTER_COORDINATOR' as const, phone: '0422 000 0200', region: 'Coimbatore', description: 'SAMPLE DATA — replace with the real number.', sortOrder: 21 },
    { name: 'Shelter Coordinator — Chennai (sample)', service: 'SHELTER_COORDINATOR' as const, phone: '044 000 0200', region: 'Chennai', description: 'SAMPLE DATA — replace with the real number.', sortOrder: 21 },
    { name: 'RESQNET Support (sample)', service: 'SUPPORT' as const, phone: '000 000 0000', region: null, description: 'SAMPLE DATA — platform support line.', sortOrder: 50 },
  ];
  for (const c of regional) await upsertContact(c);
  log(`${DEFAULT_EMERGENCY_CONTACTS.length + regional.length} emergency contacts`);
}

async function upsertUser(email: string, name: string, role: Role, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const user = await prisma.user.create({
    data: { email, name, role, passwordHash: await hashPassword(password) },
  });
  if (role === 'RESPONDER') await prisma.responder.create({ data: { userId: user.id, agency: 'District Disaster Response Force', unitCode: 'DDRF-1' } });
  if (role === 'VOLUNTEER') await prisma.volunteer.create({ data: { userId: user.id, skills: ['First aid', 'Swimming'], region: 'Coimbatore' } });
  return user;
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@resqnet.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) {
    throw new Error('Set SEED_ADMIN_PASSWORD (min 10 characters) in .env before seeding.');
  }
  const admin = await upsertUser(adminEmail, 'System Administrator', 'ADMIN', adminPassword);
  log(`admin account: ${adminEmail}`);

  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (demoPassword && demoPassword.length >= 10) {
    await upsertUser('responder@resqnet.local', 'Demo Responder', 'RESPONDER', demoPassword);
    await upsertUser('volunteer@resqnet.local', 'Demo Volunteer', 'VOLUNTEER', demoPassword);
    await upsertUser('civilian@resqnet.local', 'Demo Civilian', 'CIVILIAN', demoPassword);
    log('demo accounts: responder@ / volunteer@ / civilian@resqnet.local (SEED_DEMO_PASSWORD)');
  } else {
    log('demo accounts skipped (SEED_DEMO_PASSWORD not set)');
  }
  return admin;
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
  contactPhone: string;
  accessibilityInfo: string;
}

const SAMPLE_SHELTERS: SampleShelter[] = [
  { name: 'Gandhipuram Community Hall', address: 'Cross Cut Road, Gandhipuram, Coimbatore', region: 'Coimbatore', latitude: 11.0183, longitude: 76.9725, capacity: 300, occupancy: 120, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'WOMEN'], contactPhone: '0422 000 0301', accessibilityInfo: 'Ground-floor hall, ramp at main entrance.' },
  { name: 'R.S. Puram Corporation School Relief Centre', address: 'D.B. Road, R.S. Puram, Coimbatore', region: 'Coimbatore', latitude: 11.0089, longitude: 76.9497, capacity: 450, occupancy: 410, facilities: ['FOOD', 'WATER', 'TOILETS', 'CHILD_FRIENDLY', 'ELECTRICITY'], contactPhone: '0422 000 0302', accessibilityInfo: 'Classrooms on ground and first floor. No lift.' },
  { name: 'Peelamedu Multipurpose Stadium', address: 'Avinashi Road, Peelamedu, Coimbatore', region: 'Coimbatore', latitude: 11.0287, longitude: 77.027, capacity: 800, occupancy: 260, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'DISABLED_ACCESS', 'WOMEN', 'CHILD_FRIENDLY'], contactPhone: '0422 000 0303', accessibilityInfo: 'Step-free access, accessible toilets, wheelchair available.' },
  { name: 'Saibaba Colony Kalyana Mandapam', address: 'N.S.R. Road, Saibaba Colony, Coimbatore', region: 'Coimbatore', latitude: 11.0247, longitude: 76.9411, capacity: 200, occupancy: 200, facilities: ['FOOD', 'WATER', 'TOILETS'], contactPhone: '0422 000 0304', accessibilityInfo: 'Three steps at entrance; staff can assist.' },
  { name: 'Singanallur Government Hr. Sec. School', address: 'Trichy Road, Singanallur, Coimbatore', region: 'Coimbatore', latitude: 10.9989, longitude: 77.0325, capacity: 350, occupancy: 90, facilities: ['WATER', 'TOILETS', 'ELECTRICITY', 'CHARGING'], contactPhone: '0422 000 0305', accessibilityInfo: 'Ground floor available. Uneven path from gate.' },
  { name: 'Kuniyamuthur Panchayat Hall', address: 'Palakkad Main Road, Kuniyamuthur, Coimbatore', region: 'Coimbatore', latitude: 10.9636, longitude: 76.9525, capacity: 150, occupancy: 30, facilities: ['FOOD', 'WATER', 'TOILETS', 'MEDICAL'], contactPhone: '0422 000 0306', accessibilityInfo: 'Ramp available.' },
  { name: 'Velachery Community Centre', address: '100 Feet Road, Velachery, Chennai', region: 'Chennai', latitude: 12.9815, longitude: 80.218, capacity: 500, occupancy: 340, facilities: ['FOOD', 'WATER', 'MEDICAL', 'TOILETS', 'ELECTRICITY', 'CHARGING', 'WOMEN'], contactPhone: '044 000 0401', accessibilityInfo: 'Lift to first floor.' },
  { name: 'T. Nagar Corporation Higher Secondary School', address: 'Thyagaraya Road, T. Nagar, Chennai', region: 'Chennai', latitude: 13.0418, longitude: 80.2341, capacity: 400, occupancy: 120, facilities: ['FOOD', 'WATER', 'TOILETS', 'CHILD_FRIENDLY'], contactPhone: '044 000 0402', accessibilityInfo: 'Ground-floor classrooms.' },
  { name: 'Tambaram Municipal Kalyana Mandapam', address: 'GST Road, Tambaram, Chennai', region: 'Chennai', latitude: 12.9249, longitude: 80.1, capacity: 250, occupancy: 60, facilities: ['FOOD', 'WATER', 'TOILETS', 'DISABLED_ACCESS'], contactPhone: '044 000 0403', accessibilityInfo: 'Step-free entrance and accessible toilet.' },
];

async function seedShelters() {
  for (const s of SAMPLE_SHELTERS) {
    const existing = await prisma.shelter.findFirst({ where: { name: s.name, region: s.region } });
    const status = s.occupancy >= s.capacity ? 'FULL' : 'OPEN';
    const shelter = existing
      ? await prisma.shelter.update({ where: { id: existing.id }, data: { ...s, status } })
      : await prisma.shelter.create({ data: { ...s, status } });
    const resources = [
      { resourceType: 'Drinking water', quantity: Math.round(s.capacity * 3), unit: 'litres' },
      { resourceType: 'Food packets', quantity: Math.round(s.capacity * 1.5), unit: 'packets' },
      { resourceType: 'Blankets', quantity: Math.round(s.capacity * 0.6), unit: 'pieces' },
    ];
    for (const r of resources) {
      await prisma.shelterResource.upsert({
        where: { shelterId_resourceType: { shelterId: shelter.id, resourceType: r.resourceType } },
        update: {},
        create: { shelterId: shelter.id, ...r },
      });
    }
  }
  log(`${SAMPLE_SHELTERS.length} sample shelters (fictional)`);
}

async function seedDemoAlertsAndIncidents(adminId: string) {
  const already = await prisma.alert.count({ where: { isDemo: true } });
  if (already > 0) {
    log('demo alerts/incidents already present — skipped');
    return;
  }
  const rain = await prisma.disasterType.findUniqueOrThrow({ where: { code: 'HEAVY_RAIN' } });
  const flood = await prisma.disasterType.findUniqueOrThrow({ where: { code: 'FLOOD' } });
  const now = Date.now();
  await prisma.alert.createMany({
    data: [
      {
        title: '[DEMO] Flood warning — low-lying areas',
        disasterTypeId: flood.id,
        severity: 'WARNING',
        region: 'Coimbatore',
        message: 'SAMPLE ALERT: Rising water levels reported near Ukkadam and Singanallur lakes.',
        instruction: 'Avoid low-lying roads. Move valuables and family members to higher floors. Keep your phone charged.',
        startsAt: new Date(now - 2 * 3600_000),
        expiresAt: new Date(now + 48 * 3600_000),
        isDemo: true,
        createdById: adminId,
      },
      {
        title: '[DEMO] Heavy rainfall advisory',
        disasterTypeId: rain.id,
        severity: 'ADVISORY',
        region: 'All regions',
        message: 'SAMPLE ALERT: Heavy to very heavy rainfall is likely over the next 24 hours.',
        instruction: 'Stay indoors during heavy rain. Do not cross flowing streams or flooded roads.',
        startsAt: new Date(now - 3600_000),
        expiresAt: new Date(now + 24 * 3600_000),
        isDemo: true,
        createdById: adminId,
      },
    ],
  });

  const samples = [
    { type: 'TRAPPED', severity: 'CRITICAL', peopleCount: 'TWO_TO_FIVE', specialRequirements: ['ELDERLY', 'CHILD'], lat: 10.989, lng: 76.961, text: '[DEMO] Ukkadam, near lake bund — family on rooftop' },
    { type: 'MEDICAL', severity: 'HIGH', peopleCount: 'ONE', specialRequirements: ['INJURED'], lat: 11.0012, lng: 77.0281, text: '[DEMO] Singanallur, Kamaraj Road' },
    { type: 'FOOD_WATER', severity: 'MEDIUM', peopleCount: 'MORE_THAN_TEN', specialRequirements: ['NO_WATER', 'NO_FOOD'], lat: 11.0151, lng: 76.9663, text: '[DEMO] Gandhipuram 5th street apartment block' },
    { type: 'EVACUATION', severity: 'HIGH', peopleCount: 'SIX_TO_TEN', specialRequirements: ['DISABLED'], lat: 10.9701, lng: 76.9558, text: '[DEMO] Kuniyamuthur riverside houses' },
    { type: 'FLOOD', severity: 'LOW', peopleCount: 'ONE', specialRequirements: [], lat: 11.0301, lng: 76.9402, text: '[DEMO] Saibaba Colony — water entering ground floor' },
  ] as const;
  for (const [i, s] of samples.entries()) {
    await createIncident(
      {
        clientId: randomUUID(),
        type: s.type,
        severity: s.severity,
        peopleCount: s.peopleCount,
        specialRequirements: [...s.specialRequirements],
        location: { latitude: s.lat, longitude: s.lng, accuracyMeters: 15, text: s.text, source: 'GPS' },
        description: 'SAMPLE DATA — demonstration incident, not a real emergency.',
        clientCreatedAt: new Date(now - (i + 1) * 17 * 60_000).toISOString(),
      },
      { source: 'DIRECT', isDemo: true },
    );
  }
  log(`2 demo alerts and ${samples.length} demo incidents`);
}

async function main() {
  console.log('Seeding RESQNET database…');
  await seedDisasterTypes();
  await seedGuides();
  await seedContacts();
  const admin = await seedUsers();
  await seedShelters();
  await seedDemoAlertsAndIncidents(admin.id);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
