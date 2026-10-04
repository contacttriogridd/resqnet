import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Download,
  HardDrive,
  Phone,
  RefreshCw,
  Trash2,
  Wifi,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button, Card, Label, Notice, PageHeader, TextInput } from '../components/ui';
import { META, db } from '../database/db';
import { useActiveAlerts, useDataset, useMeta, usePendingCount, useRegion } from '../hooks/useOfflineData';
import { useNetwork, useSession, useSyncState } from '../hooks/useStore';
import { downloadOfflinePack } from '../offline/datasets';
import { refreshData } from '../offline/refresh';
import { errorMessage } from '../services/apiClient';
import { requestSync } from '../sync/syncManager';
import { cn } from '../utils/cn';
import { dateTime, timeAgo } from '../utils/time';

function Row({ ok, icon: Icon, label, detail }: { ok: boolean; icon?: LucideIcon; label: string; detail: string }) {
  const I = Icon ?? (ok ? CheckCircle2 : CircleAlert);
  return (
    <li className="flex items-start gap-3 py-3">
      <I className={cn('mt-0.5 size-6 shrink-0', ok ? 'text-safe' : 'text-warning')} aria-hidden />
      <div>
        <p className="font-semibold">
          {label}
          <span className="sr-only">{ok ? ' — available offline' : ' — not yet downloaded'}</span>
        </p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </li>
  );
}

const fmt = (iso: string | null) => (iso ? `${dateTime(iso)} (${timeAgo(iso)})` : 'never');

export default function OfflineDataPage() {
  const net = useNetwork();
  const sync = useSyncState();
  const { user } = useSession();
  const region = useRegion();
  const contacts = useDataset('contacts');
  const guides = useDataset('guides');
  const shelters = useDataset('shelters');
  const alerts = useActiveAlerts();
  const pending = usePendingCount();
  const lastPackAt = useMeta<string>(META.lastPackAt) ?? null;
  const reports = useLiveQuery(() => db.incidents.count(), []) ?? 0;
  const family = useLiveQuery(() => db.family.count(), []) ?? 0;
  const regionId = useId();
  const [regionInput, setRegionInput] = useState(region);
  const [busy, setBusy] = useState<'sync' | 'download' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'safe' | 'warning'; text: string } | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => setRegionInput(region), [region]);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, [sync.lastSyncAt, lastPackAt]);

  const offline = net.state === 'offline';
  const lastSync = [sync.lastSyncAt, lastPackAt].filter(Boolean).sort().at(-1) ?? null;

  const syncNow = async () => {
    setBusy('sync');
    setMsg(null);
    try {
      const r = await requestSync();
      await refreshData({ force: true });
      setMsg(
        r?.networkError
          ? { tone: 'warning', text: "Couldn't reach the server. Everything stays saved and will be retried." }
          : { tone: 'safe', text: 'All emergency data synchronised.' },
      );
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    const r = regionInput.trim();
    if (r.length < 2) return setMsg({ tone: 'warning', text: 'Enter a city or district name.' });
    setBusy('download');
    setMsg(null);
    try {
      const pack = await downloadOfflinePack(r);
      setMsg({
        tone: 'safe',
        text: `Downloaded for ${r}: ${pack.shelters.length} shelters, ${pack.contacts.length} contacts, ${pack.alerts.length} active alerts, ${pack.guides.length} guides.`,
      });
    } catch (err) {
      setMsg({ tone: 'warning', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const wipe = async () => {
    if (!window.confirm('Delete ALL RESQNET data on this device, including unsent reports and family details?')) return;
    await db.delete();
    window.location.href = '/';
  };

  return (
    <div className="space-y-4">
      <PageHeader back="/" title="Offline data center" subtitle="What is stored on this device for use without internet." />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {offline ? (
            <CloudOff className="size-7 text-critical" aria-hidden />
          ) : (
            <Wifi className="size-7 text-safe" aria-hidden />
          )}
          <div className="flex-1">
            <p className="text-lg font-bold">
              {offline ? 'Offline — using saved information' : net.state === 'limited' ? 'Connection unstable' : 'Online'}
            </p>
            <p className="text-muted">Last synchronised: {fmt(lastSync)}</p>
          </div>
          <Button variant="primary" icon={RefreshCw} loading={busy === 'sync'} disabled={offline || busy !== null} onClick={syncNow}>
            Sync now
          </Button>
        </div>
        {msg && <Notice tone={msg.tone} className="mt-3" role="status" title={msg.text} />}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Offline information</h2>
        <ul className="divide-y divide-line">
          <Row
            ok
            label="Emergency contacts"
            detail={`${contacts.data.length} numbers · ${contacts.source === 'bundled' ? 'built into the app' : `synced ${fmt(contacts.syncedAt)}`}`}
          />
          <Row
            ok
            label="Safety guides"
            detail={`${guides.data.length} guides · ${guides.source === 'bundled' ? 'built into the app' : `synced ${fmt(guides.syncedAt)}`}`}
          />
          <Row
            ok={shelters.source === 'server'}
            label={`Shelters · ${region}`}
            detail={shelters.source === 'server' ? `${shelters.data.length} shelters · synced ${fmt(shelters.syncedAt)}` : 'Not downloaded yet'}
          />
          <Row
            ok={alerts.source === 'server'}
            label="Emergency alerts"
            detail={alerts.source === 'server' ? `${alerts.data.length} active · synced ${fmt(alerts.syncedAt)}` : 'Not downloaded yet'}
          />
          <Row
            ok={!!user}
            label="User profile"
            detail={user ? `${user.name} (${user.email}) — cached so the app knows you offline` : 'Not signed in (not required to ask for help)'}
          />
          <Row
            ok={pending === 0}
            icon={pending === 0 ? CheckCircle2 : CloudOff}
            label="Pending reports"
            detail={pending === 0 ? `Nothing waiting · ${reports} report(s) on this device` : `${pending} item(s) waiting to send`}
          />
          <Row ok icon={HardDrive} label="Family & group" detail={`${family} people · stored only on this device`} />
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Download emergency information for an area</h2>
        <p className="text-muted">Do this before a disaster, while you have internet. It saves shelters, local contacts and alerts.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Label htmlFor={regionId}>City or district</Label>
            <TextInput id={regionId} value={regionInput} onChange={(e) => setRegionInput(e.target.value)} maxLength={120} />
          </div>
          <Button variant="primary" icon={Download} loading={busy === 'download'} disabled={offline || busy !== null} onClick={download}>
            Download for {regionInput.trim() || '…'}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-bold">What works without internet</h2>
        <ul className="space-y-1.5">
          {[
            'Request help and report emergencies — saved here and sent automatically later',
            'Safety guides and emergency phone numbers',
            'Downloaded shelters, alerts and your reports (with their last-sync time)',
            'Your safety status and family details',
            'GPS location (it uses satellites, not the internet)',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-safe" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 mb-2 font-bold">What needs a connection</h3>
        <ul className="space-y-1.5">
          {[
            'Delivering your request to responders (RESQNET cannot transmit without some network)',
            'Receiving new alerts and live shelter availability',
            'Map tiles for areas you have not viewed before',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <XCircle className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden /> {t}
            </li>
          ))}
          <li className="flex gap-2">
            <Phone className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
            Phone calls and SMS use the mobile network and may work even when internet does not.
          </li>
        </ul>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Storage</h2>
        {storage && (
          <p className="text-muted">
            Using {(storage.usage / 1_048_576).toFixed(1)} MB of storage on this device.
          </p>
        )}
        <p className="text-muted">
          {persisted
            ? 'The browser has agreed to keep this data even when storage is low.'
            : 'Tip: install RESQNET to your home screen so the browser is less likely to clear this data.'}
        </p>
        <Button variant="danger-outline" icon={Trash2} onClick={wipe}>
          Delete all data on this device
        </Button>
      </Card>
    </div>
  );
}
