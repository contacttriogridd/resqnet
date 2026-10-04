import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_TRANSITIONS,
  INCIDENT_TYPE_LABELS,
  PEOPLE_COUNT_LABELS,
  ROLE_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  SPECIAL_REQUIREMENT_LABELS,
  VOLUNTEER_SETTABLE_STATUSES,
  formatCoordinates,
  type IncidentDTO,
  type IncidentStatus,
  type IncidentUpdateInput,
  type Severity,
} from '@resqnet/shared';
import { Bot, CloudOff, Hand, MessageSquarePlus, Phone, UserCheck } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { DemoBadge, IncidentStatusBadge, PriorityBadge, SeverityBadge } from '../../components/badges';
import { queuedMinutes } from '../../components/IncidentCard';
import { Button, Card, ErrorState, Label, Notice, PageHeader, Select, Skeleton, SkeletonList, TextArea } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useNetwork, useSession } from '../../hooks/useStore';
import { errorMessage } from '../../services/apiClient';
import {
  acceptIncident,
  addIncidentNote,
  fetchAssignable,
  fetchIncident,
  updateIncident,
} from '../../services/staffService';
import { telHref } from '../../utils/cn';
import { cssVar } from '../../utils/cssVar';
import { dateTime, timeAgo } from '../../utils/time';

const MapView = lazy(() => import('../../components/MapView'));

const ACTION_LABEL: Partial<Record<IncidentStatus, string>> = {
  VERIFIED: 'Mark verified',
  ASSIGNED: 'Mark assigned',
  IN_PROGRESS: 'Mark in progress',
  RESOLVED: 'Mark resolved',
  CANCELLED: 'Cancel incident',
  RECEIVED: 'Reopen',
};

export default function IncidentDetailPage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const net = useNetwork();
  const { data: incident, error, loading, reload, setData } = useAsync(() => fetchIncident(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const isStaff = user?.role === 'RESPONDER' || user?.role === 'ADMIN';
  const offline = net.state === 'offline';

  const run = async (key: string, fn: () => Promise<IncidentDTO>) => {
    setBusy(key);
    setActionError(null);
    try {
      setData(await fn());
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading && !incident) return <SkeletonList rows={3} />;
  if (error && !incident) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!incident || !user) return null;

  const i = incident;
  const mineAsVolunteer = i.assignedVolunteer?.id === user.id;
  const mineAsResponder = i.assignedResponder?.id === user.id;
  const active = ['RECEIVED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status);
  const nextStatuses = INCIDENT_TRANSITIONS[i.status].filter(
    (s): s is Exclude<IncidentStatus, 'PENDING'> =>
      s !== 'PENDING' && (isStaff || (mineAsVolunteer && VOLUNTEER_SETTABLE_STATUSES.includes(s))),
  );
  const canAccept = active && (isStaff ? !mineAsResponder : user.role === 'VOLUNTEER' && !i.assignedVolunteer);
  const queued = queuedMinutes(i);
  const update = (key: string, body: IncidentUpdateInput) => run(key, () => updateIncident(i.id, body));

  return (
    <div className="space-y-4">
      <PageHeader
        back={user.role === 'VOLUNTEER' ? '/volunteer' : '/responder'}
        title={`${INCIDENT_TYPE_LABELS[i.type]} · ${i.referenceCode}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={i.severity} />
            <IncidentStatusBadge status={i.status} />
            {i.isDemo && <DemoBadge />}
          </span>
        }
      />
      {offline && <Notice tone="warning" title="Offline — actions are disabled until the connection returns." />}
      {actionError && <Notice tone="critical" role="alert" title={actionError} />}

      {/* Actions */}
      {(canAccept || nextStatuses.length > 0) && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {canAccept && (
              <Button variant="primary" size="lg" icon={Hand} loading={busy === 'accept'} disabled={offline} onClick={() => run('accept', () => acceptIncident(i.id))}>
                {user.role === 'VOLUNTEER' ? 'Accept this task' : 'Accept & assign to me'}
              </Button>
            )}
            {nextStatuses.map((s) => (
              <Button
                key={s}
                variant={s === 'CANCELLED' ? 'danger-outline' : 'secondary'}
                loading={busy === s}
                disabled={offline}
                onClick={() => {
                  if (s === 'CANCELLED' && !window.confirm('Cancel this incident?')) return;
                  void update(s, { status: s, ...(note.trim() ? { note: note.trim() } : {}) });
                  setNote('');
                }}
              >
                {ACTION_LABEL[s] ?? INCIDENT_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
          {isStaff && <StaffControls incident={i} disabled={offline} busy={busy} onUpdate={update} />}
        </Card>
      )}

      {/* Advisory priority */}
      <Card className="space-y-2 border-dashed">
        <h2 className="flex items-center gap-2 font-bold">
          <Bot className="size-5" aria-hidden /> Suggested priority <span className="font-normal text-muted">(advisory)</span>
        </h2>
        <PriorityBadge band={i.priorityBand} score={i.priorityScore} />
        <ul className="list-disc pl-6 text-[0.95rem]">
          {i.priorityReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">Calculated by transparent rules. It never overrides the judgement of responders.</p>
      </Card>

      {/* Details */}
      <Card>
        <h2 className="mb-2 text-lg font-bold">Details</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted">People</dt>
          <dd className="font-semibold">{PEOPLE_COUNT_LABELS[i.peopleCount]}</dd>
          <dt className="text-muted">Needs</dt>
          <dd>{i.specialRequirements.length ? i.specialRequirements.map((r) => SPECIAL_REQUIREMENT_LABELS[r]).join(', ') : '—'}</dd>
          <dt className="text-muted">Message</dt>
          <dd>{i.description ?? '—'}</dd>
          <dt className="text-muted">Reported</dt>
          <dd>
            {dateTime(i.clientCreatedAt)} ({timeAgo(i.clientCreatedAt)})
            {i.receivedVia === 'SYNC' && (
              <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-warning">
                <CloudOff className="size-4" aria-hidden /> Saved offline on the device; reached the server {queued} min later.
              </span>
            )}
          </dd>
          <dt className="text-muted">Assigned</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {i.assignedResponder || i.assignedVolunteer ? (
              <>
                <UserCheck className="size-4" aria-hidden />
                {i.assignedResponder && <span>Responder: {i.assignedResponder.name}</span>}
                {i.assignedVolunteer && <span>Volunteer: {i.assignedVolunteer.name}</span>}
              </>
            ) : (
              'Not assigned'
            )}
          </dd>
          {i.reporter && (
            <>
              <dt className="text-muted">Reporter</dt>
              <dd>{i.reporter.name}</dd>
            </>
          )}
        </dl>
        {i.contactPhone ? (
          <a href={telHref(i.contactPhone)} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-info-line bg-info-bg px-4 font-bold text-info">
            <Phone className="size-5" aria-hidden /> Call reporter · <span className="tabular">{i.contactPhone}</span>
          </a>
        ) : (
          user.role === 'VOLUNTEER' && !mineAsVolunteer && <p className="mt-3 text-sm text-muted">Phone number is shown after you accept.</p>
        )}
      </Card>

      {/* Location */}
      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Location</h2>
        {i.locationText && <p className="text-lg">{i.locationText}</p>}
        {i.latitude !== null && i.longitude !== null && (
          <>
            <p className="tabular text-muted">
              {formatCoordinates({ latitude: i.latitude, longitude: i.longitude })}
              {i.accuracyMeters !== null ? ` · ±${Math.round(i.accuracyMeters)} m` : ' · approximate (~1 km) until accepted'}
            </p>
            <a
              href={`geo:${i.latitude},${i.longitude}?q=${i.latitude},${i.longitude}(${encodeURIComponent(i.referenceCode)})`}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-line-strong px-4 font-semibold"
            >
              Open in maps app
            </a>
            {!offline && (
              <Suspense fallback={<Skeleton className="h-64" />}>
                <MapView
                  height={260}
                  markers={[
                    {
                      id: i.id,
                      latitude: i.latitude,
                      longitude: i.longitude,
                      label: i.referenceCode,
                      kind: 'incident',
                      color: cssVar('--critical'),
                    },
                  ]}
                />
              </Suspense>
            )}
          </>
        )}
      </Card>

      {/* Timeline */}
      <Card>
        <h2 className="mb-3 text-lg font-bold">Timeline</h2>
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {(i.updates ?? []).map((u) => (
            <li key={u.id}>
              <p className="text-sm text-muted">
                {dateTime(u.createdAt)} · {u.authorName ? `${u.authorName} (${ROLE_LABELS[u.authorRole ?? 'CIVILIAN']})` : 'System'}
              </p>
              {u.status && <IncidentStatusBadge status={u.status} />}
              {u.note && <p className="mt-1">{u.note}</p>}
            </li>
          ))}
        </ol>
        {(isStaff || mineAsVolunteer) && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="note">Add a note</Label>
            <TextArea id="note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Boat team dispatched, ETA 20 min" />
            <Button
              icon={MessageSquarePlus}
              disabled={offline || !note.trim()}
              loading={busy === 'note'}
              onClick={async () => {
                await run('note', () => addIncidentNote(i.id, note.trim()));
                setNote('');
              }}
            >
              Add note
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function StaffControls({
  incident: i,
  disabled,
  busy,
  onUpdate,
}: {
  incident: IncidentDTO;
  disabled: boolean;
  busy: string | null;
  onUpdate: (key: string, body: IncidentUpdateInput) => Promise<void>;
}) {
  const [responders, setResponders] = useState<{ id: string; name: string }[]>([]);
  const [volunteers, setVolunteers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    void fetchAssignable('RESPONDER').then(setResponders).catch(() => undefined);
    void fetchAssignable('VOLUNTEER').then(setVolunteers).catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
      <div>
        <Label htmlFor="sev">Severity</Label>
        <Select id="sev" value={i.severity} disabled={disabled || busy === 'severity'} onChange={(e) => void onUpdate('severity', { severity: e.target.value as Severity })}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="resp">Responder</Label>
        <Select
          id="resp"
          value={i.assignedResponder?.id ?? ''}
          disabled={disabled || busy === 'resp'}
          onChange={(e) => void onUpdate('resp', { assignedResponderId: e.target.value || null })}
        >
          <option value="">— Unassigned —</option>
          {responders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="vol">Volunteer</Label>
        <Select
          id="vol"
          value={i.assignedVolunteer?.id ?? ''}
          disabled={disabled || busy === 'vol'}
          onChange={(e) => void onUpdate('vol', { assignedVolunteerId: e.target.value || null })}
        >
          <option value="">— None —</option>
          {volunteers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
