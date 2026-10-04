import type { SyncBatchResponse } from '@resqnet/shared';
import { META, db, getDeviceId, getMeta, setMeta } from '../database/db';
import { networkStore, type Connectivity } from '../offline/network';
import { ApiError, api } from '../services/apiClient';
import { createStore } from '../utils/store';
import { TransportError, flushQueue, pendingCount, resetBackoff, type FlushResult, type SyncTransport } from './engine';

/**
 * Decides WHEN to run the sync engine in the page:
 *   • immediately after something is queued,
 *   • when connectivity returns (backoff is reset so nothing waits),
 *   • every 20 s while there is pending work and we're not offline,
 *   • when the service worker relays a Background Sync event,
 *   • when the user taps "Sync now".
 * A Web Lock ensures only one tab (or the service worker) flushes at a time.
 */
export interface SyncState {
  running: boolean;
  lastSyncAt: string | null;
  lastResult: FlushResult | null;
  lastAttemptAt: string | null;
}

export const syncStore = createStore<SyncState>({
  running: false,
  lastSyncAt: null,
  lastResult: null,
  lastAttemptAt: null,
});

export const SYNC_TAG = 'resqnet-sync';
const LOCK_NAME = 'resqnet-sync';

export const apiTransport: SyncTransport = {
  async send(batch) {
    try {
      return await api<SyncBatchResponse>('/sync', {
        method: 'POST',
        body: batch,
        timeoutMs: 20_000,
        anonymousFallback: true,
      });
    } catch (err) {
      if (err instanceof ApiError) throw new TransportError(err.message, err.isNetworkError);
      throw new TransportError('Unknown error', true);
    }
  },
};

type PostSyncHook = (result: FlushResult) => Promise<void> | void;
const postSyncHooks: PostSyncHook[] = [];
/** Lets services react after a successful sync (e.g. refresh report statuses). */
export function onAfterSync(hook: PostSyncHook) {
  postSyncHooks.push(hook);
}

let queued = false;

export async function requestSync(): Promise<FlushResult | null> {
  if (networkStore.get().state === 'offline') return null;
  if (syncStore.get().running) {
    queued = true;
    return null;
  }
  const run = async (): Promise<FlushResult | null> => {
    syncStore.set((s) => ({ ...s, running: true, lastAttemptAt: new Date().toISOString() }));
    try {
      const result = await flushQueue(db, apiTransport, await getDeviceId());
      const succeeded = !result.networkError && result.deferred === 0;
      let lastSyncAt = syncStore.get().lastSyncAt;
      if (succeeded) {
        lastSyncAt = new Date().toISOString();
        await setMeta(META.lastSyncAt, lastSyncAt);
      }
      syncStore.set((s) => ({ ...s, lastResult: result, lastSyncAt }));
      if (succeeded) {
        for (const hook of postSyncHooks) {
          try {
            await hook(result);
          } catch {
            /* post-sync work is best-effort */
          }
        }
      }
      return result;
    } finally {
      syncStore.set((s) => ({ ...s, running: false }));
      if (queued) {
        queued = false;
        void requestSync();
      }
    }
  };

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => (lock ? run() : null));
  }
  return run();
}

/** Asks the browser to wake the service worker for sync later (Chromium only). */
export async function registerBackgroundSync() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
    await sync?.register(SYNC_TAG);
  } catch {
    /* Not supported or not permitted: the foreground triggers still apply. */
  }
}

let started = false;

export async function startSyncManager() {
  if (started) return;
  started = true;
  syncStore.set((s) => ({ ...s, lastSyncAt: null }));
  const last = await getMeta<string>(META.lastSyncAt);
  if (last) syncStore.set((s) => ({ ...s, lastSyncAt: last }));

  let previous: Connectivity = networkStore.get().state;
  networkStore.subscribe(() => {
    const current = networkStore.get().state;
    if (previous === 'offline' && current !== 'offline') {
      // Connection restored: send everything now rather than waiting out backoff.
      void resetBackoff(db).then(() => requestSync());
    }
    previous = current;
  });

  setInterval(async () => {
    if (networkStore.get().state === 'offline') return;
    if ((await pendingCount(db)) > 0) void requestSync();
  }, 20_000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_REQUESTED') void requestSync();
    });
  }

  void requestSync();
}
