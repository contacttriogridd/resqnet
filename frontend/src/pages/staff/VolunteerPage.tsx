import { distanceKm, type IncidentDTO } from '@resqnet/shared';
import { Crosshair, HeartHandshake, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DataFreshness } from '../../components/DataFreshness';
import { IncidentCard } from '../../components/IncidentCard';
import { Button, EmptyState, ErrorState, Notice, PageHeader, SkeletonList } from '../../components/ui';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useDataset, useNow, useSavedLocation } from '../../hooks/useOfflineData';
import { useNetwork } from '../../hooks/useStore';
import { errorMessage } from '../../services/apiClient';
import { fetchIncidents } from '../../services/staffService';
import { cn } from '../../utils/cn';

export default function VolunteerPage() {
  const net = useNetwork();
  const geo = useGeolocation();
  const saved = useSavedLocation();
  const cached = useDataset('tasks');
  const now = useNow();
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [items, setItems] = useState<IncidentDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchIncidents({ assigned: tab === 'open' ? 'unassigned' : 'me' }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const origin = geo.position ?? (saved?.latitude !== undefined && saved.longitude !== undefined ? { latitude: saved.latitude, longitude: saved.longitude } : null);
  const usingCache = !items && cached.source === 'server';
  const list = useMemo(() => {
    const l = items ?? (usingCache ? cached.data : []);
    if (!origin) return l;
    const d = (i: IncidentDTO) => (i.latitude !== null && i.longitude !== null ? distanceKm(origin, { latitude: i.latitude, longitude: i.longitude }) : 9e9);
    return [...l].sort((a, b) => d(a) - d(b));
  }, [items, usingCache, cached.data, origin]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Volunteer tasks"
        subtitle="Help requests near you. Exact location and phone number are shown after you accept."
        actions={
          <Button icon={RefreshCw} loading={loading} disabled={net.state === 'offline'} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border-2 border-line-strong p-1" role="tablist">
          {(
            [
              ['open', 'Open requests'],
              ['mine', 'My tasks'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn('min-h-10 rounded-lg px-3 font-semibold', tab === k ? 'bg-info text-white' : 'hover:bg-surface-2')}
            >
              {label}
            </button>
          ))}
        </div>
        <Button icon={Crosshair} loading={geo.status === 'locating'} onClick={() => void geo.locate()}>
          Nearest first
        </Button>
      </div>

      {net.state === 'offline' && (
        <Notice tone="warning" title="Offline — showing tasks saved on this device.">
          Accepting or updating tasks needs a connection.
        </Notice>
      )}
      {usingCache && <DataFreshness syncedAt={cached.syncedAt} source="server" what="Task list" />}
      {error && !usingCache && <ErrorState message={error} onRetry={() => void load()} />}

      {loading && !items && !usingCache ? (
        <SkeletonList />
      ) : list.length === 0 && !error ? (
        <EmptyState icon={HeartHandshake} title={tab === 'open' ? 'No open help requests right now.' : 'You have no tasks yet.'}>
          {tab === 'open' ? 'Thank you for being ready to help.' : 'Accept an open request to see it here.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <IncidentCard key={i.id} incident={i} from={origin} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
