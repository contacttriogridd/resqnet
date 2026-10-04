import { describe, expect, it, vi } from 'vitest';
import { db } from '../database/db';
import { activeAlerts, bundledDataset, getDataset, saveDataset } from '../offline/datasets';
import { networkStore, reportRequestFailure, reportRequestSuccess, setSimulatedOffline } from '../offline/network';
import { cancelIncident, submitIncident } from './incidentService';
import { setSafetyStatus } from './safetyService';

// Keep these unit tests independent of the network: sync attempts are no-ops.
vi.mock('../sync/syncManager', () => ({
  requestSync: vi.fn(async () => null),
  registerBackgroundSync: vi.fn(async () => undefined),
}));

const request = {
  type: 'TRAPPED' as const,
  severity: 'CRITICAL' as const,
  peopleCount: 'TWO_TO_FIVE' as const,
  specialRequirements: ['ELDERLY' as const],
  location: { latitude: 11.01, longitude: 76.95, source: 'GPS' as const },
  description: 'On the roof',
};

describe('offline emergency request (scenario 2)', () => {
  it('stores the request in IndexedDB with a local id and queues it for sync', async () => {
    await setSimulatedOffline(true);
    const local = await submitIncident(request);

    expect(local.clientId).toMatch(/^[0-9a-f-]{36}$/);
    const stored = await db.incidents.get(local.clientId);
    expect(stored).toMatchObject({ status: 'PENDING', syncStatus: 'PENDING', serverId: null });
    expect(stored?.payload.deviceId).toMatch(/^[0-9a-f-]{36}$/);

    const ops = await db.syncQueue.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ entityType: 'INCIDENT', operationType: 'CREATE', entityId: local.clientId, retryCount: 0 });
  });

  it('validates locally before saving', async () => {
    await expect(submitIncident({ ...request, location: { source: 'MANUAL', text: '' } })).rejects.toThrow();
    expect(await db.incidents.count()).toBe(0);
  });

  it('clears the saved draft once a request is submitted', async () => {
    await db.drafts.put({ id: 'incident', values: { type: 'FIRE' }, updatedAt: new Date().toISOString() });
    await submitIncident(request);
    expect(await db.drafts.get('incident')).toBeUndefined();
  });

  it('cancelling an unsent request removes it from the queue instead of sending it', async () => {
    const local = await submitIncident(request);
    await cancelIncident(local.clientId, 'Safe now');
    expect(await db.syncQueue.count()).toBe(0);
    expect((await db.incidents.get(local.clientId))?.status).toBe('CANCELLED');
  });

  it('cancelling a delivered request queues a CANCEL operation', async () => {
    const local = await submitIncident(request);
    await db.syncQueue.clear();
    await db.incidents.update(local.clientId, { serverId: 'srv-1', syncStatus: 'SYNCED', status: 'RECEIVED' });
    await cancelIncident(local.clientId);
    const ops = await db.syncQueue.toArray();
    expect(ops.map((o) => o.operationType)).toEqual(['CANCEL']);
  });

  it('saves safety status locally first', async () => {
    const s = await setSafetyStatus('SAFE', 'At the shelter');
    expect(await db.safetyStatuses.get(s.clientId)).toMatchObject({ status: 'SAFE', syncStatus: 'PENDING' });
    expect(await db.syncQueue.filter((o) => o.entityType === 'SAFETY_STATUS').count()).toBe(1);
  });
});

describe('offline datasets (scenarios 4–6)', () => {
  it('serves emergency contacts and guides from the app bundle with no download', async () => {
    const contacts = await getDataset('contacts');
    expect(contacts.source).toBe('bundled');
    expect(contacts.data.map((c) => c.phone)).toEqual(expect.arrayContaining(['112', '108', '101', '100']));
    const guides = await getDataset('guides');
    expect(guides.data.map((g) => g.slug)).toEqual(expect.arrayContaining(['flood', 'earthquake', 'cyclone', 'tsunami', 'fire', 'landslide']));
  });

  it('keeps downloaded shelters with their server timestamp', async () => {
    await saveDataset('shelters', [], '2026-10-04T08:20:00.000Z', 'Coimbatore');
    const ds = await getDataset('shelters');
    expect(ds).toMatchObject({ source: 'server', syncedAt: '2026-10-04T08:20:00.000Z', region: 'Coimbatore' });
  });

  it('never shows expired or deactivated alerts from cache', () => {
    const base = {
      title: 't', disasterTypeCode: 'FLOOD', disasterTypeName: 'Flood', severity: 'WARNING' as const, region: 'X',
      message: 'm', instruction: 'i', startsAt: '', isDemo: false, createdAt: '', updatedAt: '',
    };
    const now = Date.parse('2026-10-04T12:00:00Z');
    const alerts = [
      { ...base, id: 'live', isActive: true, expiresAt: '2026-10-04T13:00:00Z' },
      { ...base, id: 'expired', isActive: true, expiresAt: '2026-10-04T11:59:00Z' },
      { ...base, id: 'off', isActive: false, expiresAt: '2026-10-04T13:00:00Z' },
    ];
    expect(activeAlerts(alerts, now).map((a) => a.id)).toEqual(['live']);
  });

  it('has empty fallbacks for data that must be downloaded', () => {
    expect(bundledDataset('shelters')).toMatchObject({ data: [], source: 'bundled', syncedAt: null });
  });
});

describe('network monitor', () => {
  it('moves online → limited → offline on repeated failures and back on success', () => {
    expect(networkStore.get().state).toBe('online');
    reportRequestFailure();
    expect(networkStore.get()).toMatchObject({ state: 'limited', reason: 'server-unreachable' });
    reportRequestFailure();
    expect(networkStore.get()).toMatchObject({ state: 'offline', reason: 'server-unreachable' });
    reportRequestSuccess(120);
    expect(networkStore.get()).toMatchObject({ state: 'online', reason: null, latencyMs: 120 });
  });

  it('reports a slow but working connection as limited', () => {
    reportRequestSuccess(4000);
    expect(networkStore.get()).toMatchObject({ state: 'limited', reason: 'slow' });
  });

  it('demo "simulate offline" overrides real connectivity until turned off', async () => {
    await setSimulatedOffline(true);
    expect(networkStore.get()).toMatchObject({ state: 'offline', simulated: true });
    reportRequestSuccess(50);
    expect(networkStore.get().state).toBe('offline');
  });
});
