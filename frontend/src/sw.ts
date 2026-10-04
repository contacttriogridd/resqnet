/// <reference lib="webworker" />
/**
 * RESQNET service worker.
 *
 *  • Precaches the whole application shell so the app opens with no network.
 *  • SPA navigations fall back to the cached index.html (offline.html if even
 *    that is missing).
 *  • Public read-only API responses: network-first with a short timeout, so
 *    fresh when possible and cached when not. Emergency data itself lives in
 *    IndexedDB; this cache is a second safety net.
 *  • Map tiles that were viewed online are kept for offline viewing.
 *  • Background Sync: when the browser restores connectivity it wakes this
 *    worker, which either asks an open tab to sync or flushes the queue itself.
 */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { API_BASE_URL } from './config';
import { db, getDeviceId } from './database/db';
import { TransportError, flushQueue, type SyncTransport } from './sync/engine';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

const SYNC_TAG = 'resqnet-sync';

// cleanURLs is off: otherwise a navigation to /offline would be answered with
// the static offline.html fallback instead of the app's Offline Data Center.
precacheAndRoute(self.__WB_MANIFEST, { cleanURLs: false });
cleanupOutdatedCaches();
clientsClaim();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
);

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    /^\/api\/(alerts|shelters|emergency-contacts|safety-guides|disaster-types)(\/|\?|$)/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'resqnet-api',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 86_400 })],
  }),
);

registerRoute(
  ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
  new CacheFirst({
    cacheName: 'resqnet-map-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 14 * 86_400, purgeOnQuotaError: true })],
  }),
);

setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    return (await matchPrecache('offline.html')) ?? Response.error();
  }
  return Response.error();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

/* ── Background Sync ── */

const swTransport: SyncTransport = {
  async send(batch) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': batch.deviceId,
          'X-Requested-With': 'resqnet',
        },
        body: JSON.stringify(batch),
      });
    } catch {
      throw new TransportError('Network unavailable', true);
    }
    if (!res.ok) throw new TransportError(`Server responded ${res.status}`, false);
    return res.json();
  },
};

async function handleSync() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windows.length > 0) {
    // An open tab has the user's session — let it do the sync.
    windows.forEach((c) => c.postMessage({ type: 'SYNC_REQUESTED' }));
    return;
  }
  // No tab open: deliver queued emergency data anonymously (the server
  // accepts reports without an account and links them to this device).
  const run = async () => {
    const result = await flushQueue(db, swTransport, await getDeviceId());
    if (result.networkError || result.remaining > 0) {
      // Throwing tells the browser to retry this sync later.
      throw new Error('Sync incomplete; will retry');
    }
  };
  if (self.navigator.locks) {
    await self.navigator.locks.request('resqnet-sync', { ifAvailable: true }, async (lock) => (lock ? run() : undefined));
  } else {
    await run();
  }
}

self.addEventListener('sync', (event) => {
  const e = event as SyncEvent;
  if (e.tag === SYNC_TAG) e.waitUntil(handleSync());
});
