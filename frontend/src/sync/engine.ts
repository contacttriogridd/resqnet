import type { SyncBatchResponse, SyncOperationResult } from '@resqnet/shared';
import type { ResqnetDatabase } from '../database/db';
import type { QueueOperation } from '../types/local';

/**
 * Sync engine core — environment-agnostic (runs in the page AND in the
 * service worker), so it must not touch window/document/localStorage.
 *
 *   user action → local DB → sync queue → [network?] → /api/sync → update local DB
 *                                      ↳ no network: stay queued, retry with backoff
 *
 * Guarantees:
 *  • Operations are sent oldest-first, in batches.
 *  • Every operation carries a stable operationId and every entity a stable
 *    clientId, so the server de-duplicates replays (see backend syncService).
 *  • Transient failures back off exponentially; permanent rejections are
 *    surfaced to the user instead of being retried forever.
 */

export class TransportError extends Error {
  constructor(
    message: string,
    /** true when the server was never reached (offline, DNS, timeout). */
    readonly network: boolean,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface SyncTransport {
  send(batch: { deviceId: string; operations: WireOperation[] }): Promise<SyncBatchResponse>;
}

export interface WireOperation {
  operationId: string;
  entityType: QueueOperation['entityType'];
  entityId: string;
  operationType: QueueOperation['operationType'];
  payload: unknown;
  createdAt: string;
  retryCount: number;
}

export interface FlushResult {
  attempted: number;
  applied: number;
  duplicates: number;
  rejected: number;
  deferred: number;
  networkError: boolean;
  remaining: number;
}

export const BATCH_SIZE = 25;
const MAX_BATCHES_PER_FLUSH = 8;
/** An op stuck in SYNCING longer than this (tab closed mid-request) is retried. */
const STALE_SYNCING_MS = 2 * 60_000;

/** 5 s, 10 s, 20 s … capped at 5 min, with up to 1 s jitter. */
export function backoffMs(retryCount: number, random = Math.random): number {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, retryCount)) + Math.floor(random() * 1000);
}

export function toWire(op: QueueOperation): WireOperation {
  return {
    operationId: op.operationId,
    entityType: op.entityType,
    entityId: op.entityId,
    operationType: op.operationType,
    payload: op.payload,
    createdAt: op.createdAt,
    retryCount: op.retryCount,
  };
}

/** Ops that may be sent now, oldest first. */
export async function eligibleOperations(db: ResqnetDatabase, now: number): Promise<QueueOperation[]> {
  const all = await db.syncQueue.orderBy('createdAt').toArray();
  const out: QueueOperation[] = [];
  const blockedEntities = new Set<string>();
  for (const op of all) {
    const staleSyncing =
      op.syncStatus === 'SYNCING' && op.lastAttempt && now - new Date(op.lastAttempt).getTime() > STALE_SYNCING_MS;
    const ready = (op.syncStatus === 'PENDING' && op.nextAttemptAt <= now) || staleSyncing;
    // Preserve per-entity ordering: never send a later op (e.g. CANCEL) while an
    // earlier op for the same entity is still waiting.
    if (!ready || blockedEntities.has(op.entityId)) {
      if (op.syncStatus !== 'FAILED') blockedEntities.add(op.entityId);
      continue;
    }
    out.push(op);
  }
  return out;
}

export async function pendingCount(db: ResqnetDatabase): Promise<number> {
  return db.syncQueue.where('syncStatus').anyOf('PENDING', 'SYNCING').count();
}

/** Makes every waiting op eligible immediately (e.g. when connectivity returns). */
export async function resetBackoff(db: ResqnetDatabase): Promise<void> {
  await db.syncQueue.where('syncStatus').equals('PENDING').modify({ nextAttemptAt: 0 });
}

export async function flushQueue(
  db: ResqnetDatabase,
  transport: SyncTransport,
  deviceId: string,
  now: () => number = Date.now,
): Promise<FlushResult> {
  const result: FlushResult = {
    attempted: 0,
    applied: 0,
    duplicates: 0,
    rejected: 0,
    deferred: 0,
    networkError: false,
    remaining: 0,
  };

  for (let batchNo = 0; batchNo < MAX_BATCHES_PER_FLUSH; batchNo++) {
    const batch = (await eligibleOperations(db, now())).slice(0, BATCH_SIZE);
    if (batch.length === 0) break;

    const attemptAt = new Date(now()).toISOString();
    await db.transaction('rw', db.syncQueue, db.incidents, db.safetyStatuses, async () => {
      for (const op of batch) {
        await db.syncQueue.update(op.operationId, { syncStatus: 'SYNCING', lastAttempt: attemptAt });
        await setEntitySyncing(db, op);
      }
    });
    result.attempted += batch.length;

    let response: SyncBatchResponse;
    try {
      response = await transport.send({ deviceId, operations: batch.map(toWire) });
    } catch (err) {
      const network = err instanceof TransportError ? err.network : true;
      await deferAll(db, batch, now(), network ? 'Waiting for connection' : 'Server temporarily unavailable');
      result.deferred += batch.length;
      result.networkError = network;
      break;
    }

    const byId = new Map(response.results.map((r) => [r.operationId, r]));
    await db.transaction('rw', db.syncQueue, db.incidents, db.safetyStatuses, async () => {
      for (const op of batch) {
        const r = byId.get(op.operationId);
        if (!r || (r.status === 'REJECTED' && r.retryable)) {
          await defer(db, op, now(), r?.error ?? 'Server did not confirm — will retry');
          result.deferred++;
        } else if (r.status === 'REJECTED') {
          await markRejected(db, op, r);
          result.rejected++;
        } else {
          await markSynced(db, op, r, response.serverTime);
          if (r.status === 'APPLIED') result.applied++;
          else result.duplicates++;
        }
      }
    });
  }

  result.remaining = await pendingCount(db);
  return result;
}

async function deferAll(db: ResqnetDatabase, ops: QueueOperation[], now: number, reason: string) {
  await db.transaction('rw', db.syncQueue, db.incidents, db.safetyStatuses, async () => {
    for (const op of ops) await defer(db, op, now, reason);
  });
}

async function defer(db: ResqnetDatabase, op: QueueOperation, now: number, reason: string) {
  const retryCount = op.retryCount + 1;
  await db.syncQueue.update(op.operationId, {
    syncStatus: 'PENDING',
    retryCount,
    nextAttemptAt: now + backoffMs(retryCount),
    lastError: reason,
  });
  if (op.entityType === 'INCIDENT' && op.operationType === 'CREATE') {
    await db.incidents.update(op.entityId, { syncStatus: 'PENDING' });
  }
  if (op.entityType === 'SAFETY_STATUS') {
    await db.safetyStatuses.update(op.entityId, { syncStatus: 'PENDING' });
  }
}

async function setEntitySyncing(db: ResqnetDatabase, op: QueueOperation) {
  if (op.entityType === 'INCIDENT' && op.operationType === 'CREATE') {
    await db.incidents.update(op.entityId, { syncStatus: 'SYNCING' });
  }
  if (op.entityType === 'SAFETY_STATUS') {
    await db.safetyStatuses.update(op.entityId, { syncStatus: 'SYNCING' });
  }
}

async function markSynced(db: ResqnetDatabase, op: QueueOperation, r: SyncOperationResult, serverTime: string) {
  await db.syncQueue.delete(op.operationId);
  if (op.entityType === 'INCIDENT') {
    const local = await db.incidents.get(op.entityId);
    if (!local) return;
    if (op.operationType === 'CREATE') {
      await db.incidents.update(op.entityId, {
        serverId: r.serverId ?? local.serverId,
        referenceCode: r.referenceCode ?? local.referenceCode,
        status: local.status === 'PENDING' ? 'RECEIVED' : local.status,
        syncStatus: 'SYNCED',
        syncError: null,
        syncedAt: serverTime,
      });
    } else {
      await db.incidents.update(op.entityId, { status: 'CANCELLED', syncStatus: 'SYNCED', syncedAt: serverTime });
    }
  } else if (op.entityType === 'SAFETY_STATUS') {
    await db.safetyStatuses.update(op.entityId, { syncStatus: 'SYNCED', syncedAt: serverTime });
  }
}

async function markRejected(db: ResqnetDatabase, op: QueueOperation, r: SyncOperationResult) {
  const error = r.error ?? 'The server could not accept this information.';
  await db.syncQueue.update(op.operationId, { syncStatus: 'FAILED', lastError: error });
  if (op.entityType === 'INCIDENT' && op.operationType === 'CREATE') {
    await db.incidents.update(op.entityId, { syncStatus: 'FAILED', syncError: error });
  }
  if (op.entityType === 'SAFETY_STATUS') {
    await db.safetyStatuses.update(op.entityId, { syncStatus: 'FAILED' });
  }
}
