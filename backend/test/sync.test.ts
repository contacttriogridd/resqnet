import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, incidentPayload, prisma, resetDb } from './helpers.js';

function incidentOp(payload = incidentPayload(), overrides: Record<string, unknown> = {}) {
  return {
    operationId: randomUUID(),
    entityType: 'INCIDENT',
    entityId: payload.clientId,
    operationType: 'CREATE',
    payload,
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    retryCount: 2,
    ...overrides,
  };
}

function safetyOp(deviceId: string) {
  const clientId = randomUUID();
  return {
    operationId: randomUUID(),
    entityType: 'SAFETY_STATUS',
    entityId: clientId,
    operationType: 'CREATE',
    payload: { clientId, deviceId, status: 'NEED_ASSISTANCE', clientCreatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  };
}

describe('offline synchronisation (/api/sync)', () => {
  beforeEach(resetDb);

  it('applies queued operations in order and records them (scenario 3)', async () => {
    const deviceId = randomUUID();
    const queuedAt = new Date(Date.now() - 20 * 60_000).toISOString();
    const ops = [incidentOp(incidentPayload({ clientCreatedAt: queuedAt })), incidentOp(), safetyOp(deviceId)];
    const res = await api().post('/api/sync').send({ deviceId, operations: ops }).expect(200);

    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['APPLIED', 'APPLIED', 'APPLIED']);
    expect(res.body.results[0].referenceCode).toMatch(/^RQ-/);
    expect(await prisma.incident.count({ where: { syncSource: 'SYNC', deviceId } })).toBe(2);
    expect(await prisma.userSafetyStatus.count({ where: { deviceId } })).toBe(1);
    expect(await prisma.syncLog.count({ where: { deviceId } })).toBe(3);

    const log = await prisma.syncLog.findFirstOrThrow({ where: { operationId: ops[0]!.operationId } });
    expect(log.retryCount).toBe(2);
    // The original press-send time is preserved for triage.
    const incident = await prisma.incident.findUniqueOrThrow({ where: { clientId: ops[0]!.entityId } });
    expect(incident.createdAt.getTime() - incident.clientCreatedAt.getTime()).toBeGreaterThan(15 * 60_000);
  });

  it('treats a replayed batch as duplicates and creates nothing new', async () => {
    const deviceId = randomUUID();
    const ops = [incidentOp(), safetyOp(deviceId)];
    const first = await api().post('/api/sync').send({ deviceId, operations: ops }).expect(200);
    const again = await api().post('/api/sync').send({ deviceId, operations: ops }).expect(200);

    expect(again.body.results.map((r: { status: string }) => r.status)).toEqual(['DUPLICATE', 'DUPLICATE']);
    expect(again.body.results[0].serverId).toBe(first.body.results[0].serverId);
    expect(again.body.results[0].referenceCode).toBe(first.body.results[0].referenceCode);
    expect(await prisma.incident.count()).toBe(1);
    expect(await prisma.userSafetyStatus.count()).toBe(1);
  });

  it('deduplicates a request that reached the server directly AND via the queue', async () => {
    const payload = incidentPayload();
    const direct = await api().post('/api/incidents').send(payload).expect(201);
    const res = await api()
      .post('/api/sync')
      .send({ deviceId: randomUUID(), operations: [incidentOp(payload)] })
      .expect(200);
    expect(res.body.results[0]).toMatchObject({ status: 'DUPLICATE', serverId: direct.body.incident.id });
    expect(await prisma.incident.count()).toBe(1);
  });

  it('rejects an invalid operation without blocking the rest of the queue', async () => {
    const deviceId = randomUUID();
    const bad = incidentOp({ ...incidentPayload(), severity: 'APOCALYPTIC' } as never);
    const mismatched = incidentOp(incidentPayload(), { entityId: randomUUID() });
    const good = incidentOp();
    const res = await api().post('/api/sync').send({ deviceId, operations: [bad, mismatched, good] }).expect(200);

    expect(res.body.results[0]).toMatchObject({ status: 'REJECTED', retryable: false });
    expect(res.body.results[1]).toMatchObject({ status: 'REJECTED', retryable: false });
    expect(res.body.results[2].status).toBe('APPLIED');
    expect(await prisma.incident.count()).toBe(1);
  });

  it('applies an offline cancellation after the original request', async () => {
    const deviceId = randomUUID();
    const create = incidentOp();
    const cancel = {
      operationId: randomUUID(),
      entityType: 'INCIDENT',
      entityId: create.entityId,
      operationType: 'CANCEL',
      payload: { clientId: create.entityId, reason: 'Water receded' },
      createdAt: new Date().toISOString(),
    };
    const res = await api().post('/api/sync').send({ deviceId, operations: [create, cancel] }).expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['APPLIED', 'APPLIED']);
    const row = await prisma.incident.findUniqueOrThrow({ where: { clientId: create.entityId } });
    expect(row.status).toBe('CANCELLED');
  });

  it('attributes synced reports to the signed-in user', async () => {
    const { user, auth } = await createUser('CIVILIAN');
    const op = incidentOp();
    await api().post('/api/sync').set(auth).send({ deviceId: randomUUID(), operations: [op] }).expect(200);
    const row = await prisma.incident.findUniqueOrThrow({ where: { clientId: op.entityId } });
    expect(row.reporterId).toBe(user.id);
  });

  it('rejects oversized or malformed batches', async () => {
    const deviceId = randomUUID();
    await api().post('/api/sync').send({ deviceId, operations: [] }).expect(422);
    await api()
      .post('/api/sync')
      .send({ deviceId, operations: Array.from({ length: 51 }, () => incidentOp()) })
      .expect(422);
    await api().post('/api/sync').send({ deviceId: 'nope', operations: [incidentOp()] }).expect(422);
  });

  it('reports per-device sync status', async () => {
    const deviceId = randomUUID();
    await api().post('/api/sync').send({ deviceId, operations: [incidentOp()] }).expect(200);
    const res = await api().get('/api/sync/status').set('X-Device-Id', deviceId).expect(200);
    expect(res.body.operationsReceived).toBe(1);
    expect(res.body.lastSyncAt).not.toBeNull();
  });
});
