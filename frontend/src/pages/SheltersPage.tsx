import { distanceKm, type LatLng } from '@resqnet/shared';
import { Crosshair, Download, House, List, Map as MapIcon } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DataFreshness } from '../components/DataFreshness';
import type { MapMarker } from '../components/MapView';
import { ShelterCard } from '../components/ShelterCard';
import { Button, EmptyState, Notice, PageHeader, Skeleton, SkeletonList } from '../components/ui';
import { GEO_MESSAGES, useGeolocation } from '../hooks/useGeolocation';
import { useDataset, useRegion, useSavedLocation } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { downloadOfflinePack } from '../offline/datasets';
import { cn } from '../utils/cn';
import { cssVar } from '../utils/cssVar';

const MapView = lazy(() => import('../components/MapView'));

export default function SheltersPage() {
  const shelters = useDataset('shelters');
  const region = useRegion();
  const net = useNetwork();
  const geo = useGeolocation();
  const saved = useSavedLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [onlyFree, setOnlyFree] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin: LatLng | null = geo.position
    ? geo.position
    : saved?.latitude !== undefined && saved.longitude !== undefined
      ? { latitude: saved.latitude, longitude: saved.longitude }
      : null;

  const list = useMemo(() => {
    let l = shelters.data.filter((s) => s.status !== 'CLOSED');
    if (onlyFree) l = l.filter((s) => s.availableCapacity > 0);
    if (accessible) l = l.filter((s) => s.facilities.includes('DISABLED_ACCESS'));
    return origin
      ? [...l].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
      : [...l].sort((a, b) => b.availableCapacity - a.availableCapacity);
  }, [shelters.data, onlyFree, accessible, origin]);

  const markers: MapMarker[] = useMemo(() => {
    const m: MapMarker[] = list.map((s) => ({
      id: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      label: s.name,
      detail: `${s.availableCapacity} places free · ${s.status.toLowerCase()}`,
      kind: 'shelter',
      color: s.availableCapacity > 0 ? cssVar('--safe') : cssVar('--warning'),
    }));
    if (origin) m.push({ id: 'me', ...origin, label: 'You are here', kind: 'user', color: cssVar('--info') });
    return m;
  }, [list, origin]);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadOfflinePack(region);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const noData = shelters.source === 'bundled';

  return (
    <div>
      <PageHeader back="/" title="Find safe shelter" subtitle={`Relief centres in ${region}`} />

      {noData ? (
        <EmptyState
          icon={House}
          title="No shelters are available in your downloaded area."
          action={
            <Button variant="primary" icon={Download} loading={downloading} disabled={net.state === 'offline'} onClick={download}>
              Download shelters for {region}
            </Button>
          }
        >
          {net.state === 'offline'
            ? 'Connect to the internet once to download shelter information for offline use.'
            : 'Download shelter information now so it is available if the connection fails.'}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {net.state === 'offline' && (
            <Notice tone="warning" title="Shelter availability is not live while offline.">
              Capacity shown is from the last synchronisation. Call the shelter before travelling if you can.
            </Notice>
          )}
          <DataFreshness syncedAt={shelters.syncedAt} source={shelters.source} what="Shelter information" />

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border-2 border-line-strong p-1" role="group" aria-label="View">
              {(
                [
                  ['list', 'List', List],
                  ['map', 'Map', MapIcon],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 font-semibold',
                    view === v ? 'bg-info text-white' : 'text-text',
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
            <Button icon={Crosshair} loading={geo.status === 'locating'} onClick={() => void geo.locate()}>
              {geo.position ? 'Update distance' : 'Sort by distance'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <label className="flex min-h-12 items-center gap-2">
              <input type="checkbox" className="size-5 accent-[var(--focus)]" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
              Has free places
            </label>
            <label className="flex min-h-12 items-center gap-2">
              <input type="checkbox" className="size-5 accent-[var(--focus)]" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} />
              Disabled access
            </label>
          </div>

          {(geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'timeout' || geo.status === 'unsupported') && (
            <Notice tone="warning">{GEO_MESSAGES[geo.status]} Shelters are sorted by available space instead.</Notice>
          )}
          {error && <Notice tone="warning" title={error} />}

          {view === 'map' && (
            <div className="space-y-2">
              {net.state !== 'online' && (
                <Notice tone="warning">
                  Maps need internet. Areas you viewed before may still appear; the list below always works offline.
                </Notice>
              )}
              <Suspense fallback={<Skeleton className="h-[420px]" />}>
                <MapView markers={markers} onSelect={(id) => navigate(`/shelters/${id}`)} />
              </Suspense>
            </div>
          )}

          {shelters.loading ? (
            <SkeletonList />
          ) : list.length === 0 ? (
            <EmptyState icon={House} title="No shelters match these filters." />
          ) : (
            <ul className="space-y-3" aria-label="Shelters">
              {list.map((s) => (
                <ShelterCard key={s.id} shelter={s} from={origin} />
              ))}
            </ul>
          )}
          {origin && (
            <p className="text-sm text-muted">
              Distances are straight-line estimates from {geo.position ? 'your current location' : 'your saved location'}, not
              road routes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
