import { beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, incidentPayload, prisma, resetDb } from './helpers.js';

const alertBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'Flood warning',
  disasterTypeCode: 'FLOOD',
  severity: 'CRITICAL',
  region: 'Coimbatore',
  message: 'River levels are rising quickly.',
  instruction: 'Move to higher ground now.',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  ...overrides,
});

const shelterBody = {
  name: 'Test Relief Centre',
  address: '1 Main Road, Coimbatore',
  region: 'Coimbatore',
  latitude: 11.01,
  longitude: 76.95,
  capacity: 100,
  occupancy: 10,
  facilities: ['FOOD', 'WATER'],
};

describe('alerts', () => {
  beforeEach(resetDb);

  it('only lets administrators publish alerts', async () => {
    await api().post('/api/alerts').send(alertBody()).expect(401);
    for (const role of ['CIVILIAN', 'VOLUNTEER', 'RESPONDER'] as const) {
      const { auth } = await createUser(role);
      await api().post('/api/alerts').set(auth).send(alertBody()).expect(403);
    }
  });

  it('publishes, lists by region, and hides expired or deactivated alerts', async () => {
    const { auth } = await createUser('ADMIN');
    const created = await api().post('/api/alerts').set(auth).send(alertBody()).expect(201);
    await api()
      .post('/api/alerts')
      .set(auth)
      .send(alertBody({ title: 'Old', startsAt: new Date(Date.now() - 7200_000).toISOString(), expiresAt: new Date(Date.now() - 3600_000).toISOString() }))
      .expect(201);
    await api().post('/api/alerts').set(auth).send(alertBody({ title: 'Chennai only', region: 'Chennai' })).expect(201);
    await api().post('/api/alerts').set(auth).send(alertBody({ title: 'Everywhere', region: 'All regions', severity: 'INFO' })).expect(201);

    const res = await api().get('/api/alerts/active?region=coimbatore').expect(200);
    expect(res.body.alerts.map((a: { title: string }) => a.title)).toEqual(['Flood warning', 'Everywhere']);

    await api().delete(`/api/alerts/${created.body.alert.id}`).set(auth).expect(200);
    const after = await api().get('/api/alerts/active?region=Coimbatore').expect(200);
    expect(after.body.alerts.map((a: { title: string }) => a.title)).toEqual(['Everywhere']);
  });

  it('rejects an alert that expires before it starts', async () => {
    const { auth } = await createUser('ADMIN');
    await api()
      .post('/api/alerts')
      .set(auth)
      .send(alertBody({ startsAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() }))
      .expect(422);
  });
});

describe('shelters and contacts', () => {
  beforeEach(resetDb);

  it('derives FULL status from occupancy and lets responders update occupancy', async () => {
    const admin = await createUser('ADMIN');
    const responder = await createUser('RESPONDER');
    const civ = await createUser('CIVILIAN');
    const created = await api().post('/api/shelters').set(admin.auth).send(shelterBody).expect(201);
    const id = created.body.shelter.id;
    expect(created.body.shelter.availableCapacity).toBe(90);

    await api().patch(`/api/shelters/${id}`).set(civ.auth).send({ occupancy: 50 }).expect(403);
    const full = await api().patch(`/api/shelters/${id}`).set(responder.auth).send({ occupancy: 100 }).expect(200);
    expect(full.body.shelter).toMatchObject({ status: 'FULL', availableCapacity: 0 });
    // Responders can't delete; admins soft-delete.
    await api().delete(`/api/shelters/${id}`).set(responder.auth).expect(403);
    await api().delete(`/api/shelters/${id}`).set(admin.auth).expect(204);
    await api().get(`/api/shelters/${id}`).expect(404);
  });

  it('returns national + regional contacts and builds an offline pack', async () => {
    const { auth } = await createUser('ADMIN');
    await api().post('/api/emergency-contacts').set(auth).send({ name: 'National', service: 'EMERGENCY', phone: '112' }).expect(201);
    await api().post('/api/emergency-contacts').set(auth).send({ name: 'CBE Room', service: 'CONTROL_ROOM', phone: '1077', region: 'Coimbatore' }).expect(201);
    await api().post('/api/emergency-contacts').set(auth).send({ name: 'MAA Room', service: 'CONTROL_ROOM', phone: '1077', region: 'Chennai' }).expect(201);
    await api().post('/api/shelters').set(auth).send(shelterBody).expect(201);

    const pack = await api().get('/api/offline-pack?region=Coimbatore').expect(200);
    expect(pack.headers['cache-control']).toBe('no-store');
    expect(pack.body.contacts.map((c: { name: string }) => c.name).sort()).toEqual(['CBE Room', 'National']);
    expect(pack.body.shelters).toHaveLength(1);
    expect(pack.body.disasterTypes.length).toBeGreaterThan(5);
    expect(new Date(pack.body.generatedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('rejects invalid phone numbers', async () => {
    const { auth } = await createUser('ADMIN');
    await api()
      .post('/api/emergency-contacts')
      .set(auth)
      .send({ name: 'X', service: 'POLICE', phone: '<script>' })
      .expect(422);
  });
});

describe('user administration', () => {
  beforeEach(resetDb);

  it('lets an admin create responders and change roles, with audit trail', async () => {
    const admin = await createUser('ADMIN');
    const res = await api()
      .post('/api/admin/users')
      .set(admin.auth)
      .send({ name: 'Ravi', email: 'ravi@example.com', password: 'long-password-1', role: 'RESPONDER' })
      .expect(201);
    expect(await prisma.responder.count({ where: { userId: res.body.user.id } })).toBe(1);

    await api().patch(`/api/admin/users/${res.body.user.id}`).set(admin.auth).send({ role: 'VOLUNTEER' }).expect(200);
    expect(await prisma.auditLog.count({ where: { action: 'USER_UPDATED' } })).toBe(1);
  });

  it('prevents an admin from demoting or disabling themselves', async () => {
    const admin = await createUser('ADMIN');
    await api().patch(`/api/admin/users/${admin.user.id}`).set(admin.auth).send({ role: 'CIVILIAN' }).expect(400);
    await api().patch(`/api/admin/users/${admin.user.id}`).set(admin.auth).send({ isActive: false }).expect(400);
  });

  it('applies a role change to existing tokens immediately', async () => {
    const admin = await createUser('ADMIN');
    const target = await createUser('RESPONDER');
    await api().get('/api/incidents').set(target.auth).expect(200);
    await api().patch(`/api/admin/users/${target.user.id}`).set(admin.auth).send({ role: 'CIVILIAN' }).expect(200);
    await api().get('/api/incidents').set(target.auth).expect(403);
  });
});

describe('analytics and demo mode', () => {
  beforeEach(resetDb);

  it('computes analytics and excludes demo data by default', async () => {
    const admin = await createUser('ADMIN');
    await api().post('/api/incidents').send(incidentPayload({ severity: 'CRITICAL' })).expect(201);
    await api().post('/api/demo/rescue-requests').set(admin.auth).send({ region: 'Coimbatore', count: 4 }).expect(201);

    const real = await api().get('/api/admin/analytics').set(admin.auth).expect(200);
    expect(real.body.totals.activeIncidents).toBe(1);
    expect(real.body.totals.criticalIncidents).toBe(1);
    expect(real.body.dailyVolume).toHaveLength(14);
    expect(real.body.dailyVolume.at(-1).count).toBe(1);

    const withDemo = await api().get('/api/admin/analytics?includeDemo=true').set(admin.auth).expect(200);
    expect(withDemo.body.totals.activeIncidents).toBe(5);
  });

  it('flags simulated data and can remove it without touching real data', async () => {
    const admin = await createUser('ADMIN');
    await api().post('/api/incidents').send(incidentPayload()).expect(201);
    const alert = await api().post('/api/demo/flood-alert').set(admin.auth).send({ region: 'Coimbatore' }).expect(201);
    expect(alert.body.alert).toMatchObject({ isDemo: true, severity: 'CRITICAL' });
    expect(alert.body.alert.title).toMatch(/^\[DEMO\]/);
    await api().post('/api/demo/rescue-requests').set(admin.auth).send({ count: 3 }).expect(201);

    const reset = await api().post('/api/demo/reset').set(admin.auth).expect(200);
    expect(reset.body).toEqual({ incidentsRemoved: 3, alertsRemoved: 1 });
    expect(await prisma.incident.count()).toBe(1);
  });

  it('restricts demo controls to administrators', async () => {
    const r = await createUser('RESPONDER');
    await api().post('/api/demo/flood-alert').set(r.auth).send({}).expect(403);
  });
});
