import { FACILITIES, FACILITY_LABELS, formatCoordinates } from '@resqnet/shared';
import { Accessibility, CheckCircle2, ExternalLink, House, MapPin, Phone, XCircle } from 'lucide-react';
import { useParams } from 'react-router';
import { ShelterStatusBadge } from '../components/badges';
import { DataFreshness } from '../components/DataFreshness';
import { CapacityBar } from '../components/ShelterCard';
import { ButtonLink, Card, EmptyState, Notice, PageHeader } from '../components/ui';
import { useDataset } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { telHref } from '../utils/cn';

export default function ShelterDetailPage() {
  const { id } = useParams();
  const shelters = useDataset('shelters');
  const net = useNetwork();
  const s = shelters.data.find((x) => x.id === id);

  if (!s) {
    return (
      <EmptyState icon={House} title="Shelter not found on this device" action={<ButtonLink to="/shelters">All shelters</ButtonLink>}>
        Download shelter information for your region from the shelters page.
      </EmptyState>
    );
  }

  const geoUri = `geo:${s.latitude},${s.longitude}?q=${s.latitude},${s.longitude}(${encodeURIComponent(s.name)})`;
  const webMap = `https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`;

  return (
    <div className="space-y-4">
      <PageHeader back="/shelters" title={s.name} subtitle={<ShelterStatusBadge status={s.status} />} />

      {net.state === 'offline' && (
        <Notice tone="warning">Availability below is from the last synchronisation and may have changed.</Notice>
      )}

      <Card className="space-y-3">
        <CapacityBar shelter={s} />
        <p className="tabular text-sm text-muted">
          {s.occupancy} people currently registered · capacity {s.capacity}
        </p>
        <DataFreshness syncedAt={shelters.syncedAt} source={shelters.source} what="Shelter information" />
        <p className="text-sm text-muted">Shelter record updated by staff: {new Date(s.updatedAt).toLocaleString()}</p>
      </Card>

      {s.contactPhone && (
        <a
          href={telHref(s.contactPhone)}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-info-line bg-info-bg font-bold text-info"
        >
          <Phone className="size-5" aria-hidden /> Call shelter · <span className="tabular">{s.contactPhone}</span>
        </a>
      )}

      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <MapPin className="size-5" aria-hidden /> Address
        </h2>
        <p>{s.address}</p>
        <p className="tabular mt-1 text-sm text-muted">{formatCoordinates(s)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={geoUri} className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line-strong px-4 font-semibold">
            <MapPin className="size-5" aria-hidden /> Open in maps app
          </a>
          {net.state !== 'offline' && (
            <a
              href={webMap}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line-strong px-4 font-semibold"
            >
              <ExternalLink className="size-5" aria-hidden /> View web map
            </a>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-bold">Facilities</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FACILITIES.map((f) => {
            const has = s.facilities.includes(f);
            return (
              <li key={f} className={has ? 'flex items-center gap-2' : 'flex items-center gap-2 text-muted line-through'}>
                {has ? (
                  <CheckCircle2 className="size-5 text-safe" aria-hidden />
                ) : (
                  <XCircle className="size-5" aria-hidden />
                )}
                <span>
                  {FACILITY_LABELS[f]}
                  <span className="sr-only">{has ? ': available' : ': not available'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {s.accessibilityInfo && (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Accessibility className="size-5" aria-hidden /> Accessibility
          </h2>
          <p>{s.accessibilityInfo}</p>
        </Card>
      )}

      {s.resources.length > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-bold">Supplies (last reported)</h2>
          <ul className="divide-y divide-line">
            {s.resources.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <span>{r.resourceType}</span>
                <span className="tabular font-semibold">
                  {r.quantity.toLocaleString()} {r.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
