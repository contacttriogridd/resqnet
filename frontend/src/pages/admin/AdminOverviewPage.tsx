import { INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, SEVERITIES, SEVERITY_LABELS, type IncidentStatus, type IncidentType, type Severity } from '@resqnet/shared';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { BarList, ColumnChart, StatTile } from '../../components/charts';
import { ErrorState, Button, Notice, PageHeader, SkeletonList } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useNetwork } from '../../hooks/useStore';
import { fetchAnalytics } from '../../services/staffService';
import { smartTime } from '../../utils/time';

const minutes = (m: number | null) => (m === null ? '—' : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

export default function AdminOverviewPage() {
  const net = useNetwork();
  const [includeDemo, setIncludeDemo] = useState(false);
  const { data, error, loading, reload } = useAsync(() => fetchAnalytics(includeDemo), [includeDemo]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin overview"
        subtitle={data ? `Last 14 days · updated ${smartTime(data.generatedAt)}` : 'Last 14 days'}
        actions={
          <Button icon={RefreshCw} loading={loading} disabled={net.state === 'offline'} onClick={() => void reload()}>
            Refresh
          </Button>
        }
      />
      <label className="flex min-h-12 items-center gap-2">
        <input type="checkbox" className="size-5 accent-[var(--focus)]" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
        Include simulated (demo) data
      </label>
      {includeDemo && <Notice tone="demo">Figures include DEMO data and do not reflect real operations.</Notice>}

      {error && !data && <ErrorState message={error} onRetry={() => void reload()} />}
      {loading && !data && <SkeletonList rows={3} />}

      {data && (
        <>
          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Active incidents" value={data.totals.activeIncidents} />
            <StatTile label="Critical incidents" value={data.totals.criticalIncidents} tone={data.totals.criticalIncidents > 0 ? 'critical' : undefined} hint="active" />
            <StatTile label="Resolved incidents" value={data.totals.resolvedIncidents} hint="all time" />
            <StatTile label="Active alerts" value={data.totals.activeAlerts} />
            <StatTile label="Shelters" value={data.totals.shelters} />
            <StatTile label="Users" value={data.totals.users.toLocaleString()} />
            <StatTile label="Volunteers" value={data.totals.volunteers} />
            <StatTile label="Responders" value={data.totals.responders} />
          </section>

          <section aria-label="Response time" className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="Median time to assign" value={minutes(data.responseTime.medianMinutesToAssign)} />
            <StatTile label="Median time to resolve" value={minutes(data.responseTime.medianMinutesToResolve)} />
            <StatTile label="People needing help (24 h)" value={data.totals.pendingSafetyChecks} hint="safety status: assistance / emergency" />
          </section>

          <ColumnChart title="Daily incident volume" subtitle="Reports received per day" data={data.dailyVolume} />

          <div className="grid gap-4 lg:grid-cols-2">
            <BarList
              title="Incidents by severity"
              data={SEVERITIES.map((s: Severity) => ({
                label: SEVERITY_LABELS[s],
                value: data.incidentsBySeverity.find((x) => x.key === s)?.count ?? 0,
              }))}
            />
            <BarList
              title="Incidents by type"
              data={data.incidentsByType.map((x) => ({ label: INCIDENT_TYPE_LABELS[x.key as IncidentType] ?? x.key, value: x.count }))}
            />
            <BarList title="Incidents by location" subtitle="Nearest shelter region" data={data.incidentsByLocation.map((x) => ({ label: x.key, value: x.count }))} />
            <BarList
              title="Incidents by status"
              data={data.incidentsByStatus.map((x) => ({ label: INCIDENT_STATUS_LABELS[x.key as IncidentStatus] ?? x.key, value: x.count }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
