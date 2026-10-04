import {
  DEFAULT_DISASTER_TYPES,
  DEFAULT_EMERGENCY_CONTACTS,
  DEFAULT_SAFETY_GUIDES,
  type AlertDTO,
  type DisasterTypeDTO,
  type EmergencyContactDTO,
  type IncidentDTO,
  type OfflinePackDTO,
  type SafetyGuideDTO,
  type ShelterDTO,
} from '@resqnet/shared';
import { DEFAULT_REGION } from '../config';
import { META, db, getMeta, setMeta } from '../database/db';
import { api } from '../services/apiClient';
import type { Dataset, DatasetKey } from '../types/local';

/**
 * Offline datasets. Every read-only resource the app shows is stored in
 * IndexedDB together with the time the SERVER produced it, so screens can
 * always say "last synchronised: …" and never pretend cached data is live.
 *
 * Emergency contacts and safety guides also ship INSIDE the app bundle, so
 * they display on first launch with no network request at all.
 */

export interface DatasetMap {
  contacts: EmergencyContactDTO[];
  guides: SafetyGuideDTO[];
  shelters: ShelterDTO[];
  alerts: AlertDTO[];
  disasterTypes: DisasterTypeDTO[];
  tasks: IncidentDTO[];
}

const EPOCH = new Date(0).toISOString();

export const BUNDLED_CONTACTS: EmergencyContactDTO[] = DEFAULT_EMERGENCY_CONTACTS.map((c) => ({
  id: `bundled-${c.key}`,
  name: c.name,
  service: c.service,
  phone: c.phone,
  region: null,
  description: c.description,
  available24x7: true,
  sortOrder: c.sortOrder,
  updatedAt: EPOCH,
}));

export const BUNDLED_GUIDES: SafetyGuideDTO[] = DEFAULT_SAFETY_GUIDES.map((g) => ({
  id: `bundled-${g.slug}`,
  slug: g.slug,
  title: g.title,
  disasterTypeCode: g.disasterTypeCode,
  summary: g.summary,
  sections: g.sections,
  sortOrder: g.sortOrder,
  updatedAt: EPOCH,
}));

export const BUNDLED_DISASTER_TYPES: DisasterTypeDTO[] = DEFAULT_DISASTER_TYPES.map((d) => ({
  id: `bundled-${d.code}`,
  code: d.code,
  name: d.name,
  description: d.description,
}));

/** Fallbacks used when nothing has been downloaded yet. */
export function bundledDataset<K extends DatasetKey>(key: K): Dataset<DatasetMap[K]> {
  const data = {
    contacts: BUNDLED_CONTACTS,
    guides: BUNDLED_GUIDES,
    disasterTypes: BUNDLED_DISASTER_TYPES,
    shelters: [],
    alerts: [],
    tasks: [],
  }[key] as DatasetMap[K];
  return { key, data, syncedAt: null, region: null, source: 'bundled' };
}

export async function getDataset<K extends DatasetKey>(key: K): Promise<Dataset<DatasetMap[K]>> {
  const stored = (await db.datasets.get(key)) as Dataset<DatasetMap[K]> | undefined;
  return stored ?? bundledDataset(key);
}

export async function saveDataset<K extends DatasetKey>(
  key: K,
  data: DatasetMap[K],
  syncedAt: string,
  region: string | null = null,
) {
  await db.datasets.put({ key, data, syncedAt, region, source: 'server' });
}

/** Active alerts only: expired alerts are never shown, even from cache. */
export function activeAlerts(alerts: AlertDTO[], now = Date.now()): AlertDTO[] {
  return alerts.filter((a) => a.isActive && new Date(a.expiresAt).getTime() > now);
}

export async function getRegion(): Promise<string> {
  return (await getMeta<string>(META.region)) ?? DEFAULT_REGION;
}

export async function setRegion(region: string) {
  await setMeta(META.region, region);
}

/**
 * Downloads everything needed offline for a region in one request and stores
 * it atomically. This is what "Download emergency information for X" does.
 */
export async function downloadOfflinePack(region?: string): Promise<OfflinePackDTO> {
  const r = region ?? (await getRegion());
  const pack = await api<OfflinePackDTO>(`/offline-pack?region=${encodeURIComponent(r)}`, { timeoutMs: 30_000 });
  await db.transaction('rw', db.datasets, db.meta, async () => {
    await saveDataset('contacts', pack.contacts, pack.generatedAt, r);
    await saveDataset('guides', pack.guides, pack.generatedAt, r);
    await saveDataset('shelters', pack.shelters, pack.generatedAt, r);
    await saveDataset('alerts', activeAlerts(pack.alerts), pack.generatedAt, r);
    await saveDataset('disasterTypes', pack.disasterTypes, pack.generatedAt, r);
    await setMeta(META.region, r);
    await setMeta(META.lastPackAt, pack.generatedAt);
  });
  return pack;
}

/** Lightweight refresh of just the alerts (they change most often). */
export async function refreshAlerts(): Promise<void> {
  const region = await getRegion();
  const res = await api<{ alerts: AlertDTO[]; serverTime: string }>(
    `/alerts/active?region=${encodeURIComponent(region)}`,
  );
  await saveDataset('alerts', activeAlerts(res.alerts), res.serverTime, region);
}

/** Removes expired alerts from the cache (also done on every read). */
export async function pruneExpiredAlerts(): Promise<number> {
  const ds = await getDataset('alerts');
  if (ds.source !== 'server') return 0;
  const kept = activeAlerts(ds.data);
  if (kept.length !== ds.data.length) await db.datasets.update('alerts', { data: kept });
  return ds.data.length - kept.length;
}
