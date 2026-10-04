import { formatCoordinates, type LocationSource } from '@resqnet/shared';
import { Bookmark, Crosshair, History, Loader2, MapPin, RefreshCw, Satellite, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { geoGuidance, useGeolocation } from '../hooks/useGeolocation';
import { useSavedLocation } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { clockTime, timeAgo } from '../utils/time';
import { Button, FieldError, Label, Notice, TextInput } from './ui';

export interface LocationValue {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  text?: string;
  source: LocationSource;
}

/** Last known fixes older than this are not offered. */
const LAST_KNOWN_MAX_AGE_MS = 24 * 3600_000;

/**
 * Location capture for emergency requests. Works without internet:
 *   1. GPS (satellites, no data needed) — refined live while the form is open;
 *   2. the last GPS fix stored on this device (age shown to responders);
 *   3. the user's saved location;
 *   4. a typed description.
 * Nothing here ever blocks sending a request.
 */
export function LocationField({
  value,
  onChange,
  error,
  autoLocate,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  error?: string;
  autoLocate?: boolean;
}) {
  const geo = useGeolocation();
  const net = useNetwork();
  const saved = useSavedLocation();
  const textId = useId();
  const errId = useId();
  const offline = net.state === 'offline';
  const hasCoords = value.latitude !== undefined && value.longitude !== undefined;

  // While true, improved GPS fixes replace the value in the form.
  const following = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const p = geo.position;
    if (!p || !following.current) return;
    onChange({
      ...latest.current,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracyMeters: p.accuracyMeters,
      source: 'GPS',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position]);

  const startGps = () => {
    following.current = true;
    void geo.locate();
  };

  useEffect(() => {
    if (autoLocate && !hasCoords) startGps();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopFollowing = () => {
    following.current = false;
    geo.stop();
  };

  const useLastKnown = () => {
    const lk = geo.lastKnown;
    if (!lk) return;
    stopFollowing();
    const note = `Last known GPS position from ${clockTime(lk.at)}`;
    onChange({
      latitude: lk.latitude,
      longitude: lk.longitude,
      accuracyMeters: lk.accuracyMeters,
      text: (value.text ? `${value.text} (${note})` : note).slice(0, 200),
      source: 'SAVED',
    });
  };

  const useSaved = () => {
    if (!saved) return;
    stopFollowing();
    onChange({
      latitude: saved.latitude,
      longitude: saved.longitude,
      text: value.text || saved.text || saved.label,
      source: 'SAVED',
    });
  };

  const lastKnownUsable =
    geo.lastKnown && Date.now() - geo.lastKnown.at < LAST_KNOWN_MAX_AGE_MS && !(hasCoords && value.source === 'GPS');
  const searching = geo.status === 'locating';
  const guidance = geoGuidance(geo.status, offline, value.accuracyMeters);
  const failed = ['denied', 'unavailable', 'timeout', 'unsupported'].includes(geo.status);

  return (
    <fieldset className="space-y-3" aria-describedby={error ? errId : undefined}>
      <legend className="mb-1.5 font-semibold">Your location</legend>

      {hasCoords ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-safe-line bg-safe-bg p-3">
          {geo.status === 'improving' && value.source === 'GPS' ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-safe" aria-hidden />
          ) : (
            <MapPin className="size-5 shrink-0 text-safe" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {value.source === 'SAVED' ? 'Using a saved location' : geo.status === 'improving' ? 'Location found — improving…' : 'Location found'}
            </p>
            <p className="tabular text-sm text-muted">
              {formatCoordinates({ latitude: value.latitude!, longitude: value.longitude! }, 5)}
              {value.accuracyMeters !== undefined && ` · accurate to ~${value.accuracyMeters} m`}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface"
            onClick={() => {
              stopFollowing();
              onChange({ text: value.text, source: 'MANUAL' });
            }}
            aria-label="Remove location"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            icon={failed ? RefreshCw : offline ? Satellite : Crosshair}
            loading={searching}
            onClick={startGps}
          >
            {searching ? (offline ? 'Searching for GPS…' : 'Finding location…') : failed ? 'Try again' : 'Use my current location'}
          </Button>
          {lastKnownUsable && geo.lastKnown && (
            <Button type="button" size="lg" icon={History} onClick={useLastKnown}>
              Last known location ({timeAgo(geo.lastKnown.at)})
            </Button>
          )}
          {saved && (saved.latitude !== undefined || saved.text) && (
            <Button type="button" size="lg" icon={Bookmark} onClick={useSaved}>
              Use saved: {saved.label}
            </Button>
          )}
        </div>
      )}

      {guidance && (searching || geo.status === 'improving' || failed) && (
        <Notice tone={failed ? 'warning' : 'info'} icon={offline && !failed ? Satellite : undefined} role="status">
          {guidance}
        </Notice>
      )}

      <div>
        <Label htmlFor={textId} hint="Landmark, street, building, floor — helps rescuers find you.">
          {hasCoords ? 'Describe the place (optional)' : 'Where are you?'}
        </Label>
        <TextInput
          id={textId}
          value={value.text ?? ''}
          maxLength={200}
          placeholder="e.g. 2nd floor, blue house behind Gandhipuram bus stand"
          aria-invalid={!!error}
          onChange={(e) => onChange({ ...value, text: e.target.value, source: hasCoords ? value.source : 'MANUAL' })}
        />
        <FieldError id={errId}>{error}</FieldError>
      </div>
    </fieldset>
  );
}
