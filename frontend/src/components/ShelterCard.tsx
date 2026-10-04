import { FACILITY_LABELS, compassDirection, distanceKm, formatDistance, type LatLng, type ShelterDTO } from '@resqnet/shared';
import { ChevronRight, Navigation, Users } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../utils/cn';
import { ShelterStatusBadge } from './badges';

export function CapacityBar({ shelter }: { shelter: ShelterDTO }) {
  const pct = Math.min(100, Math.round((shelter.occupancy / shelter.capacity) * 100));
  const tone = pct >= 100 ? 'bg-critical' : pct >= 85 ? 'bg-warning' : 'bg-safe';
  return (
    <div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={shelter.capacity}
        aria-valuenow={shelter.occupancy}
        aria-label="Shelter occupancy"
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm">
        <Users className="size-4 text-muted" aria-hidden />
        <span className="tabular">
          <strong>{shelter.availableCapacity}</strong> places free of {shelter.capacity}
        </span>
      </p>
    </div>
  );
}

export function ShelterCard({ shelter, from }: { shelter: ShelterDTO; from?: LatLng | null }) {
  const km = from ? distanceKm(from, shelter) : null;
  return (
    <li>
      <Link
        to={`/shelters/${shelter.id}`}
        className="block rounded-2xl border border-line bg-surface p-4 hover:border-line-strong"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold leading-tight">{shelter.name}</h3>
              <ShelterStatusBadge status={shelter.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted">{shelter.address}</p>
            {km !== null && from && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-info">
                <Navigation className="size-4" aria-hidden />
                {formatDistance(km)} {compassDirection(from, shelter)} (straight line)
              </p>
            )}
          </div>
          <ChevronRight className="mt-1 size-6 shrink-0 text-muted" aria-hidden />
        </div>
        <div className="mt-3">
          <CapacityBar shelter={shelter} />
        </div>
        {shelter.facilities.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            {shelter.facilities
              .slice(0, 5)
              .map((f) => FACILITY_LABELS[f])
              .join(' · ')}
            {shelter.facilities.length > 5 ? ` · +${shelter.facilities.length - 5} more` : ''}
          </p>
        )}
      </Link>
    </li>
  );
}
