import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, deviceHeader, incidentPayload, prisma, resetDb } from './helpers.js';

describe('incident reporting', () => {
  beforeEach(resetDb);

  it('accepts an emergency request without an account (scenario 1)', async () => {
    const device = randomUUID();
    const res = await api().post('/api/incidents').set(deviceHeader(device)).send(incidentPayload()).expect(201);
    expect(res.body.created).toBe(true);
    expect(res.body.incident.referenceCode).toMatch(/^RQ-[2-9A-HJ-NP-Z]{6}$/);
    expect(res.body.incident.status).toBe('RECEIVED');
    expect(res.body.incident.priorityScore).toBeGreaterThan(0);
    // Anonymous callers get back no personal data.
    expect(res.body.incident.contactPhone).toBeNull();

    const row = await prisma.incident.findUniqueOrThrow({ where: { id: res.body.incident.id } });
    expect(row.deviceId).toBe(device);
    expect(row.syncSource).toBe('DIRECT');
  });

  it('is idempotent on clientId — a retried submission never creates a duplicate', async () => {
    const payload = incidentPayload();
    const a = await api().post('/api/incidents').send(payload).expect(201);
    const b = await api().post('/api/incidents').send(payload).expect(200);
    expect(b.body.created).toBe(false);
    expect(b.body.incident.id).toBe(a.body.incident.id);
    expect(await prisma.incident.count()).toBe(1);
  });

  it('handles concurrent duplicate submissions safely', async () => {
    const payload = incidentPayload();
    const results = await Promise.all(Array.from({ length: 5 }, () => api().post('/api/incidents').send(payload)));
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.incident.id)).size).toBe(1);
    expect(await prisma.incident.count()).toBe(1);
  });

  it('validates input on the server', async () => {
    const bad = { ...incidentPayload(), location: { source: 'MANUAL', text: '' } };
    const res = await api().post('/api/incidents').send(bad).expect(422);
    expect(res.body.error.details.some((d: { path: string }) => d.path.startsWith('location'))).toBe(true);
  });

  it('clamps future device clocks to server time', async () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const res = await api().post('/api/incidents').send(incidentPayload({ clientCreatedAt: future })).expect(201);
    expect(new Date(res.body.incident.clientCreatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('lets the reporting device look up and cancel its own request, but no other device', async () => {
    const device = randomUUID();
    const other = randomUUID();
    const payload = incidentPayload();
    await api().post('/api/incidents').set(deviceHeader(device)).send(payload).expect(201);

    const mine = await api().get(`/api/incidents/mine?clientIds=${payload.clientId}`).set(deviceHeader(device)).expect(200);
    expect(mine.body.incidents).toHaveLength(1);
    const theirs = await api().get(`/api/incidents/mine?clientIds=${payload.clientId}`).set(deviceHeader(other)).expect(200);
    expect(theirs.body.incidents).toHaveLength(0);

    await api().post(`/api/incidents/client/${payload.clientId}/cancel`).set(deviceHeader(other)).send({}).expect(404);
    await api()
      .post(`/api/incidents/client/${payload.clientId}/cancel`)
      .set(deviceHeader(device))
      .send({ reason: 'We reached the shelter' })
      .expect(200);
    const row = await prisma.incident.findUniqueOrThrow({ where: { clientId: payload.clientId } });
    expect(row.status).toBe('CANCELLED');
  });
});

describe('incident management (RBAC)', () => {
  beforeEach(resetDb);

  async function seedIncidents() {
    const low = await api().post('/api/incidents').send(incidentPayload({ severity: 'LOW', peopleCount: 'ONE', specialRequirements: [] }));
    const crit = await api().post('/api/incidents').send(incidentPayload({ severity: 'CRITICAL', type: 'TRAPPED' }));
    const med = await api().post('/api/incidents').send(incidentPayload({ severity: 'MEDIUM' }));
    return { low: low.body.incident.id, crit: crit.body.incident.id, med: med.body.incident.id };
  }

  it('denies civilians and anonymous users the incident queue', async () => {
    await api().get('/api/incidents').expect(401);
    const { auth } = await createUser('CIVILIAN');
    await api().get('/api/incidents').set(auth).expect(403);
  });

  it('sorts the responder queue critical → high → medium → low', async () => {
    const ids = await seedIncidents();
    const { auth } = await createUser('RESPONDER');
    const res = await api().get('/api/incidents').set(auth).expect(200);
    expect(res.body.incidents.map((i: { id: string }) => i.id)).toEqual([ids.crit, ids.med, ids.low]);
    // Responders see full detail.
    expect(res.body.incidents[0].contactPhone).toBe('+91 98765 43210');
    expect(res.body.incidents[0].latitude).toBe(11.01834);
  });

  it('shows volunteers approximate location only until they accept a task', async () => {
    const { crit } = await seedIncidents();
    const vol = await createUser('VOLUNTEER');
    const before = await api().get(`/api/incidents/${crit}`).set(vol.auth).expect(200);
    expect(before.body.incident.latitude).toBe(11.02);
    expect(before.body.incident.contactPhone).toBeNull();

    const after = await api().post(`/api/incidents/${crit}/accept`).set(vol.auth).expect(200);
    expect(after.body.incident.latitude).toBe(11.01834);
    expect(after.body.incident.contactPhone).toBe('+91 98765 43210');
    expect(after.body.incident.assignedVolunteer.id).toBe(vol.user.id);
  });

  it('prevents two volunteers from accepting the same task', async () => {
    const { crit } = await seedIncidents();
    const a = await createUser('VOLUNTEER');
    const b = await createUser('VOLUNTEER');
    await api().post(`/api/incidents/${crit}/accept`).set(a.auth).expect(200);
    await api().post(`/api/incidents/${crit}/accept`).set(b.auth).expect(409);
    // And the task disappears from the other volunteer's list.
    const list = await api().get('/api/incidents').set(b.auth).expect(200);
    expect(list.body.incidents.find((i: { id: string }) => i.id === crit)).toBeUndefined();
  });

  it('limits volunteers to in-progress / resolved on their own tasks', async () => {
    const { crit, med } = await seedIncidents();
    const vol = await createUser('VOLUNTEER');
    await api().patch(`/api/incidents/${med}`).set(vol.auth).send({ status: 'IN_PROGRESS' }).expect(403);
    await api().post(`/api/incidents/${crit}/accept`).set(vol.auth).expect(200);
    await api().patch(`/api/incidents/${crit}`).set(vol.auth).send({ status: 'VERIFIED' }).expect(403);
    await api().patch(`/api/incidents/${crit}`).set(vol.auth).send({ severity: 'LOW' }).expect(403);
    const done = await api()
      .patch(`/api/incidents/${crit}`)
      .set(vol.auth)
      .send({ status: 'RESOLVED', note: 'Family moved to Gandhipuram shelter' })
      .expect(200);
    expect(done.body.incident.status).toBe('RESOLVED');
    expect(done.body.incident.resolvedAt).not.toBeNull();
  });

  it('runs the responder workflow: accept → in progress → note → resolve, with history', async () => {
    const { crit } = await seedIncidents();
    const r = await createUser('RESPONDER');
    const accepted = await api().post(`/api/incidents/${crit}/accept`).set(r.auth).expect(200);
    expect(accepted.body.incident.status).toBe('ASSIGNED');
    await api().patch(`/api/incidents/${crit}`).set(r.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    await api().post(`/api/incidents/${crit}/notes`).set(r.auth).send({ note: 'Boat team dispatched' }).expect(201);
    const resolved = await api().patch(`/api/incidents/${crit}`).set(r.auth).send({ status: 'RESOLVED' }).expect(200);
    const history = resolved.body.incident.updates.map((u: { status: string | null; note: string | null }) => u.status ?? u.note);
    expect(history).toEqual(['RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'Boat team dispatched', 'RESOLVED']);
    expect(await prisma.auditLog.count({ where: { entityId: crit } })).toBeGreaterThanOrEqual(3);
  });

  it('rejects invalid status transitions', async () => {
    const { low } = await seedIncidents();
    const r = await createUser('RESPONDER');
    await api().patch(`/api/incidents/${low}`).set(r.auth).send({ status: 'RESOLVED' }).expect(200);
    const res = await api().patch(`/api/incidents/${low}`).set(r.auth).send({ status: 'VERIFIED' }).expect(400);
    expect(res.body.error.message).toMatch(/cannot be marked/);
  });

  it('only allows assigning users who hold the right role', async () => {
    const { med } = await seedIncidents();
    const r = await createUser('RESPONDER');
    const civ = await createUser('CIVILIAN');
    await api().patch(`/api/incidents/${med}`).set(r.auth).send({ assignedResponderId: civ.user.id }).expect(400);
    const ok = await api().patch(`/api/incidents/${med}`).set(r.auth).send({ assignedResponderId: r.user.id }).expect(200);
    expect(ok.body.incident.status).toBe('ASSIGNED');
  });

  it('returns 404 for unknown or malformed ids', async () => {
    const r = await createUser('RESPONDER');
    await api().get(`/api/incidents/${randomUUID()}`).set(r.auth).expect(404);
    await api().get('/api/incidents/not-a-uuid').set(r.auth).expect(422);
  });
});
