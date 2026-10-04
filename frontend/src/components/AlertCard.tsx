import type { AlertDTO } from '@resqnet/shared';
import { MapPin } from 'lucide-react';
import { cn } from '../utils/cn';
import { smartTime, timeUntil } from '../utils/time';
import { ALERT_ICON, ALERT_TONE, AlertSeverityBadge, DemoBadge } from './badges';
import { TONE } from './ui';

export function AlertCard({ alert, prominent }: { alert: AlertDTO; prominent?: boolean }) {
  const Icon = ALERT_ICON[alert.severity];
  const critical = alert.severity === 'CRITICAL';
  return (
    <article
      className={cn(
        'rounded-2xl border-2 p-4',
        TONE[ALERT_TONE[alert.severity]],
        critical && prominent && 'border-[3px]',
      )}
      aria-labelledby={`alert-${alert.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AlertSeverityBadge severity={alert.severity} />
        <span className="text-sm font-semibold text-text">{alert.disasterTypeName}</span>
        {alert.isDemo && <DemoBadge />}
      </div>
      <h3 id={`alert-${alert.id}`} className="mt-2 flex items-start gap-2 text-lg font-bold text-text">
        <Icon className="mt-1 size-5 shrink-0" aria-hidden />
        {alert.title}
      </h3>
      <p className="mt-1 text-text">{alert.message}</p>
      <p className="mt-2 rounded-xl bg-surface/70 p-3 font-semibold text-text">
        <span className="sr-only">What to do: </span>
        {alert.instruction}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-4" aria-hidden />
          {alert.region}
        </span>
        <span>Issued {smartTime(alert.startsAt)}</span>
        <span>Expires {timeUntil(alert.expiresAt)}</span>
      </p>
    </article>
  );
}
