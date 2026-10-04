import { useCallback, useRef, useState } from 'react';

export interface Position {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  at: number;
}

export type GeoStatus = 'idle' | 'locating' | 'success' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/**
 * Device location, requested ONLY when the user asks (never on page load).
 * Any failure leaves the app fully usable with manual location entry.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [position, setPosition] = useState<Position | null>(null);
  const pending = useRef(false);

  const locate = useCallback((): Promise<Position | null> => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return Promise.resolve(null);
    }
    if (pending.current) return Promise.resolve(null);
    pending.current = true;
    setStatus('locating');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          pending.current = false;
          const pos = {
            latitude: Number(p.coords.latitude.toFixed(6)),
            longitude: Number(p.coords.longitude.toFixed(6)),
            accuracyMeters: Math.round(p.coords.accuracy),
            at: p.timestamp,
          };
          setPosition(pos);
          setStatus('success');
          resolve(pos);
        },
        (err) => {
          pending.current = false;
          setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable');
          resolve(null);
        },
        // GPS works without internet; allow a slightly old fix for speed.
        { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
      );
    });
  }, []);

  const clear = useCallback(() => {
    setPosition(null);
    setStatus('idle');
  }, []);

  return { status, position, locate, clear };
}

export const GEO_MESSAGES: Record<Exclude<GeoStatus, 'idle' | 'success' | 'locating'>, string> = {
  denied: 'Location permission was denied. Enter your location manually.',
  unavailable: 'Location unavailable. Enter your location manually.',
  timeout: 'Finding your location took too long. Enter your location manually, or try again outdoors.',
  unsupported: 'This device cannot share its location. Enter your location manually.',
};
