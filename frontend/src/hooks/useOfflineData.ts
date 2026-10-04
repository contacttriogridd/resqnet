import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { META, db, getMeta } from '../database/db';
import { DEFAULT_REGION } from '../config';
import { activeAlerts, bundledDataset, getDataset, type DatasetMap } from '../offline/datasets';
import type { Dataset, DatasetKey, LocalSafetyStatus, SavedLocation } from '../types/local';

/**
 * Reactive access to on-device data. These hooks re-render automatically when
 * IndexedDB changes (e.g. after a background sync), and never hit the network.
 */

export function useDataset<K extends DatasetKey>(key: K): Dataset<DatasetMap[K]> & { loading: boolean } {
  const ds = useLiveQuery(() => getDataset(key), [key]);
  if (!ds) return { ...bundledDataset(key), loading: true };
  return { ...ds, loading: false };
}

/** Active alerts from cache; expired ones are hidden even while offline. */
export function useActiveAlerts() {
  const ds = useDataset('alerts');
  const now = useNow(60_000);
  return { ...ds, data: activeAlerts(ds.data, now) };
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.syncQueue.where('syncStatus').anyOf('PENDING', 'SYNCING').count(), []) ?? 0;
}

export function useFailedCount(): number {
  return useLiveQuery(() => db.syncQueue.where('syncStatus').equals('FAILED').count(), []) ?? 0;
}

export function useMyIncidents() {
  return useLiveQuery(() => db.incidents.orderBy('createdAt').reverse().toArray(), []);
}

export function useLatestSafetyStatus(): LocalSafetyStatus | null | undefined {
  return useLiveQuery(async () => (await db.safetyStatuses.orderBy('createdAt').last()) ?? null, []);
}

export function useMeta<T>(key: string): T | undefined {
  return useLiveQuery(() => getMeta<T>(key), [key]);
}

export function useRegion(): string {
  return useMeta<string>(META.region) ?? DEFAULT_REGION;
}

export function useSavedLocation() {
  return useMeta<SavedLocation>(META.savedLocation);
}

/** Re-renders every `intervalMs` so relative times ("5 minutes ago") stay correct. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
