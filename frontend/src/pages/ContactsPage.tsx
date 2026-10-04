import { Info } from 'lucide-react';
import { ContactRow } from '../components/ContactRow';
import { DataFreshness } from '../components/DataFreshness';
import { Notice, PageHeader } from '../components/ui';
import { useDataset, useRegion } from '../hooks/useOfflineData';

/**
 * Emergency numbers are read from the device only — never from a network
 * request — so this screen always opens, even on first launch offline.
 */
export default function ContactsPage() {
  const contacts = useDataset('contacts');
  const region = useRegion();
  const sorted = [...contacts.data].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const national = sorted.filter((c) => !c.region);
  const local = sorted.filter((c) => c.region);

  return (
    <div className="space-y-5">
      <PageHeader back="/" title="Emergency contacts" subtitle="Tap a number to call." />
      <Notice tone="info" icon={Info}>
        Calls use the mobile phone network, not the internet — they may work even when RESQNET is offline.
      </Notice>

      <section aria-labelledby="national" className="space-y-2">
        <h2 id="national" className="text-lg font-bold">
          National emergency numbers
        </h2>
        <ul className="space-y-2">
          {national.map((c) => (
            <ContactRow key={c.id} contact={c} />
          ))}
        </ul>
      </section>

      {local.length > 0 && (
        <section aria-labelledby="local" className="space-y-2">
          <h2 id="local" className="text-lg font-bold">
            Local contacts · {region}
          </h2>
          <ul className="space-y-2">
            {local.map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
          </ul>
        </section>
      )}

      <DataFreshness syncedAt={contacts.syncedAt} source={contacts.source} what="Contacts" />
    </div>
  );
}
