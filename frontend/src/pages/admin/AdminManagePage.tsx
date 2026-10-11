import {
  ALERT_SEVERITIES,
  ALERT_SEVERITY_LABELS,
  CONTACT_SERVICES,
  CONTACT_SERVICE_LABELS,
  FACILITIES,
  FACILITY_LABELS,
  ROLES,
  ROLE_LABELS,
  type AlertSeverity,
  type ContactService,
  type Facility,
  type Role,
} from '@resqnet/shared';
import { Ban, Plus, Search, Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { AlertSeverityBadge, DemoBadge, ShelterStatusBadge } from '../../components/badges';
import { ContactRow } from '../../components/ContactRow';
import { Badge, Button, Card, ErrorState, Label, Notice, PageHeader, Select, SkeletonList, TextArea, TextInput } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useDataset } from '../../hooks/useOfflineData';
import { useSession } from '../../hooks/useStore';
import { BUNDLED_DISASTER_TYPES } from '../../offline/datasets';
import { errorMessage } from '../../services/apiClient';
import * as staff from '../../services/staffService';
import { cn } from '../../utils/cn';
import { dateTime, timeUntil } from '../../utils/time';

type Tab = 'users' | 'alerts' | 'shelters' | 'contacts' | 'audit';
const TABS: [Tab, string][] = [
  ['users', 'Users'],
  ['alerts', 'Alerts'],
  ['shelters', 'Shelters'],
  ['contacts', 'Contacts'],
  ['audit', 'Audit log'],
];

/** Runs an action and reports a friendly result. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: success });
      return true;
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const view = msg && <Notice tone={msg.ok ? 'safe' : 'critical'} role="status" title={msg.text} />;
  return { busy, run, view };
}

function Field({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/* ───────── Users ───────── */

function UsersTab() {
  const { user: me } = useSession();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const users = useAsync(() => staff.fetchUsers(search || undefined), [search]);
  const act = useAction();
  const id = useId();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RESPONDER' as Role });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (await act.run(() => staff.createUser(form), `Account created for ${form.email}.`)) {
      setForm({ name: '', email: '', password: '', role: 'RESPONDER' });
      void users.reload();
    }
  };

  return (
    <div className="space-y-4">
      {act.view}
      <Card>
        <form onSubmit={create} className="space-y-3">
          <h2 className="text-lg font-bold">Create an account</h2>
          <p className="text-muted">Use this for responders and administrators (they cannot self-register).</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" id={`${id}n`}>
              <TextInput id={`${id}n`} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email" id={`${id}e`}>
              <TextInput id={`${id}e`} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Temporary password (min 10)" id={`${id}p`}>
              <TextInput id={`${id}p`} type="password" minLength={10} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Role" id={`${id}r`}>
              <Select id={`${id}r`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary" icon={Plus} loading={act.busy}>
            Create account
          </Button>
        </form>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <TextInput aria-label="Search users" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" icon={Search}>
          Search
        </Button>
      </form>

      {users.error && <ErrorState message={users.error} onRetry={() => void users.reload()} />}
      {users.loading && !users.data ? (
        <SkeletonList />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {users.data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {u.name} {!u.isActive && <Badge tone="neutral">Disabled</Badge>}
                </p>
                <p className="truncate text-sm text-muted">{u.email}</p>
              </div>
              <Select
                aria-label={`Role for ${u.name}`}
                className="w-auto"
                value={u.role}
                disabled={u.id === me?.id || act.busy}
                onChange={(e) => void act.run(() => staff.updateUser(u.id, { role: e.target.value as Role }).then(users.reload), `${u.name} is now ${ROLE_LABELS[e.target.value as Role]}.`)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              <Button
                variant={u.isActive ? 'danger-outline' : 'secondary'}
                disabled={u.id === me?.id || act.busy}
                onClick={() => void act.run(() => staff.updateUser(u.id, { isActive: !u.isActive }).then(users.reload), u.isActive ? `${u.name} disabled.` : `${u.name} enabled.`)}
              >
                {u.isActive ? 'Disable' : 'Enable'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── Alerts ───────── */

function AlertsTab() {
  const alerts = useAsync(() => staff.fetchAllAlerts(), []);
  const types = useDataset('disasterTypes');
  const act = useAction();
  const id = useId();
  const blank = { title: '', disasterTypeCode: 'FLOOD', severity: 'WARNING' as AlertSeverity, region: 'Coimbatore', message: '', instruction: '', hours: 12 };
  const [f, setF] = useState(blank);
  const typeList = types.data.length ? types.data : BUNDLED_DISASTER_TYPES;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await act.run(
      () =>
        staff.createAlert({
          title: f.title,
          disasterTypeCode: f.disasterTypeCode,
          severity: f.severity,
          region: f.region,
          message: f.message,
          instruction: f.instruction,
          expiresAt: new Date(Date.now() + f.hours * 3600_000).toISOString(),
        }),
      'Alert published.',
    );
    if (ok) {
      setF(blank);
      void alerts.reload();
    }
  };

  const now = Date.now();
  return (
    <div className="space-y-4">
      {act.view}
      <Card>
        <form onSubmit={create} className="space-y-3">
          <h2 className="text-lg font-bold">Publish an alert</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" id={`${id}t`}>
              <TextInput id={`${id}t`} required minLength={3} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="Region (or 'All regions')" id={`${id}r`}>
              <TextInput id={`${id}r`} required value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
            </Field>
            <Field label="Disaster type" id={`${id}d`}>
              <Select id={`${id}d`} value={f.disasterTypeCode} onChange={(e) => setF({ ...f, disasterTypeCode: e.target.value })}>
                {typeList.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Severity" id={`${id}s`}>
              <Select id={`${id}s`} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as AlertSeverity })}>
                {ALERT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {ALERT_SEVERITY_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expires after (hours)" id={`${id}h`}>
              <TextInput id={`${id}h`} type="number" min={1} max={720} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) || 1 })} />
            </Field>
          </div>
          <Field label="Message — what is happening" id={`${id}m`}>
            <TextArea id={`${id}m`} required minLength={5} maxLength={1000} rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          </Field>
          <Field label="Instruction — what people should do" id={`${id}i`}>
            <TextArea id={`${id}i`} required minLength={5} maxLength={1000} rows={2} value={f.instruction} onChange={(e) => setF({ ...f, instruction: e.target.value })} />
          </Field>
          <Button type="submit" variant="primary" icon={Plus} loading={act.busy}>
            Publish alert
          </Button>
        </form>
      </Card>

      {alerts.error && <ErrorState message={alerts.error} onRetry={() => void alerts.reload()} />}
      <ul className="space-y-2">
        {alerts.data?.map((a) => {
          const live = a.isActive && new Date(a.expiresAt).getTime() > now;
          return (
            <li key={a.id} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3', !live && 'opacity-60')}>
              <AlertSeverityBadge severity={a.severity} />
              {a.isDemo && <DemoBadge />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted">
                  {a.region} · {live ? `expires ${timeUntil(a.expiresAt)}` : a.isActive ? 'expired' : 'deactivated'}
                </p>
              </div>
              {live && (
                <Button variant="danger-outline" icon={Ban} disabled={act.busy} onClick={() => void act.run(() => staff.deactivateAlert(a.id).then(alerts.reload), 'Alert deactivated.')}>
                  Deactivate
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────── Shelters ───────── */

function SheltersTab() {
  const shelters = useAsync(() => staff.fetchShelters(), []);
  const act = useAction();
  const id = useId();
  const blank = { name: '', address: '', region: 'Coimbatore', latitude: '', longitude: '', capacity: '100', contactPhone: '', facilities: [] as Facility[] };
  const [f, setF] = useState(blank);
  const [occ, setOcc] = useState<Record<string, string>>({});

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await act.run(
      () =>
        staff.createShelter({
          name: f.name,
          address: f.address,
          region: f.region,
          latitude: Number(f.latitude),
          longitude: Number(f.longitude),
          capacity: Number(f.capacity),
          occupancy: 0,
          facilities: f.facilities,
          contactPhone: f.contactPhone || undefined,
        }),
      'Shelter added.',
    );
    if (ok) {
      setF(blank);
      void shelters.reload();
    }
  };

  return (
    <div className="space-y-4">
      {act.view}
      <ul className="space-y-2">
        {shelters.data?.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.name}</p>
              <p className="text-sm text-muted">
                {s.region} · {s.occupancy}/{s.capacity} occupied
              </p>
            </div>
            <ShelterStatusBadge status={s.status} />
            <label className="flex items-center gap-2">
              <span className="text-sm">Occupancy</span>
              <TextInput
                className="w-24"
                type="number"
                min={0}
                value={occ[s.id] ?? String(s.occupancy)}
                onChange={(e) => setOcc({ ...occ, [s.id]: e.target.value })}
              />
            </label>
            <Button
              disabled={act.busy || occ[s.id] === undefined}
              onClick={() => void act.run(() => staff.updateShelter(s.id, { occupancy: Number(occ[s.id]) }).then(shelters.reload), `${s.name} updated.`)}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              icon={Trash2}
              aria-label={`Remove ${s.name}`}
              disabled={act.busy}
              onClick={() => window.confirm(`Remove ${s.name}?`) && void act.run(() => staff.removeShelter(s.id).then(shelters.reload), 'Shelter removed.')}
            />
          </li>
        ))}
      </ul>

      <Card>
        <form onSubmit={create} className="space-y-3">
          <h2 className="text-lg font-bold">Add a shelter</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" id={`${id}n`}>
              <TextInput id={`${id}n`} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Region" id={`${id}r`}>
              <TextInput id={`${id}r`} required value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
            </Field>
            <Field label="Address" id={`${id}a`}>
              <TextInput id={`${id}a`} required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </Field>
            <Field label="Contact phone" id={`${id}p`}>
              <TextInput id={`${id}p`} type="tel" value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} />
            </Field>
            <Field label="Latitude" id={`${id}la`}>
              <TextInput id={`${id}la`} required inputMode="decimal" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} />
            </Field>
            <Field label="Longitude" id={`${id}lo`}>
              <TextInput id={`${id}lo`} required inputMode="decimal" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} />
            </Field>
            <Field label="Capacity" id={`${id}c`}>
              <TextInput id={`${id}c`} type="number" min={1} required value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 font-semibold">Facilities</legend>
            <div className="flex flex-wrap gap-x-4">
              {FACILITIES.map((fac) => (
                <label key={fac} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--focus)]"
                    checked={f.facilities.includes(fac)}
                    onChange={(e) =>
                      setF({ ...f, facilities: e.target.checked ? [...f.facilities, fac] : f.facilities.filter((x) => x !== fac) })
                    }
                  />
                  {FACILITY_LABELS[fac]}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" variant="primary" icon={Plus} loading={act.busy}>
            Add shelter
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ───────── Contacts ───────── */

function ContactsTab() {
  const contacts = useAsync(() => staff.fetchContacts(), []);
  const act = useAction();
  const id = useId();
  const blank = { name: '', service: 'CONTROL_ROOM' as ContactService, phone: '', region: '', description: '' };
  const [f, setF] = useState(blank);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await act.run(
      () => staff.createContact({ ...f, region: f.region || undefined, description: f.description || undefined }),
      'Contact added. Devices receive it on their next sync.',
    );
    if (ok) {
      setF(blank);
      void contacts.reload();
    }
  };

  return (
    <div className="space-y-4">
      {act.view}
      <Card>
        <form onSubmit={create} className="space-y-3">
          <h2 className="text-lg font-bold">Add an emergency contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" id={`${id}n`}>
              <TextInput id={`${id}n`} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Phone" id={`${id}p`}>
              <TextInput id={`${id}p`} type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="Service" id={`${id}s`}>
              <Select id={`${id}s`} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value as ContactService })}>
                {CONTACT_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {CONTACT_SERVICE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Region (empty = national)" id={`${id}r`}>
              <TextInput id={`${id}r`} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" variant="primary" icon={Plus} loading={act.busy}>
            Add contact
          </Button>
        </form>
      </Card>
      <ul className="space-y-2">
        {contacts.data?.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="flex-1">
              <ContactRow contact={c} compact />
            </div>
            <Button
              variant="ghost"
              icon={Trash2}
              aria-label={`Remove ${c.name}`}
              disabled={act.busy}
              onClick={() => window.confirm(`Remove ${c.name}?`) && void act.run(() => staff.removeContact(c.id).then(contacts.reload), 'Contact removed.')}
            />
          </div>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Audit ───────── */

function AuditTab() {
  const logs = useAsync(() => staff.fetchAuditLogs(), []);
  if (logs.error) return <ErrorState message={logs.error} onRetry={() => void logs.reload()} />;
  if (!logs.data) return <SkeletonList />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="p-2.5">When</th>
            <th className="p-2.5">Who</th>
            <th className="p-2.5">Action</th>
            <th className="p-2.5">Item</th>
          </tr>
        </thead>
        <tbody>
          {logs.data.map((l) => (
            <tr key={l.id} className="border-b border-line/60">
              <td className="p-2.5 whitespace-nowrap">{dateTime(l.createdAt)}</td>
              <td className="p-2.5">{l.actorName ?? 'System / anonymous'}</td>
              <td className="p-2.5 font-semibold">{l.action.replaceAll('_', ' ').toLowerCase()}</td>
              <td className="p-2.5 text-muted">
                {l.entityType}
                {l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminManagePage() {
  const [tab, setTab] = useState<Tab>('users');
  return (
    <div className="space-y-4">
      <PageHeader title="Manage data" subtitle="Users, alerts, shelters, contacts and the audit trail." />
      <div className="flex flex-wrap gap-1 rounded-xl border-2 border-line-strong p-1" role="tablist">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn('min-h-10 rounded-lg px-3 font-semibold', tab === k ? 'bg-info text-white' : 'hover:bg-surface-2')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'shelters' && <SheltersTab />}
      {tab === 'contacts' && <ContactsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
