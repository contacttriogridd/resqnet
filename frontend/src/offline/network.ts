import { API_BASE_URL } from '../config';
import { META, getMeta, setMeta } from '../database/db';
import { createStore } from '../utils/store';

/**
 * Connectivity detection.
 *
 * `navigator.onLine === true` only means "some network interface is up" —
 * not that the RESQNET backend is reachable. So we combine:
 *   1. browser online/offline events (fast negative signal),
 *   2. periodic health checks against /api/health (real reachability + latency),
 *   3. passive signals from every API request (success/failure),
 *   4. a demo-only "simulate offline" switch.
 *
 *   ONLINE   — backend reachable and responsive
 *   LIMITED  — reachable but slow/degraded, or a single failed check
 *   OFFLINE  — browser offline, or backend unreachable repeatedly
 */
export type Connectivity = 'online' | 'limited' | 'offline';

export type ConnectivityReason =
  | 'browser-offline'
  | 'server-unreachable'
  | 'slow'
  | 'server-degraded'
  | 'simulated'
  | null;

export interface NetworkSnapshot {
  state: Connectivity;
  reason: ConnectivityReason;
  simulated: boolean;
  latencyMs: number | null;
  lastCheckedAt: number | null;
  lastOnlineAt: number | null;
  /** True until the first check completes, so the UI can avoid flashing "offline". */
  checking: boolean;
}

const SLOW_MS = 2500;
const CHECK_TIMEOUT_MS = 6000;
const POLL_ONLINE_MS = 30_000;
const POLL_DEGRADED_MS = 8_000;

const browserOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export const networkStore = createStore<NetworkSnapshot>({
  state: browserOnline() ? 'online' : 'offline',
  reason: browserOnline() ? null : 'browser-offline',
  simulated: false,
  latencyMs: null,
  lastCheckedAt: null,
  lastOnlineAt: null,
  checking: true,
});

let consecutiveFailures = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let inflight: Promise<void> | null = null;

function update(partial: Partial<NetworkSnapshot>) {
  networkStore.set((prev) => {
    const next = { ...prev, ...partial };
    if (next.state === 'online') next.lastOnlineAt = Date.now();
    const changed = (Object.keys(partial) as (keyof NetworkSnapshot)[]).some((k) => prev[k] !== next[k]);
    return changed || next.state === 'online' ? next : prev;
  });
}

export function isOffline(): boolean {
  return networkStore.get().state === 'offline';
}

export function isSimulatedOffline(): boolean {
  return networkStore.get().simulated;
}

/** Called by the API client after every successful request. */
export function reportRequestSuccess(latencyMs: number) {
  if (networkStore.get().simulated) return;
  consecutiveFailures = 0;
  update({
    state: latencyMs > SLOW_MS ? 'limited' : 'online',
    reason: latencyMs > SLOW_MS ? 'slow' : null,
    latencyMs,
    lastCheckedAt: Date.now(),
    checking: false,
  });
  schedule();
}

/** Called by the API client when a request could not reach the server at all. */
export function reportRequestFailure() {
  if (networkStore.get().simulated) return;
  consecutiveFailures++;
  applyFailure();
  schedule();
}

function applyFailure() {
  if (!browserOnline()) {
    update({ state: 'offline', reason: 'browser-offline', lastCheckedAt: Date.now(), checking: false });
  } else {
    update({
      state: consecutiveFailures >= 2 ? 'offline' : 'limited',
      reason: 'server-unreachable',
      lastCheckedAt: Date.now(),
      checking: false,
    });
  }
}

/** Performs a health check now. Concurrent calls share one request. */
export function checkNow(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (networkStore.get().simulated) {
      update({ state: 'offline', reason: 'simulated', checking: false });
      return;
    }
    if (!browserOnline()) {
      consecutiveFailures++;
      applyFailure();
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const started = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      const latency = Math.round(performance.now() - started);
      consecutiveFailures = 0;
      if (res.status === 503) {
        update({ state: 'limited', reason: 'server-degraded', latencyMs: latency, lastCheckedAt: Date.now(), checking: false });
      } else if (!res.ok) {
        consecutiveFailures++;
        applyFailure();
      } else {
        update({
          state: latency > SLOW_MS ? 'limited' : 'online',
          reason: latency > SLOW_MS ? 'slow' : null,
          latencyMs: latency,
          lastCheckedAt: Date.now(),
          checking: false,
        });
      }
    } catch {
      consecutiveFailures++;
      applyFailure();
    } finally {
      clearTimeout(t);
    }
  })().finally(() => {
    inflight = null;
    schedule();
  });
  return inflight;
}

function schedule() {
  if (!started) return;
  clearTimeout(timer);
  const s = networkStore.get().state;
  timer = setTimeout(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      schedule();
      return;
    }
    void checkNow();
  }, s === 'online' ? POLL_ONLINE_MS : POLL_DEGRADED_MS);
}

/** DEMO ONLY: pretend the device has no connection (persisted across reloads). */
export async function setSimulatedOffline(on: boolean) {
  await setMeta(META.simulateOffline, on);
  consecutiveFailures = 0;
  update({ simulated: on, ...(on ? { state: 'offline' as const, reason: 'simulated' as const } : {}) });
  if (!on) await checkNow();
}

export async function startNetworkMonitor() {
  if (started) return;
  started = true;
  const simulated = (await getMeta<boolean>(META.simulateOffline)) ?? false;
  if (simulated) update({ simulated: true, state: 'offline', reason: 'simulated', checking: false });

  window.addEventListener('online', () => void checkNow());
  window.addEventListener('offline', () => {
    if (!networkStore.get().simulated) update({ state: 'offline', reason: 'browser-offline', checking: false });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkNow();
  });
  await checkNow();
}

/** For tests. */
export function __resetNetworkForTests() {
  started = false;
  consecutiveFailures = 0;
  clearTimeout(timer);
  networkStore.set({
    state: 'online',
    reason: null,
    simulated: false,
    latencyMs: null,
    lastCheckedAt: null,
    lastOnlineAt: null,
    checking: false,
  });
}
