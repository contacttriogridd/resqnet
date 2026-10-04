import {
  INCIDENT_TYPE_LABELS,
  PEOPLE_COUNTS,
  PEOPLE_COUNT_LABELS,
  incidentLocationSchema,
  type IncidentType,
  type PeopleCount,
} from '@resqnet/shared';
import {
  Building2,
  CircleHelp,
  Flame,
  HeartPulse,
  LifeBuoy,
  Phone,
  Send,
  UserRound,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LocationField, type LocationValue } from '../components/LocationField';
import { Button, Card, Notice } from '../components/ui';
import { META } from '../database/db';
import { useMeta } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { submitIncident } from '../services/incidentService';
import type { MyEmergencyInfo } from '../types/local';
import { cn, telHref } from '../utils/cn';

const QUICK_TYPES: { type: IncidentType; icon: LucideIcon }[] = [
  { type: 'MEDICAL', icon: HeartPulse },
  { type: 'TRAPPED', icon: LifeBuoy },
  { type: 'FLOOD', icon: Waves },
  { type: 'FIRE', icon: Flame },
  { type: 'BUILDING_COLLAPSE', icon: Building2 },
  { type: 'OTHER', icon: CircleHelp },
];

const CALLS = [
  { label: 'All emergencies', phone: '112' },
  { label: 'Ambulance', phone: '108' },
  { label: 'Fire & Rescue', phone: '101' },
];

/**
 * SOS confirmation screen. Nothing is sent and nothing is dialled until the
 * person explicitly confirms. Calls use the phone network (may work when
 * mobile data does not).
 */
export function SosPage() {
  const navigate = useNavigate();
  const net = useNetwork();
  const myInfo = useMeta<MyEmergencyInfo>(META.myInfo);
  const [type, setType] = useState<IncidentType | null>(null);
  const [people, setPeople] = useState<PeopleCount>('ONE');
  const [location, setLocation] = useState<LocationValue>({ source: 'MANUAL' });
  const [sharePhone, setSharePhone] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const locationCheck = incidentLocationSchema.safeParse(location);
  const canSend = !!type && locationCheck.success && !sending;

  const send = async () => {
    if (!type) return;
    if (!locationCheck.success) {
      setError('Add your location so rescuers can find you.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const local = await submitIncident({
        type,
        severity: 'CRITICAL',
        peopleCount: people,
        specialRequirements: [],
        location,
        description: 'Sent with the SOS quick request.',
        contactPhone: sharePhone && myInfo?.phone ? myInfo.phone : undefined,
      });
      navigate(`/reports/${local.clientId}?new=1`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border-2 border-critical-line bg-critical-bg p-4 text-center">
        <h1 className="text-2xl font-extrabold tracking-wide text-critical uppercase sm:text-3xl">
          Request emergency assistance?
        </h1>
        <p className="mt-1 text-text">Choose what is happening, check your location, then confirm.</p>
      </header>

      {net.state === 'offline' && (
        <Notice tone="warning" title="You are offline — you can still send this.">
          Your request will be saved on this device and sent automatically when a connection returns. If life is in
          danger, also call 112.
        </Notice>
      )}

      <section aria-labelledby="what" className="space-y-2">
        <h2 id="what" className="font-semibold">
          1. What is happening?
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="what">
          {QUICK_TYPES.map(({ type: t, icon: Icon }) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn(
                'flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center font-bold',
                type === t ? 'border-critical bg-critical-bg text-critical' : 'border-line-strong bg-surface',
              )}
            >
              <Icon className="size-7" aria-hidden />
              {INCIDENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="people" className="space-y-2">
        <h2 id="people" className="font-semibold">
          2. How many people need help?
        </h2>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby="people">
          {PEOPLE_COUNTS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={people === p}
              onClick={() => setPeople(p)}
              className={cn(
                'tabular min-h-14 rounded-xl border-2 text-lg font-bold',
                people === p ? 'border-focus bg-info-bg text-info' : 'border-line-strong bg-surface',
              )}
            >
              {PEOPLE_COUNT_LABELS[p]}
            </button>
          ))}
        </div>
      </section>

      <Card>
        <h2 className="sr-only">3. Location</h2>
        <LocationField value={location} onChange={setLocation} autoLocate />
      </Card>

      <Card aria-labelledby="myinfo">
        <h2 id="myinfo" className="flex items-center gap-2 font-semibold">
          <UserRound className="size-5" aria-hidden /> Your emergency information
        </h2>
        {myInfo && (myInfo.name || myInfo.phone || myInfo.bloodGroup || myInfo.medicalNotes) ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.95rem]">
            {myInfo.name && (
              <>
                <dt className="text-muted">Name</dt>
                <dd>{myInfo.name}</dd>
              </>
            )}
            {myInfo.phone && (
              <>
                <dt className="text-muted">Phone</dt>
                <dd className="tabular">{myInfo.phone}</dd>
              </>
            )}
            {myInfo.bloodGroup && (
              <>
                <dt className="text-muted">Blood group</dt>
                <dd>{myInfo.bloodGroup}</dd>
              </>
            )}
            {myInfo.medicalNotes && (
              <>
                <dt className="text-muted">Medical</dt>
                <dd>{myInfo.medicalNotes}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="mt-1 text-muted">
            Not added yet. <Link to="/account" className="font-semibold text-info underline">Add your details</Link>{' '}
            so you are ready next time.
          </p>
        )}
        {myInfo?.phone && (
          <label className="mt-3 flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-[var(--focus)]"
              checked={sharePhone}
              onChange={(e) => setSharePhone(e.target.checked)}
            />
            <span>Share my phone number so responders can call me back</span>
          </label>
        )}
      </Card>

      {error && <Notice tone="critical" role="alert" title={error} />}

      <Button variant="emergency" size="xl" block icon={Send} disabled={!canSend} loading={sending} onClick={send}>
        Send emergency request
      </Button>
      {!type && <p className="-mt-3 text-center text-sm text-muted">Choose what is happening to enable sending.</p>}
      {type && !locationCheck.success && (
        <p className="-mt-3 text-center text-sm text-muted">Add your location or describe where you are.</p>
      )}

      <section aria-labelledby="call" className="space-y-2">
        <h2 id="call" className="font-semibold">
          Or call emergency services
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {CALLS.map((c) => (
            <a
              key={c.phone}
              href={telHref(c.phone)}
              className="flex min-h-16 flex-col items-center justify-center rounded-xl border-2 border-critical-line bg-surface text-center font-bold text-critical hover:bg-critical-bg"
              aria-label={`Call ${c.label}, ${c.phone}`}
            >
              <span className="flex items-center gap-1 text-xl">
                <Phone className="size-5" aria-hidden />
                {c.phone}
              </span>
              <span className="text-xs text-muted">{c.label}</span>
            </a>
          ))}
        </div>
        <p className="text-sm text-muted">
          Phone calls use the mobile network, not the internet. RESQNET cannot place calls or reach emergency services
          by itself.
        </p>
      </section>

      <p className="text-center">
        <Link to={type ? `/help?type=${type}` : '/help'} className="inline-flex min-h-12 items-center font-semibold text-info underline">
          Give more details with the full form
        </Link>
      </p>
    </div>
  );
}
