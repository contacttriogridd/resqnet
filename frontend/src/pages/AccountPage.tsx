import { ROLE_LABELS, formatCoordinates } from '@resqnet/shared';
import { Bookmark, Crosshair, LogIn, LogOut, Save, UserPlus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, ButtonLink, Card, Label, Notice, PageHeader, TextArea, TextInput } from '../components/ui';
import { META, setMeta } from '../database/db';
import { GEO_MESSAGES, useGeolocation } from '../hooks/useGeolocation';
import { useMeta, useSavedLocation } from '../hooks/useOfflineData';
import { useSession } from '../hooks/useStore';
import { logout } from '../services/authService';
import type { MyEmergencyInfo, SavedLocation } from '../types/local';

function EmergencyInfoCard() {
  const info = useMeta<MyEmergencyInfo>(META.myInfo);
  const id = useId();
  const [v, setV] = useState<MyEmergencyInfo>({ sharePhoneWithRequests: true });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (info) setV(info);
  }, [info]);

  const save = async () => {
    if (v.phone && !/^[0-9+()\-\s]{3,20}$/.test(v.phone)) return setError('Enter a valid phone number.');
    setError(null);
    await setMeta(META.myInfo, {
      name: v.name?.trim().slice(0, 80) || undefined,
      phone: v.phone?.trim() || undefined,
      bloodGroup: v.bloodGroup?.trim().slice(0, 10) || undefined,
      medicalNotes: v.medicalNotes?.trim().slice(0, 500) || undefined,
      sharePhoneWithRequests: v.sharePhoneWithRequests,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">My emergency information</h2>
      <p className="text-muted">Shown on the SOS screen. Stored only on this device.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-n`}>Name</Label>
          <TextInput id={`${id}-n`} value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor={`${id}-p`}>Phone number</Label>
          <TextInput
            id={`${id}-p`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={v.phone ?? ''}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-b`}>Blood group</Label>
          <TextInput id={`${id}-b`} value={v.bloodGroup ?? ''} onChange={(e) => setV({ ...v, bloodGroup: e.target.value })} placeholder="e.g. O+" />
        </div>
      </div>
      <div>
        <Label htmlFor={`${id}-m`} hint="Optional — allergies, conditions, medicines.">
          Medical notes
        </Label>
        <TextArea id={`${id}-m`} rows={2} value={v.medicalNotes ?? ''} onChange={(e) => setV({ ...v, medicalNotes: e.target.value })} />
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-[var(--focus)]"
          checked={v.sharePhoneWithRequests}
          onChange={(e) => setV({ ...v, sharePhoneWithRequests: e.target.checked })}
        />
        Add my phone number to help requests by default
      </label>
      {error && <Notice tone="critical" title={error} />}
      <Button variant="primary" icon={Save} onClick={save}>
        {saved ? 'Saved' : 'Save on this device'}
      </Button>
    </Card>
  );
}

function SavedLocationCard() {
  const saved = useSavedLocation();
  const geo = useGeolocation();
  const id = useId();
  const [label, setLabel] = useState('Home');
  const [text, setText] = useState('');

  const saveGps = async () => {
    const pos = await geo.locate();
    if (!pos) return;
    const loc: SavedLocation = {
      latitude: pos.latitude,
      longitude: pos.longitude,
      text: text || undefined,
      label: label || 'Saved place',
      savedAt: new Date().toISOString(),
    };
    await setMeta(META.savedLocation, loc);
  };
  const saveText = async () => {
    if (text.trim().length < 3) return;
    await setMeta(META.savedLocation, { text: text.trim(), label: label || 'Saved place', savedAt: new Date().toISOString() });
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">Saved location</h2>
      <p className="text-muted">Used when GPS is unavailable, and to sort shelters by distance.</p>
      {saved && (
        <Notice tone="safe" icon={Bookmark} title={`${saved.label}`}>
          {saved.latitude !== undefined && saved.longitude !== undefined
            ? formatCoordinates({ latitude: saved.latitude, longitude: saved.longitude }, 4)
            : ''}{' '}
          {saved.text}
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-l`}>Name</Label>
          <TextInput id={`${id}-l`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
        </div>
        <div>
          <Label htmlFor={`${id}-t`}>Description / address</Label>
          <TextInput id={`${id}-t`} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={Crosshair} loading={geo.status === 'locating'} onClick={saveGps}>
          Save my current GPS location
        </Button>
        <Button icon={Save} onClick={saveText} disabled={text.trim().length < 3}>
          Save address only
        </Button>
      </div>
      {(geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'timeout' || geo.status === 'unsupported') && (
        <Notice tone="warning">{GEO_MESSAGES[geo.status]}</Notice>
      )}
    </Card>
  );
}

export default function AccountPage() {
  const { user } = useSession();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <PageHeader back="/more" title={user ? user.name : 'Your details'} subtitle={user ? `${user.email} · ${ROLE_LABELS[user.role]}` : undefined} />

      {user ? (
        <Button
          icon={LogOut}
          onClick={async () => {
            await logout();
            navigate('/');
          }}
        >
          Sign out
        </Button>
      ) : (
        <Card className="space-y-3">
          <p>
            <strong>You do not need an account to request help.</strong> Accounts are for volunteers, responders and
            people who want their reports linked to them.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/login" variant="primary" icon={LogIn}>
              Sign in
            </ButtonLink>
            <ButtonLink to="/register" icon={UserPlus}>
              Create account
            </ButtonLink>
          </div>
        </Card>
      )}

      <EmergencyInfoCard />
      <SavedLocationCard />
    </div>
  );
}
