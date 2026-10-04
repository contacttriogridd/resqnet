import { safetyStatusCreateSchema, type SafetyState } from '@resqnet/shared';
import { db, getDeviceId } from '../database/db';
import { registerBackgroundSync, requestSync } from '../sync/syncManager';
import type { LocalSafetyStatus } from '../types/local';
import { uuid } from '../utils/id';
import { newQueueOperation } from './incidentService';

/** Saves "I am safe / need help" locally at once, then syncs when possible. */
export async function setSafetyStatus(
  status: SafetyState,
  note?: string,
  location?: { latitude: number; longitude: number },
): Promise<LocalSafetyStatus> {
  const createdAt = new Date().toISOString();
  const payload = safetyStatusCreateSchema.parse({
    clientId: uuid(),
    deviceId: await getDeviceId(),
    status,
    note,
    latitude: location?.latitude,
    longitude: location?.longitude,
    clientCreatedAt: createdAt,
  });
  const local: LocalSafetyStatus = {
    clientId: payload.clientId,
    status,
    note: payload.note ?? null,
    createdAt,
    syncStatus: 'PENDING',
    syncedAt: null,
  };
  await db.transaction('rw', db.safetyStatuses, db.syncQueue, async () => {
    await db.safetyStatuses.add(local);
    await db.syncQueue.add(
      newQueueOperation({ entityType: 'SAFETY_STATUS', entityId: payload.clientId, operationType: 'CREATE', payload }),
    );
  });
  void registerBackgroundSync();
  void requestSync();
  return local;
}

export async function latestSafetyStatus(): Promise<LocalSafetyStatus | undefined> {
  return db.safetyStatuses.orderBy('createdAt').last();
}
