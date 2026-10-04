import { useLiveQuery } from 'dexie-react-hooks';
import { Eye, EyeOff, Lock, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, Card, EmptyState, Label, Notice, PageHeader, Select, TextArea, TextInput } from '../components/ui';
import { db } from '../database/db';
import { useDataset } from '../hooks/useOfflineData';
import type { FamilyMember } from '../types/local';
import { telHref } from '../utils/cn';
import { uuid } from '../utils/id';

/**
 * Trusted family/group details. Stored ONLY in this device's IndexedDB and
 * never uploaded — medical details are sensitive personal data.
 */
const EMPTY = {
  name: '',
  relation: '',
  phone: '',
  medicalInfo: '',
  accessibilityNeeds: '',
  preferredShelterId: '',
  safetyNote: '',
};

function MemberForm({ initial, onDone }: { initial?: FamilyMember; onDone: () => void }) {
  const shelters = useDataset('shelters');
  const [v, setV] = useState(
    initial
      ? {
          name: initial.name,
          relation: initial.relation,
          phone: initial.phone ?? '',
          medicalInfo: initial.medicalInfo ?? '',
          accessibilityNeeds: initial.accessibilityNeeds ?? '',
          preferredShelterId: initial.preferredShelterId ?? '',
          safetyNote: initial.safetyNote ?? '',
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const save = async () => {
    if (v.name.trim().length < 1) return setError('Enter a name.');
    if (v.phone && !/^[0-9+()\-\s]{3,20}$/.test(v.phone)) return setError('Enter a valid phone number.');
    const shelter = shelters.data.find((s) => s.id === v.preferredShelterId);
    const now = new Date().toISOString();
    const member: FamilyMember = {
      id: initial?.id ?? uuid(),
      name: v.name.trim().slice(0, 80),
      relation: v.relation.trim().slice(0, 40),
      phone: v.phone.trim() || null,
      medicalInfo: v.medicalInfo.trim().slice(0, 500) || null,
      accessibilityNeeds: v.accessibilityNeeds.trim().slice(0, 300) || null,
      preferredShelterId: shelter?.id ?? null,
      preferredShelterName: shelter?.name ?? null,
      safetyNote: v.safetyNote.trim().slice(0, 200) || null,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    await db.family.put(member);
    onDone();
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold">{initial ? `Edit ${initial.name}` : 'Add a person'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-n`}>Name</Label>
          <TextInput id={`${id}-n`} value={v.name} onChange={set('name')} maxLength={80} autoComplete="off" />
        </div>
        <div>
          <Label htmlFor={`${id}-r`}>Relation</Label>
          <TextInput id={`${id}-r`} value={v.relation} onChange={set('relation')} placeholder="Mother, brother…" maxLength={40} />
        </div>
        <div>
          <Label htmlFor={`${id}-p`}>Emergency contact number</Label>
          <TextInput id={`${id}-p`} type="tel" inputMode="tel" value={v.phone} onChange={set('phone')} />
        </div>
        <div>
          <Label htmlFor={`${id}-s`}>Preferred shelter</Label>
          <Select id={`${id}-s`} value={v.preferredShelterId} onChange={set('preferredShelterId')}>
            <option value="">— None —</option>
            {shelters.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor={`${id}-m`} hint="Optional and voluntary — allergies, medicines, conditions.">
          Medical information
        </Label>
        <TextArea id={`${id}-m`} value={v.medicalInfo} onChange={set('medicalInfo')} rows={2} maxLength={500} />
      </div>
      <div>
        <Label htmlFor={`${id}-a`} hint="Optional — wheelchair, hearing, vision…">
          Accessibility needs
        </Label>
        <TextInput id={`${id}-a`} value={v.accessibilityNeeds} onChange={set('accessibilityNeeds')} maxLength={300} />
      </div>
      {error && <Notice tone="critical" title={error} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save}>
          Save on this device
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function MemberCard({ m, onEdit }: { m: FamilyMember; onEdit: () => void }) {
  const [showMedical, setShowMedical] = useState(false);
  return (
    <Card as="li" className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{m.name}</p>
          {m.relation && <p className="text-muted">{m.relation}</p>}
        </div>
        <Button variant="ghost" icon={Pencil} onClick={onEdit} aria-label={`Edit ${m.name}`}>
          Edit
        </Button>
        <Button
          variant="ghost"
          icon={Trash2}
          aria-label={`Delete ${m.name}`}
          onClick={async () => {
            if (window.confirm(`Remove ${m.name} from this device?`)) await db.family.delete(m.id);
          }}
        />
      </div>
      {m.phone && (
        <a
          href={telHref(m.phone)}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-info-line bg-info-bg px-4 font-bold text-info"
        >
          <Phone className="size-5" aria-hidden /> <span className="tabular">{m.phone}</span>
        </a>
      )}
      {m.preferredShelterName && <p>Preferred shelter: {m.preferredShelterName}</p>}
      {m.accessibilityNeeds && <p>Accessibility: {m.accessibilityNeeds}</p>}
      {m.medicalInfo && (
        <div>
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-2 font-semibold text-info"
            onClick={() => setShowMedical((s) => !s)}
            aria-expanded={showMedical}
          >
            {showMedical ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            {showMedical ? 'Hide' : 'Show'} medical information
          </button>
          {showMedical && <p className="rounded-xl bg-surface-2 p-3">{m.medicalInfo}</p>}
        </div>
      )}
    </Card>
  );
}

export default function FamilyPage() {
  const members = useLiveQuery(() => db.family.orderBy('name').toArray(), []);
  const [editing, setEditing] = useState<FamilyMember | 'new' | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader
        back="/"
        title="Family & group"
        subtitle="People you look out for in an emergency."
        actions={
          editing === null && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Add person
            </Button>
          )
        }
      />
      <Notice tone="info" icon={Lock}>
        Stored only on this device and never uploaded to RESQNET. Anyone with access to this phone can see it — use
        your phone's screen lock.
      </Notice>

      {editing && <MemberForm initial={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}

      {members && members.length === 0 && !editing && (
        <EmptyState icon={Users} title="No one added yet">
          Add family members so their numbers and needs are on your phone, even offline.
        </EmptyState>
      )}
      <ul className="space-y-3">
        {members?.map((m) => (
          <MemberCard key={m.id} m={m} onEdit={() => setEditing(m)} />
        ))}
      </ul>
    </div>
  );
}
