import {
  INCIDENT_TYPE_LABELS,
  PEOPLE_COUNT_LABELS,
  SPECIAL_REQUIREMENT_LABELS,
  distanceKm,
  formatDistance,
  type IncidentDTO,
  type LatLng,
} from '@resqnet/shared';
import { ChevronRight, CloudOff, MapPin, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../utils/cn';
import { timeAgo } from '../utils/time';
import { DemoBadge, IncidentStatusBadge, PriorityBadge, SeverityBadge } from './badges';

/** Minutes an offline-queued report waited on the device before reaching the server (0 if sent directly). */
export function queuedMinutes(i: IncidentDTO): number {
  if (i.receivedVia !== 'SYNC') return 0;
  return Math.round((new Date(i.createdAt).getTime() - new Date(i.clientCreatedAt).getTime()) / 60_000);
}

export function IncidentCard({ incident: i, from, now }: { incident: IncidentDTO; from?: LatLng | null; now?: number }) {
  const km = from && i.latitude !== null && i.longitude !== null ? distanceKm(from, { latitude: i.latitude, longitude: i.longitude }) : null;
  const queued = queuedMinutes(i);
  return (
    <li>
      <Link
        to={`/incidents/${i.id}`}
        className={cn(
          'block rounded-2xl border bg-surface p-4 hover:border-line-strong',
          i.severity === 'CRITICAL' && ['RECEIVED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status)
            ? 'border-2 border-critical-line'
            : 'border-line',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={i.severity} />
          <IncidentStatusBadge status={i.status} />
          {i.isDemo && <DemoBadge />}
          <span className="tabular ml-auto text-sm font-semibold text-muted">{i.referenceCode}</span>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">{INCIDENT_TYPE_LABELS[i.type]}</h3>
            <p className="flex items-start gap-1.5 text-[0.95rem]">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0">
                {i.locationText ?? (i.latitude !== null ? `${i.latitude.toFixed(4)}, ${i.longitude?.toFixed(4)}` : 'No location')}
                {km !== null && <strong className="ml-1 text-info">· {formatDistance(km)}</strong>}
              </span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" aria-hidden /> {PEOPLE_COUNT_LABELS[i.peopleCount]} people
              </span>
              <span>Reported {timeAgo(i.clientCreatedAt, now)}</span>
              {i.receivedVia === 'SYNC' && (
                <span className="inline-flex items-center gap-1 font-semibold text-warning">
                  <CloudOff className="size-4" aria-hidden /> queued offline {queued} min
                </span>
              )}
            </p>
            {i.specialRequirements.length > 0 && (
              <p className="mt-1 text-sm font-semibold">
                Needs: {i.specialRequirements.map((r) => SPECIAL_REQUIREMENT_LABELS[r]).join(', ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge band={i.priorityBand} score={i.priorityScore} />
              {(i.assignedResponder || i.assignedVolunteer) && (
                <span className="inline-flex items-center gap-1 text-sm text-muted">
                  <UserCheck className="size-4" aria-hidden />
                  {[i.assignedResponder?.name, i.assignedVolunteer?.name].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="mt-1 size-6 shrink-0 text-muted" aria-hidden />
        </div>
      </Link>
    </li>
  );
}
