import { CONTACT_SERVICE_LABELS, type EmergencyContactDTO } from '@resqnet/shared';
import { Phone } from 'lucide-react';
import { cn, telHref } from '../utils/cn';

/** One emergency number with a large, unmistakable call button. */
export function ContactRow({ contact, compact }: { contact: EmergencyContactDTO; compact?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{contact.name}</p>
        <p className="text-sm text-muted">
          {CONTACT_SERVICE_LABELS[contact.service]}
          {contact.region ? ` · ${contact.region}` : ''}
          {!compact && contact.description ? ` · ${contact.description}` : ''}
        </p>
      </div>
      <a
        href={telHref(contact.phone)}
        className={cn(
          'inline-flex min-h-14 shrink-0 items-center gap-2 rounded-xl border-2 border-critical-line bg-critical-bg px-4 font-bold text-critical',
          'hover:bg-brand hover:text-on-brand',
        )}
        aria-label={`Call ${contact.name}, ${contact.phone}`}
      >
        <Phone className="size-5" aria-hidden />
        <span className="tabular text-lg">{contact.phone}</span>
      </a>
    </li>
  );
}
