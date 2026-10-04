import Dexie, { type Table } from 'dexie';
import type {
  Dataset,
  Draft,
  FamilyMember,
  LocalIncident,
  LocalSafetyStatus,
  MetaEntry,
  QueueOperation,
} from '../types/local';
import { uuid } from '../utils/id';

/**
 * On-device database (IndexedDB via Dexie).
 *
 * IndexedDB — not localStorage — holds everything critical: it is
 * transactional, survives reloads and is available inside the service worker.
 * This module must stay free of DOM-only APIs because the service worker
 * imports it for background sync.
 */
export class ResqnetDatabase extends Dexie {
  incidents!: Table<LocalIncident, string>;
  syncQueue!: Table<QueueOperation, string>;
  safetyStatuses!: Table<LocalSafetyStatus, string>;
  datasets!: Table<Dataset, string>;
  family!: Table<FamilyMember, string>;
  drafts!: Table<Draft, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'resqnet') {
    super(name);
    this.version(1).stores({
      incidents: 'clientId, createdAt, syncStatus, serverId, status',
      syncQueue: 'operationId, createdAt, syncStatus, entityId, [entityId+operationType]',
      safetyStatuses: 'clientId, createdAt, syncStatus',
      datasets: 'key',
      family: 'id, name',
      drafts: 'id',
      meta: 'key',
    });
  }
}

export const db = new ResqnetDatabase();

/* ── Small typed key-value helpers on the `meta` table ── */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await db.meta.put({ key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key);
}

export const META = {
  deviceId: 'deviceId',
  region: 'region',
  savedLocation: 'savedLocation',
  user: 'user',
  lastSyncAt: 'lastSyncAt',
  lastPackAt: 'lastPackAt',
  simulateOffline: 'simulateOffline',
  installDismissedAt: 'installDismissedAt',
  myInfo: 'myInfo',
  lastKnownLocation: 'lastKnownLocation',
} as const;

/** Stable random identifier for this installation (not linked to identity). */
export async function getDeviceId(): Promise<string> {
  const existing = await getMeta<string>(META.deviceId);
  if (existing) return existing;
  const id = uuid();
  // `add` fails if another tab won the race; then read the winner.
  try {
    await db.meta.add({ key: META.deviceId, value: id });
    return id;
  } catch {
    return (await getMeta<string>(META.deviceId)) ?? id;
  }
}
