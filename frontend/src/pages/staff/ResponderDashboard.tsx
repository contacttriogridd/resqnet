import { SEVERITIES, SEVERITY_LABELS, compareIncidentsForTriage, type IncidentDTO } from '@resqnet/shared';
import { ClipboardList, List, Map as MapIcon, RefreshCw } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { SEVERITY_TONE } from '../../components/badges';
import { DataFreshness } from '../../components/DataFreshness';
import { IncidentCard } from '../../components/IncidentCard';
import type { MapMarker } from '../../components/MapView';
import { Button, EmptyState, ErrorState, Notice, PageHeader, Skeleton, SkeletonList, TONE } from '../../components/ui';
import { useDataset, useNow } from '../../hooks/useOfflineData';
import { useNetwork } from '../../hooks/useStore';
import { errorMessage } from '../../services/apiClient';
import { fetchIncidents, type IncidentQuery } from '../../services/staffService';
import { cn } from '../../utils/cn';
import { cssVar } from '../../utils/cssVar';

const MapView = lazy(() => import('../../components/MapView'));

const ACTIVE = 'RECEIVED,VERIFIED,ASSIGNED,IN_PROGRESS';
const TABS: { key: string; label: string; query: IncidentQuery }[] = [
  { key: 'active', label: 'Active', query: { status: ACTIVE } },
  { key: 'unassigned', label: 'Unassigned', query: { status: ACTIVE, assigned: 'unassigned' } },
  { key: 'mine', label: 'Assigned to me', query: { status: ACTIVE, assigned: 'me' } },
  { key: 'closed', label: 'Resolved / cancelled', query: { status: 'RESOLVED,CANCELLED' } },
];

export default function ResponderDashboard() {
  const net = useNetwork();
  const cached = useDataset('tasks');
  const now = useNow(30_000);
  const navigate = useNavigate();
  const [tab, setTab] = useState(TABS[0]!);
  const [includeDemo, setIncludeDemo] = useState(true);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [items, setItems] = useState<IncidentDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchIncidents({ ...tab.query, includeDemo }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, includeDemo]);

  // Live refresh every 30 s while online.
  useEffect(() => {
    if (net.state === 'offline') return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net.state, tab, includeDemo]);

  const usingCache = !items && cached.source === 'server';
  const list = useMemo(() => [...(items ?? (usingCache ? cached.data : []))].sort(compareIncidentsForTriage), [items, usingCache, cached.data]);
  const counts = SEVERITIES.map((s) => ({ s, n: list.filter((i) => i.severity === s).length }));

  const markers: MapMarker[] = list
    .filter((i) => i.latitude !== null && i.longitude !== null)
    .map((i) => ({
      id: i.id,
      latitude: i.latitude!,
      longitude: i.longitude!,
      label: `${i.referenceCode} · ${SEVERITY_LABELS[i.severity]}`,
      detail: i.locationText ?? undefined,
      kind: 'incident',
      color: cssVar(i.severity === 'CRITICAL' ? '--critical' : i.severity === 'HIGH' ? '--warning' : i.severity === 'MEDIUM' ? '--advisory' : '--neutral'),
    }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Responder dashboard"
        subtitle="Incidents sorted by severity, then suggested priority, then waiting time."
        actions={
          <Button icon={RefreshCw} loading={loading} disabled={net.state === 'offline'} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Counts by severity">
        {counts.map(({ s, n }) => (
          <div key={s} className={cn('rounded-xl border-2 p-3', TONE[SEVERITY_TONE[s]])}>
            <p className="text-sm font-bold uppercase">{SEVERITY_LABELS[s]}</p>
            <p className="tabular text-3xl font-extrabold text-text">{n}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border-2 border-line-strong p-1" role="tablist" aria-label="Filter incidents">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab.key === t.key}
              onClick={() => setTab(t)}
              className={cn(
                'min-h-10 rounded-lg px-3 font-semibold',
                tab.key === t.key ? 'bg-info text-white' : 'text-text hover:bg-surface-2',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button size="md" icon={view === 'list' ? MapIcon : List} onClick={() => setView(view === 'list' ? 'map' : 'list')}>
          {view === 'list' ? 'Map' : 'List'}
        </Button>
        <label className="flex min-h-12 items-center gap-2">
          <input type="checkbox" className="size-5 accent-[var(--focus)]" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
          Show demo data
        </label>
      </div>

      {net.state === 'offline' && (
        <Notice tone="warning" title="Offline — showing the last incident list downloaded to this device.">
          Updating incidents needs a connection.
        </Notice>
      )}
      {usingCache && <DataFreshness syncedAt={cached.syncedAt} source="server" what="Incident list" />}
      {error && !usingCache && <ErrorState message={error} onRetry={() => void load()} />}

      {view === 'map' && (
        <Suspense fallback={<Skeleton className="h-[420px]" />}>
          <MapView markers={markers} onSelect={(id) => navigate(`/incidents/${id}`)} />
        </Suspense>
      )}

      {loading && !items && !usingCache ? (
        <SkeletonList rows={4} />
      ) : list.length === 0 && !error ? (
        <EmptyState icon={ClipboardList} title="No active emergencies reported.">
          New requests appear here automatically.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <IncidentCard key={i.id} incident={i} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}
