import {
  incidentCreateSchema,
  type IncidentCreate,
  type IncidentCreateInput,
  type IncidentStatus,
  type ReporterIncidentStatusDTO,
} from '@resqnet/shared';
import { db, getDeviceId } from '../database/db';
import { registerBackgroundSync, requestSync } from '../sync/syncManager';
import type { LocalIncident, QueueOperation } from '../types/local';
import { uuid } from '../utils/id';
import { api } from './apiClient';

/**
 * Emergency requests are ALWAYS written to the device first, then sent.
 * There is one code path whether online or offline: save locally + queue,
 * then let the sync engine deliver it (immediately if a connection exists).
 * A request can never be lost because the network failed mid-submit.
 */

export type NewIncident = Omit<IncidentCreateInput, 'clientId' | 'deviceId' | 'clientCreatedAt'>;

const FINAL: IncidentStatus[] = ['RESOLVED', 'CANCELLED'];

export function newQueueOperation(
  partial: Pick<QueueOperation, 'entityType' | 'entityId' | 'operationType' | 'payload'>,
): QueueOperation {
  return {
    operationId: uuid(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
    syncStatus: 'PENDING',
    lastAttempt: null,
    nextAttemptAt: 0,
    lastError: null,
    ...partial,
  };
}

export async function submitIncident(input: NewIncident): Promise<LocalIncident> {
  const payload: IncidentCreate = incidentCreateSchema.parse({
    ...input,
    clientId: uuid(),
    deviceId: await getDeviceId(),
    clientCreatedAt: new Date().toISOString(),
  });

  const local: LocalIncident = {
    clientId: payload.clientId,
    payload,
    status: 'PENDING',
    syncStatus: 'PENDING',
    syncError: null,
    serverId: null,
    referenceCode: null,
    createdAt: payload.clientCreatedAt,
    syncedAt: null,
    statusCheckedAt: null,
    assigned: false,
    lastNote: null,
  };

  await db.transaction('rw', db.incidents, db.syncQueue, db.drafts, async () => {
    await db.incidents.add(local);
    await db.syncQueue.add(
      newQueueOperation({ entityType: 'INCIDENT', entityId: payload.clientId, operationType: 'CREATE', payload }),
    );
    await db.drafts.delete('incident');
  });

  void registerBackgroundSync();
  void requestSync();
  return local;
}

/** Withdraw a request ("we are safe now"). Works offline too. */
export async function cancelIncident(clientId: string, reason?: string): Promise<void> {
  await db.transaction('rw', db.incidents, db.syncQueue, async () => {
    const local = await db.incidents.get(clientId);
    if (!local || FINAL.includes(local.status)) return;

    const create = await db.syncQueue.where({ entityId: clientId, operationType: 'CREATE' }).first();
    if (!local.serverId && create && create.syncStatus !== 'SYNCING') {
      // Never reached the server: simply don't send it.
      await db.syncQueue.delete(create.operationId);
      await db.incidents.update(clientId, { status: 'CANCELLED', syncStatus: 'SYNCED', syncError: null });
      return;
    }
    const existingCancel = await db.syncQueue.where({ entityId: clientId, operationType: 'CANCEL' }).first();
    if (!existingCancel) {
      await db.syncQueue.add(
        newQueueOperation({
          entityType: 'INCIDENT',
          entityId: clientId,
          operationType: 'CANCEL',
          payload: { clientId, reason },
        }),
      );
    }
    await db.incidents.update(clientId, { status: 'CANCELLED' });
  });
  void requestSync();
}

/** Re-queue a request that the server rejected (after the user fixes nothing — e.g. transient validation). */
export async function retryIncident(clientId: string): Promise<void> {
  await db.transaction('rw', db.incidents, db.syncQueue, async () => {
    const op = await db.syncQueue.where({ entityId: clientId, operationType: 'CREATE' }).first();
    if (op) await db.syncQueue.update(op.operationId, { syncStatus: 'PENDING', nextAttemptAt: 0, lastError: null });
    await db.incidents.update(clientId, { syncStatus: 'PENDING', syncError: null });
  });
  void requestSync();
}

/** Pulls the latest server status for this device's delivered, still-open reports. */
export async function refreshMyReportStatuses(): Promise<void> {
  const open = await db.incidents
    .filter((i) => i.syncStatus === 'SYNCED' && !!i.serverId && !FINAL.includes(i.status))
    .toArray();
  if (open.length === 0) return;
  const ids = open.map((i) => i.clientId).join(',');
  const res = await api<{ incidents: ReporterIncidentStatusDTO[] }>(`/incidents/mine?clientIds=${ids}`);
  const checkedAt = new Date().toISOString();
  await db.transaction('rw', db.incidents, async () => {
    for (const s of res.incidents) {
      await db.incidents.update(s.clientId, {
        status: s.status,
        assigned: s.assigned,
        lastNote: s.lastNote,
        referenceCode: s.referenceCode,
        statusCheckedAt: checkedAt,
      });
    }
  });
}

export async function getDraft<T>(): Promise<T | undefined> {
  return (await db.drafts.get('incident'))?.values as T | undefined;
}

export async function saveDraft(values: unknown) {
  await db.drafts.put({ id: 'incident', values, updatedAt: new Date().toISOString() });
}
