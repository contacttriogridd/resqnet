import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMeta, META } from '../database/db';
import { networkStore, setSimulatedOffline } from '../offline/network';
import { OFFLINE_DEADLINE_MS, ONLINE_DEADLINE_MS, isBetter, useGeolocation, type Position } from './useGeolocation';

type Ok = (p: GeolocationPosition) => void;
type Err = (e: GeolocationPositionError) => void;

/** Controllable fake of navigator.geolocation. */
function installGeo() {
  const geo = {
    quick: null as null | { ok: Ok; err: Err; opts: PositionOptions },
    watch: null as null | { ok: Ok; err: Err; opts: PositionOptions },
    cleared: [] as number[],
    getCurrentPosition: vi.fn((ok: Ok, err: Err, opts: PositionOptions) => {
      geo.quick = { ok, err, opts };
    }),
    watchPosition: vi.fn((ok: Ok, err: Err, opts: PositionOptions) => {
      geo.watch = { ok, err, opts };
      return 7;
    }),
    clearWatch: vi.fn((id: number) => geo.cleared.push(id)),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  return geo;
}

const fix = (latitude: number, longitude: number, accuracy: number, timestamp = Date.now()) =>
  ({ coords: { latitude, longitude, accuracy }, timestamp }) as unknown as GeolocationPosition;

const error = (code: 1 | 2 | 3) =>
  ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' }) as GeolocationPositionError;

describe('useGeolocation (works without internet)', () => {
  let geo: ReturnType<typeof installGeo>;
  beforeEach(() => {
    geo = installGeo();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a quick fix first, then refines with GPS until accurate, and remembers it', async () => {
    const { result } = renderHook(() => useGeolocation());
    let first: Position | null = null;
    act(() => {
      void result.current.locate().then((p) => (first = p));
    });
    expect(geo.quick?.opts).toMatchObject({ enableHighAccuracy: false });
    expect(geo.watch?.opts).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });

    act(() => geo.quick!.ok(fix(11.01, 76.95, 900)));
    await waitFor(() => expect(result.current.status).toBe('improving'));
    expect(first).toMatchObject({ accuracyMeters: 900 });

    act(() => geo.watch!.ok(fix(11.0168, 76.9558, 60)));
    await waitFor(() => expect(result.current.position?.accuracyMeters).toBe(60));
    expect(result.current.status).toBe('improving');

    act(() => geo.watch!.ok(fix(11.01681, 76.95581, 12)));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(geo.cleared).toContain(7); // GPS stopped once accurate enough

    await waitFor(async () =>
      expect(await getMeta<Position>(META.lastKnownLocation)).toMatchObject({ latitude: 11.01681, accuracyMeters: 12 }),
    );
  });

  it('ignores a later fix that is less accurate', async () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => void result.current.locate());
    act(() => geo.watch!.ok(fix(11.0, 76.9, 40)));
    act(() => geo.watch!.ok(fix(12.0, 77.9, 400)));
    await waitFor(() => expect(result.current.position?.accuracyMeters).toBe(40));
  });

  it('waits much longer for a GPS fix when offline (no assisted-GPS)', async () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => void result.current.locate());
    expect(geo.watch?.opts.timeout).toBe(ONLINE_DEADLINE_MS);

    await act(async () => setSimulatedOffline(true));
    expect(networkStore.get().state).toBe('offline');
    act(() => void result.current.locate());
    expect(geo.watch?.opts.timeout).toBe(OFFLINE_DEADLINE_MS);
  });

  it('reports "unavailable" on devices without GPS while offline and offers the last known fix', async () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => void result.current.locate());
    act(() => geo.watch!.ok(fix(11.02, 76.96, 15)));
    await waitFor(() => expect(result.current.lastKnown).toMatchObject({ latitude: 11.02 }));

    let got: Position | null | undefined;
    act(() => {
      void result.current.locate().then((p) => (got = p));
    });
    act(() => geo.watch!.err(error(2)));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(got).toBeNull();
    expect(result.current.lastKnown).toMatchObject({ latitude: 11.02, longitude: 76.96 });
  });

  it('keeps an approximate fix if precise GPS later times out', async () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => void result.current.locate());
    act(() => geo.quick!.ok(fix(11.0, 76.9, 300)));
    act(() => geo.watch!.err(error(3)));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.position?.accuracyMeters).toBe(300);
  });

  it('stops immediately when permission is denied', async () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => void result.current.locate());
    act(() => geo.watch!.err(error(1)));
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(geo.cleared).toContain(7);
  });

  it('stops the GPS watch when the component unmounts', () => {
    const { result, unmount } = renderHook(() => useGeolocation());
    act(() => void result.current.locate());
    unmount();
    expect(geo.cleared).toContain(7);
  });
});

describe('isBetter', () => {
  const p = (accuracyMeters: number, at: number): Position => ({ latitude: 0, longitude: 0, accuracyMeters, at });
  it('prefers more accurate fixes, and much newer fixes of similar accuracy', () => {
    expect(isBetter(p(10, 0), null)).toBe(true);
    expect(isBetter(p(10, 0), p(50, 0))).toBe(true);
    expect(isBetter(p(60, 1_000), p(50, 0))).toBe(false);
    expect(isBetter(p(60, 60_000), p(50, 0))).toBe(true);
    expect(isBetter(p(500, 60_000), p(50, 0))).toBe(false);
  });
});
