import { BellOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { AlertCard } from '../components/AlertCard';
import { DataFreshness } from '../components/DataFreshness';
import { Button, EmptyState, Notice, PageHeader, SkeletonList } from '../components/ui';
import { useActiveAlerts, useRegion } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { refreshData } from '../offline/refresh';

const RANK = { CRITICAL: 0, WARNING: 1, ADVISORY: 2, INFO: 3 } as const;

export default function AlertsPage() {
  const alerts = useActiveAlerts();
  const region = useRegion();
  const net = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const sorted = [...alerts.data].sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || +new Date(b.startsAt) - +new Date(a.startsAt),
  );

  return (
    <div>
      <PageHeader
        back="/"
        title="Emergency alerts"
        subtitle={`For ${region} and nationwide`}
        actions={
          <Button
            icon={RefreshCw}
            loading={refreshing}
            disabled={net.state === 'offline'}
            onClick={async () => {
              setRefreshing(true);
              await refreshData({ force: true });
              setRefreshing(false);
            }}
          >
            Refresh
          </Button>
        }
      />
      {net.state === 'offline' && (
        <Notice tone="warning" className="mb-3" title="You are not receiving live alerts.">
          These are the alerts saved on this device the last time it was online. New alerts will appear when the
          connection returns.
        </Notice>
      )}
      <DataFreshness syncedAt={alerts.syncedAt} source={alerts.source} what="Alerts" className="mb-4" />

      {alerts.loading ? (
        <SkeletonList rows={2} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={BellOff} title={`No active alerts for ${region}`}>
          {alerts.source === 'bundled'
            ? 'Alerts have not been downloaded on this device yet. Connect to the internet to receive them.'
            : 'No emergencies are currently reported for your area.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sorted.map((a) => (
            <li key={a.id}>
              <AlertCard alert={a} prominent />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
