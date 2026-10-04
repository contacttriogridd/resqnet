import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { META, getMeta, setMeta } from '../database/db';
import { networkStore } from '../offline/network';

export interface Position {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  /** Epoch ms of the fix. */
  at: number;
}

export type GeoStatus =
  | 'idle'
  | 'locating' // no fix yet
  | 'improving' // have a fix, still refining accuracy
  | 'success'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

/** Stop refining once the fix is this good. */
export const GOOD_ACCURACY_M = 25;
/**
 * Without internet the phone cannot download satellite assistance data
 * (A-GPS), so a first GPS fix can take 1–2 minutes. Give it time offline.
 */
export const OFFLINE_DEADLINE_MS = 120_000;
export const ONLINE_DEADLINE_MS = 45_000;

const toPosition = (p: GeolocationPosition): Position => ({
  latitude: Number(p.coords.latitude.toFixed(6)),
  longitude: Number(p.coords.longitude.toFixed(6)),
  accuracyMeters: Math.max(1, Math.round(p.coords.accuracy)),
  at: p.timestamp || Date.now(),
});

/** Prefer the more accurate fix; a much newer fix wins if accuracy is similar. */
export function isBetter(next: Position, current: Position | null): boolean {
  if (!current) return true;
  if (next.accuracyMeters < current.accuracyMeters) return true;
  return next.at - current.at > 30_000 && next.accuracyMeters <= current.accuracyMeters * 1.5;
}

export async function getLastKnownLocation(): Promise<Position | undefined> {
  return getMeta<Position>(META.lastKnownLocation);
}

/**
 * Device location that works WITHOUT internet.
 *
 * GPS uses satellites, not mobile data, so phones can locate themselves
 * offline. The hook:
 *  1. asks for a quick, possibly cached, low-power fix (often instant);
 *  2. keeps a high-accuracy GPS watch running and refines the position until
 *     it is within 25 m or a deadline passes (2 min offline, 45 s online);
 *  3. saves every fix on the device as the "last known location", offered
 *     as a fallback when no new fix can be obtained.
 * Location is only requested when the user (or an emergency screen) asks.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [position, setPosition] = useState<Position | null>(null);
  const best = useRef<Position | null>(null);
  const watchId = useRef<number | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const lastKnown = useLiveQuery(() => getLastKnownLocation(), []);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    if (deadline.current) clearTimeout(deadline.current);
    watchId.current = null;
    deadline.current = null;
    active.current = false;
  }, []);

  useEffect(() => stop, [stop]);

  const locate = useCallback((): Promise<Position | null> => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return Promise.resolve(null);
    }
    stop();
    active.current = true;
    best.current = null;
    setPosition(null);
    setStatus('locating');

    const offline = networkStore.get().state === 'offline';
    const limitMs = offline ? OFFLINE_DEADLINE_MS : ONLINE_DEADLINE_MS;

    return new Promise<Position | null>((resolve) => {
      let settled = false;
      const settle = (v: Position | null) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };

      const accept = (p: GeolocationPosition) => {
        if (!active.current) return;
        const pos = toPosition(p);
        if (!isBetter(pos, best.current)) return;
        best.current = pos;
        setPosition(pos);
        void setMeta(META.lastKnownLocation, pos);
        settle(pos);
        if (pos.accuracyMeters <= GOOD_ACCURACY_M) {
          stop();
          setStatus('success');
        } else {
          setStatus('improving');
        }
      };

      const fail = (err: GeolocationPositionError) => {
        if (!active.current) return;
        if (err.code === err.PERMISSION_DENIED) {
          stop();
          setStatus('denied');
          settle(null);
          return;
        }
        // A fix we already have is still useful: keep it.
        if (best.current) {
          stop();
          setStatus('success');
          return;
        }
        if (err.code === err.TIMEOUT) {
          stop();
          setStatus('timeout');
          settle(null);
          return;
        }
        // POSITION_UNAVAILABLE: e.g. a laptop without GPS while offline.
        stop();
        setStatus('unavailable');
        settle(null);
      };

      // 1) Fast path: any recent fix the device already has (≤ 10 min old).
      navigator.geolocation.getCurrentPosition(accept, () => undefined, {
        enableHighAccuracy: false,
        maximumAge: 10 * 60_000,
        timeout: 4_000,
      });

      // 2) Precise path: satellite GPS, refined until good enough.
      watchId.current = navigator.geolocation.watchPosition(accept, fail, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: limitMs,
      });

      // 3) Hard deadline so the GPS radio doesn't run forever.
      deadline.current = setTimeout(() => {
        if (!active.current) return;
        stop();
        if (best.current) {
          setStatus('success');
        } else {
          setStatus('timeout');
          settle(null);
        }
      }, limitMs);
    });
  }, [stop]);

  const clear = useCallback(() => {
    stop();
    best.current = null;
    setPosition(null);
    setStatus('idle');
  }, [stop]);

  return { status, position, locate, clear, stop, lastKnown };
}

/** Messages that work on every screen. */
export const GEO_MESSAGES: Record<Exclude<GeoStatus, 'idle' | 'success' | 'locating' | 'improving'>, string> = {
  denied: 'Location permission was denied. Enter your location manually.',
  unavailable:
    'Location unavailable. Without internet only devices with GPS (most phones) can find their position. Enter your location manually.',
  timeout: 'No GPS signal yet. Move outdoors or near a window and try again, or enter your location manually.',
  unsupported: 'This device cannot share its location. Enter your location manually.',
};

/** Richer, connectivity-aware guidance for the emergency location field. */
export function geoGuidance(status: GeoStatus, offline: boolean, accuracy?: number): string | null {
  switch (status) {
    case 'locating':
      return offline
        ? 'No internet — searching for GPS satellites instead. This can take 1–2 minutes the first time. Go outside or stand near a window.'
        : 'Finding your location…';
    case 'improving':
      return `Improving accuracy${accuracy ? ` (currently ±${accuracy} m)` : ''}… You can send now — the best position so far is used.`;
    case 'unavailable':
      return offline
        ? "This device can't find its location without internet — it probably has no GPS (common on laptops and some tablets). Use your last known location or describe where you are."
        : GEO_MESSAGES.unavailable;
    case 'timeout':
      return offline
        ? 'No GPS signal yet. GPS needs a view of the sky: go outside or near a window and press "Try again". Meanwhile, describe where you are.'
        : GEO_MESSAGES.timeout;
    case 'denied':
    case 'unsupported':
      return GEO_MESSAGES[status];
    default:
      return null;
  }
}
