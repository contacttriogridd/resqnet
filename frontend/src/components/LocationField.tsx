import { formatCoordinates, type LocationSource } from '@resqnet/shared';
import { Bookmark, Crosshair, MapPin, X } from 'lucide-react';
import { useEffect, useId } from 'react';
import { GEO_MESSAGES, useGeolocation } from '../hooks/useGeolocation';
import { useSavedLocation } from '../hooks/useOfflineData';
import { Button, FieldError, Label, Notice, TextInput } from './ui';

export interface LocationValue {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  text?: string;
  source: LocationSource;
}

/**
 * Location capture in order of preference: GPS (works without internet),
 * the user's saved location, or a typed description. Denied permission or a
 * missing GPS fix never blocks the form.
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
  const saved = useSavedLocation();
  const textId = useId();
  const errId = useId();
  const hasCoords = value.latitude !== undefined && value.longitude !== undefined;

  const useGps = async () => {
    const pos = await geo.locate();
    if (pos) {
      onChange({
        ...value,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracyMeters: pos.accuracyMeters,
        source: 'GPS',
      });
    }
  };

  useEffect(() => {
    if (autoLocate && !hasCoords) void useGps();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useSaved = () => {
    if (!saved) return;
    onChange({
      latitude: saved.latitude,
      longitude: saved.longitude,
      text: value.text || saved.text || saved.label,
      source: 'SAVED',
    });
  };

  return (
    <fieldset className="space-y-3" aria-describedby={error ? errId : undefined}>
      <legend className="mb-1.5 font-semibold">Your location</legend>

      {hasCoords ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-safe-line bg-safe-bg p-3">
          <MapPin className="size-5 shrink-0 text-safe" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {value.source === 'SAVED' ? 'Using your saved location' : 'Location found'}
            </p>
            <p className="tabular text-sm text-muted">
              {formatCoordinates({ latitude: value.latitude!, longitude: value.longitude! }, 5)}
              {value.accuracyMeters !== undefined && ` · accurate to ~${value.accuracyMeters} m`}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl hover:bg-surface"
            onClick={() => onChange({ text: value.text, source: 'MANUAL' })}
            aria-label="Remove location"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="primary" size="lg" icon={Crosshair} loading={geo.status === 'locating'} onClick={useGps}>
            {geo.status === 'locating' ? 'Finding location…' : 'Use my current location'}
          </Button>
          {saved && (saved.latitude !== undefined || saved.text) && (
            <Button type="button" size="lg" icon={Bookmark} onClick={useSaved}>
              Use saved: {saved.label}
            </Button>
          )}
        </div>
      )}

      {(geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'timeout' || geo.status === 'unsupported') && (
        <Notice tone="warning" role="status">
          {GEO_MESSAGES[geo.status]}
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
