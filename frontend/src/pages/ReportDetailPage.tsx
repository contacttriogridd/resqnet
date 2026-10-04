import {
  INCIDENT_TYPE_LABELS,
  PEOPLE_COUNT_LABELS,
  SEVERITY_LABELS,
  SPECIAL_REQUIREMENT_LABELS,
  formatCoordinates,
} from '@resqnet/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { Ban, CheckCircle2, CloudOff, FileQuestion, Loader2, Phone, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { IncidentStatusBadge, SyncBadge } from '../components/badges';
import { Button, ButtonLink, Card, EmptyState, Notice, PageHeader, SkeletonList, TextInput } from '../components/ui';
import { db } from '../database/db';
import { useNetwork } from '../hooks/useStore';
import { cancelIncident, retryIncident } from '../services/incidentService';
import { requestSync } from '../sync/syncManager';
import { dateTime, timeAgo } from '../utils/time';

export default function ReportDetailPage() {
  const { clientId = '' } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const net = useNetwork();
  const incident = useLiveQuery(() => db.incidents.get(clientId), [clientId]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState('');

  if (incident === undefined) return <SkeletonList rows={2} />;
  if (!incident) {
    return (
      <EmptyState icon={FileQuestion} title="Report not found on this device" action={<ButtonLink to="/reports">My reports</ButtonLink>}>
        Reports are stored on the device they were sent from.
      </EmptyState>
    );
  }

  const p = incident.payload;
  const localId = incident.clientId.slice(0, 8).toUpperCase();
  const final = incident.status === 'RESOLVED' || incident.status === 'CANCELLED';

  return (
    <div className="space-y-4">
      <PageHeader back="/reports" title={isNew ? 'Request saved' : 'Your request'} />

      {incident.status === 'CANCELLED' ? (
        <Notice tone="neutral" icon={Ban} title="You cancelled this request." />
      ) : incident.syncStatus === 'PENDING' ? (
        <div className="rounded-2xl border-2 border-warning-line bg-warning-bg p-5" role="status">
          <p className="flex items-center gap-2 text-xl font-extrabold tracking-wide text-warning uppercase">
            <CloudOff className="size-7" aria-hidden /> Waiting for connection
          </p>
          <p className="mt-2 text-lg text-text">
            Your emergency request has been saved on this device and will be synchronised automatically when
            connectivity returns.
          </p>
          <p className="mt-2 text-text">
            Local ID: <strong className="tabular tracking-wider">{localId}</strong>
          </p>
          {net.state !== 'offline' && (
            <Button className="mt-3" icon={RefreshCw} onClick={() => void requestSync()}>
              Try sending now
            </Button>
          )}
        </div>
      ) : incident.syncStatus === 'SYNCING' ? (
        <div className="rounded-2xl border-2 border-info-line bg-info-bg p-5" role="status">
          <p className="flex items-center gap-2 text-xl font-bold text-info">
            <Loader2 className="size-7 animate-spin" aria-hidden /> Sending your request…
          </p>
          <p className="mt-1">Already saved on this device, so it won't be lost.</p>
        </div>
      ) : incident.syncStatus === 'FAILED' ? (
        <div className="rounded-2xl border-2 border-critical-line bg-critical-bg p-5" role="alert">
          <p className="flex items-center gap-2 text-xl font-bold text-critical">
            <XCircle className="size-7" aria-hidden /> The server did not accept this request
          </p>
          <p className="mt-1">{incident.syncError}</p>
          <p className="mt-1 font-semibold">If you need help now, call 112.</p>
          <Button className="mt-3" icon={RefreshCw} onClick={() => void retryIncident(incident.clientId)}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-safe-line bg-safe-bg p-5" role="status">
          <p className="flex items-center gap-2 text-xl font-bold text-safe">
            <CheckCircle2 className="size-7" aria-hidden /> Received by RESQNET
          </p>
          <p className="mt-2 text-text">Reference code (read this out if you call):</p>
          <p className="tabular text-3xl font-extrabold tracking-widest">{incident.referenceCode}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={incident.status} />
            {incident.assigned && <span className="font-semibold">A responder has been assigned.</span>}
          </div>
          {incident.lastNote && <p className="mt-2 text-text">Latest update: “{incident.lastNote}”</p>}
          {incident.statusCheckedAt && (
            <p className="mt-1 text-sm text-muted">Status checked {timeAgo(incident.statusCheckedAt)}.</p>
          )}
          {!final && <p className="mt-2 text-text">Keep your phone on and stay where it is safe.</p>}
        </div>
      )}

      {!final && (
        <a
          href="tel:112"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-critical-line bg-surface font-bold text-critical hover:bg-critical-bg"
        >
          <Phone className="size-5" aria-hidden /> If life is in danger, call 112 now
        </a>
      )}

      <Card>
        <h2 className="mb-2 text-lg font-bold">What you sent</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted">Type</dt>
          <dd className="font-semibold">{INCIDENT_TYPE_LABELS[p.type]}</dd>
          <dt className="text-muted">Severity</dt>
          <dd>{SEVERITY_LABELS[p.severity]}</dd>
          <dt className="text-muted">People</dt>
          <dd>{PEOPLE_COUNT_LABELS[p.peopleCount]}</dd>
          {p.specialRequirements.length > 0 && (
            <>
              <dt className="text-muted">Needs</dt>
              <dd>{p.specialRequirements.map((r) => SPECIAL_REQUIREMENT_LABELS[r]).join(', ')}</dd>
            </>
          )}
          <dt className="text-muted">Location</dt>
          <dd>
            {p.location.latitude !== undefined && p.location.longitude !== undefined && (
              <span className="tabular block">
                {formatCoordinates({ latitude: p.location.latitude, longitude: p.location.longitude })}
              </span>
            )}
            {p.location.text}
          </dd>
          {p.description && (
            <>
              <dt className="text-muted">Message</dt>
              <dd>{p.description}</dd>
            </>
          )}
          <dt className="text-muted">Saved</dt>
          <dd>{dateTime(incident.createdAt)}</dd>
          {incident.syncedAt && (
            <>
              <dt className="text-muted">Delivered</dt>
              <dd>{dateTime(incident.syncedAt)}</dd>
            </>
          )}
          <dt className="text-muted">Delivery</dt>
          <dd>
            <SyncBadge status={incident.syncStatus} />
          </dd>
        </dl>
      </Card>

      {!final &&
        (confirmCancel ? (
          <Card className="space-y-3">
            <p className="font-semibold">Cancel this request? Responders will be told you no longer need help.</p>
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              placeholder="Reason (optional), e.g. we reached the shelter"
              aria-label="Reason for cancelling"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger-outline"
                icon={Ban}
                onClick={async () => {
                  await cancelIncident(incident.clientId, reason || undefined);
                  setConfirmCancel(false);
                }}
              >
                Yes, cancel request
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                Keep request
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="ghost" icon={Ban} onClick={() => setConfirmCancel(true)}>
            We no longer need help
          </Button>
        ))}
    </div>
  );
}
