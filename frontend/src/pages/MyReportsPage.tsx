import { INCIDENT_TYPE_LABELS } from '@resqnet/shared';
import { ChevronRight, FileText, RefreshCw, Siren } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { IncidentStatusBadge, SyncBadge } from '../components/badges';
import { Button, ButtonLink, EmptyState, Notice, PageHeader, SkeletonList } from '../components/ui';
import { useMyIncidents } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { refreshMyReportStatuses } from '../services/incidentService';
import { requestSync } from '../sync/syncManager';
import { dateTime } from '../utils/time';

export default function MyReportsPage() {
  const reports = useMyIncidents();
  const net = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await requestSync();
      await refreshMyReportStatuses();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <PageHeader
        back="/"
        title="My reports"
        subtitle="Requests sent from this device."
        actions={
          <Button icon={RefreshCw} loading={refreshing} disabled={net.state === 'offline'} onClick={refresh}>
            Update status
          </Button>
        }
      />
      {error && <Notice tone="warning" className="mb-3" title={error} />}
      {net.state === 'offline' && (
        <Notice tone="warning" className="mb-3">
          You are offline. Statuses below were last updated when you had a connection.
        </Notice>
      )}

      {!reports ? (
        <SkeletonList />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports on this device"
          action={
            <ButtonLink to="/sos" variant="emergency" icon={Siren}>
              Request help
            </ButtonLink>
          }
        >
          Requests you send will appear here, including ones waiting for a connection.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.clientId}>
              <Link
                to={`/reports/${r.clientId}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {INCIDENT_TYPE_LABELS[r.payload.type]}
                    {r.referenceCode && <span className="tabular ml-2 font-semibold text-muted">{r.referenceCode}</span>}
                  </p>
                  <p className="text-sm text-muted">{dateTime(r.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.syncStatus === 'SYNCED' ? <IncidentStatusBadge status={r.status} /> : <SyncBadge status={r.syncStatus} />}
                    {r.status === 'CANCELLED' && r.syncStatus !== 'SYNCED' && <IncidentStatusBadge status="CANCELLED" />}
                  </div>
                </div>
                <ChevronRight className="size-6 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
