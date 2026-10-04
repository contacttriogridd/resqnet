import type { SyncBatchResponse, SyncOperationResult } from '@resqnet/shared';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../database/db';
import { newQueueOperation } from '../services/incidentService';
import type { LocalIncident } from '../types/local';
import { uuid } from '../utils/id';
import {
  TransportError,
  backoffMs,
  eligibleOperations,
  flushQueue,
  pendingCount,
  resetBackoff,
  type SyncTransport,
  type WireOperation,
} from './engine';

const DEVICE = '1b0c6a1e-8d1f-4a52-9f3b-1c2d3e4f5a6b';

async function queueIncident(createdAt = new Date().toISOString()) {
  const clientId = uuid();
  const local: LocalIncident = {
    clientId,
    payload: {
      clientId,
      type: 'FLOOD',
      severity: 'HIGH',
      peopleCount: 'ONE',
      specialRequirements: [],
      location: { text: 'Near the bus stand', source: 'MANUAL' },
      description: undefined,
      clientCreatedAt: createdAt,
    },
    status: 'PENDING',
    syncStatus: 'PENDING',
    syncError: null,
    serverId: null,
    referenceCode: null,
    createdAt,
    syncedAt: null,
    statusCheckedAt: null,
    assigned: false,
    lastNote: null,
  };
  await db.incidents.add(local);
  const op = { ...newQueueOperation({ entityType: 'INCIDENT', entityId: clientId, operationType: 'CREATE', payload: local.payload }), createdAt };
  await db.syncQueue.add(op);
  return { clientId, op };
}

/** Fake server that applies every operation and records what it received. */
function okTransport(overrides: (op: WireOperation) => Partial<SyncOperationResult> = () => ({})) {
  const received: WireOperation[][] = [];
  const transport: SyncTransport = {
    send: vi.fn(async (batch: { deviceId: string; operations: WireOperation[] }): Promise<SyncBatchResponse> => {
      received.push(batch.operations);
      return {
        serverTime: '2026-10-04T12:00:00.000Z',
        results: batch.operations.map((op) => ({
          operationId: op.operationId,
          entityType: op.entityType,
          entityId: op.entityId,
          status: 'APPLIED',
          serverId: uuid(),
          referenceCode: 'RQ-ABCDEF',
          ...overrides(op),
        })),
      };
    }),
  };
  return { transport, received };
}

describe('sync engine', () => {
  it('delivers a queued request and marks it received (offline → online)', async () => {
    const { clientId } = await queueIncident();
    const { transport } = okTransport();

    const result = await flushQueue(db, transport, DEVICE);

    expect(result).toMatchObject({ attempted: 1, applied: 1, remaining: 0, networkError: false });
    const local = await db.incidents.get(clientId);
    expect(local).toMatchObject({ syncStatus: 'SYNCED', status: 'RECEIVED', referenceCode: 'RQ-ABCDEF' });
    expect(local?.syncedAt).toBe('2026-10-04T12:00:00.000Z');
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('keeps everything queued and backs off when the network is down', async () => {
    const { clientId, op } = await queueIncident();
    const transport: SyncTransport = { send: vi.fn().mockRejectedValue(new TransportError('offline', true)) };

    const before = Date.now();
    const result = await flushQueue(db, transport, DEVICE);

    expect(result).toMatchObject({ networkError: true, deferred: 1, remaining: 1 });
    const stored = await db.syncQueue.get(op.operationId);
    expect(stored).toMatchObject({ syncStatus: 'PENDING', retryCount: 1, lastError: 'Waiting for connection' });
    expect(stored!.nextAttemptAt).toBeGreaterThanOrEqual(before + 10_000);
    expect((await db.incidents.get(clientId))?.syncStatus).toBe('PENDING');

    // Not eligible again until the backoff expires…
    expect(await eligibleOperations(db, Date.now())).toHaveLength(0);
    // …unless connectivity returns, which resets backoff immediately.
    await resetBackoff(db);
    expect(await eligibleOperations(db, Date.now())).toHaveLength(1);
  });

  it('sends the same operationId on every retry so the server can de-duplicate', async () => {
    const { op } = await queueIncident();
    const failing: SyncTransport = { send: vi.fn().mockRejectedValue(new TransportError('offline', true)) };
    await flushQueue(db, failing, DEVICE);
    await resetBackoff(db);

    const { transport, received } = okTransport();
    await flushQueue(db, transport, DEVICE);
    expect(received[0]![0]).toMatchObject({ operationId: op.operationId, retryCount: 1 });
  });

  it('treats a DUPLICATE as delivered (request reached the server earlier)', async () => {
    const { clientId } = await queueIncident();
    const { transport } = okTransport(() => ({ status: 'DUPLICATE' }));
    const result = await flushQueue(db, transport, DEVICE);
    expect(result).toMatchObject({ duplicates: 1, remaining: 0 });
    expect((await db.incidents.get(clientId))?.syncStatus).toBe('SYNCED');
  });

  it('surfaces permanent rejections instead of retrying forever', async () => {
    const { clientId, op } = await queueIncident();
    const { transport } = okTransport(() => ({ status: 'REJECTED', retryable: false, error: 'Invalid data' }));

    const result = await flushQueue(db, transport, DEVICE);

    expect(result.rejected).toBe(1);
    expect(await db.syncQueue.get(op.operationId)).toMatchObject({ syncStatus: 'FAILED', lastError: 'Invalid data' });
    expect(await db.incidents.get(clientId)).toMatchObject({ syncStatus: 'FAILED', syncError: 'Invalid data' });
    expect(await pendingCount(db)).toBe(0);
    expect(await eligibleOperations(db, Date.now())).toHaveLength(0);
  });

  it('retries transient server-side rejections later', async () => {
    const { op } = await queueIncident();
    const { transport } = okTransport(() => ({ status: 'REJECTED', retryable: true, error: 'Temporary' }));
    const result = await flushQueue(db, transport, DEVICE);
    expect(result.deferred).toBe(1);
    expect(await db.syncQueue.get(op.operationId)).toMatchObject({ syncStatus: 'PENDING', retryCount: 1 });
  });

  it('sends oldest first, in batches of at most 25', async () => {
    const base = Date.parse('2026-10-04T08:00:00Z');
    for (let i = 29; i >= 0; i--) await queueIncident(new Date(base + i * 1000).toISOString());
    const { transport, received } = okTransport();

    const result = await flushQueue(db, transport, DEVICE);

    expect(received.map((b) => b.length)).toEqual([25, 5]);
    const times = received.flat().map((o) => o.createdAt);
    expect(times).toEqual([...times].sort());
    expect(result).toMatchObject({ applied: 30, remaining: 0 });
  });

  it('never sends a later op for an entity while an earlier one is waiting', async () => {
    const { clientId, op } = await queueIncident('2026-10-04T08:00:00.000Z');
    await db.syncQueue.update(op.operationId, { nextAttemptAt: Date.now() + 60_000 });
    await db.syncQueue.add({
      ...newQueueOperation({ entityType: 'INCIDENT', entityId: clientId, operationType: 'CANCEL', payload: { clientId } }),
      createdAt: '2026-10-04T08:05:00.000Z',
    });
    expect(await eligibleOperations(db, Date.now())).toHaveLength(0);
  });

  it('recovers operations left in SYNCING by a closed tab', async () => {
    const { op } = await queueIncident();
    await db.syncQueue.update(op.operationId, {
      syncStatus: 'SYNCING',
      lastAttempt: new Date(Date.now() - 5 * 60_000).toISOString(),
    });
    expect(await eligibleOperations(db, Date.now())).toHaveLength(1);
  });

  it('caps exponential backoff at five minutes', () => {
    const noJitter = () => 0;
    expect(backoffMs(0, noJitter)).toBe(5_000);
    expect(backoffMs(1, noJitter)).toBe(10_000);
    expect(backoffMs(3, noJitter)).toBe(40_000);
    expect(backoffMs(20, noJitter)).toBe(300_000);
  });
});
