import { SAFETY_STATES, SAFETY_STATE_LABELS, type SafetyState } from '@resqnet/shared';
import { Siren } from 'lucide-react';
import { useId, useState } from 'react';
import { SAFETY_ICON, SAFETY_TONE, SafetyBadge, SyncBadge } from '../components/badges';
import { Button, ButtonLink, Card, Label, Notice, PageHeader, TextInput, TONE } from '../components/ui';
import { useLatestSafetyStatus } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { errorMessage } from '../services/apiClient';
import { setSafetyStatus } from '../services/safetyService';
import { cn } from '../utils/cn';
import { dateTime } from '../utils/time';

const HINTS: Record<SafetyState, string> = {
  SAFE: 'I am not in danger',
  NEED_ASSISTANCE: 'I am okay for now but need support',
  EMERGENCY: 'I am in danger right now',
  UNKNOWN: 'Not sure / prefer not to say',
};

export default function SafetyStatusPage() {
  const current = useLatestSafetyStatus();
  const net = useNetwork();
  const noteId = useId();
  const [choice, setChoice] = useState<SafetyState | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await setSafetyStatus(choice, note || undefined);
      setMessage(
        net.state === 'offline'
          ? 'Safety status saved locally. It will synchronise when connectivity returns.'
          : 'Safety status saved. Sending it now.',
      );
      setChoice(null);
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader back="/" title="My safety status" subtitle="Let responders and your family know how you are." />

      {current && (
        <Card className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Current:</span>
          <SafetyBadge status={current.status} />
          <SyncBadge status={current.syncStatus} />
          <span className="text-sm text-muted">set {dateTime(current.createdAt)}</span>
        </Card>
      )}

      {message && <Notice tone={net.state === 'offline' ? 'warning' : 'safe'} role="status" title={message} />}

      <fieldset>
        <legend className="mb-2 text-lg font-bold">How are you?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SAFETY_STATES.map((s) => {
            const Icon = SAFETY_ICON[s];
            const selected = choice === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={selected}
                onClick={() => setChoice(s)}
                className={cn(
                  'flex min-h-20 items-center gap-3 rounded-2xl border-2 p-4 text-left',
                  selected ? cn(TONE[SAFETY_TONE[s]], 'border-[3px]') : 'border-line-strong bg-surface',
                )}
              >
                <Icon className="size-8 shrink-0" aria-hidden />
                <span>
                  <span className="block text-lg font-extrabold uppercase text-text">{SAFETY_STATE_LABELS[s]}</span>
                  <span className="block text-sm text-muted">{HINTS[s]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {choice && (
        <Card className="space-y-3">
          <div>
            <Label htmlFor={noteId} hint="Optional — e.g. 'At Gandhipuram shelter with family'">
              Add a short note
            </Label>
            <TextInput id={noteId} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <Notice tone="critical" title={error} />}
          <Button variant="primary" size="lg" block loading={saving} onClick={save}>
            Save status: {SAFETY_STATE_LABELS[choice]}
          </Button>
          {choice === 'EMERGENCY' && (
            <ButtonLink to="/sos" variant="emergency" size="lg" block icon={Siren}>
              Request emergency help now
            </ButtonLink>
          )}
        </Card>
      )}
    </div>
  );
}
