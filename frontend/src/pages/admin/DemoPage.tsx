import { CloudOff, FlaskConical, House, RefreshCw, RotateCcw, Siren, Waves, Wifi } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, Card, Label, Notice, PageHeader, TextInput } from '../../components/ui';
import { usePendingCount, useRegion } from '../../hooks/useOfflineData';
import { useNetwork } from '../../hooks/useStore';
import { setSimulatedOffline } from '../../offline/network';
import { refreshData } from '../../offline/refresh';
import { errorMessage } from '../../services/apiClient';
import { demo } from '../../services/staffService';
import { requestSync } from '../../sync/syncManager';

/**
 * SIMULATION MODE — for demonstrations and testing only. Everything it creates
 * on the server is flagged as demo data and labelled DEMO in the app. The
 * "simulate offline" switch affects only this browser.
 */
export default function DemoPage() {
  const net = useNetwork();
  const pending = usePendingCount();
  const currentRegion = useRegion();
  const id = useId();
  const [region, setRegion] = useState(currentRegion);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const step = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      const msg = await fn();
      setLog((l) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l].slice(0, 12));
    } catch (err) {
      setLog((l) => [`${new Date().toLocaleTimeString()} — ⚠ ${errorMessage(err)}`, ...l].slice(0, 12));
    } finally {
      setBusy(null);
    }
  };

  const serverDisabled = net.state === 'offline' || busy !== null;

  return (
    <div className="space-y-4">
      <PageHeader title="Simulation mode" subtitle="Demonstrate RESQNET's offline behaviour safely." />
      <div className="rounded-2xl border-2 border-demo bg-demo-bg p-4">
        <p className="flex items-center gap-2 text-xl font-extrabold tracking-wide text-demo uppercase">
          <FlaskConical className="size-6" aria-hidden /> Demo / simulation
        </p>
        <p className="mt-1">
          Generated alerts and requests are <strong>not real emergencies</strong>. They are flagged as demo data, shown
          with a DEMO label, excluded from analytics by default, and can be removed with “Reset demo data”. These
          controls are disabled on servers where demo mode is turned off.
        </p>
      </div>

      <Card className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}r`}>Region</Label>
          <TextInput id={`${id}r`} value={region} onChange={(e) => setRegion(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${id}c`}>Rescue requests to generate</Label>
          <TextInput id={`${id}c`} type="number" min={1} max={25} value={count} onChange={(e) => setCount(Math.min(25, Math.max(1, Number(e.target.value) || 1)))} />
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Simulation controls">
        <Button
          size="lg"
          icon={CloudOff}
          disabled={net.simulated || busy !== null}
          onClick={() => void step('off', async () => (await setSimulatedOffline(true), 'Device is now simulating OFFLINE.'))}
        >
          1 · Simulate offline
        </Button>
        <Button
          size="lg"
          icon={Waves}
          disabled={serverDisabled}
          loading={busy === 'alert'}
          onClick={() => void step('alert', async () => {
            const r = await demo.floodAlert(region);
            await refreshData({ force: true });
            return `Flood alert generated: “${r.alert.title}”.`;
          })}
        >
          Generate flood alert
        </Button>
        <Button
          size="lg"
          icon={Siren}
          disabled={serverDisabled}
          loading={busy === 'rescue'}
          onClick={() => void step('rescue', async () => `${(await demo.rescueRequests(region, count)).created} rescue requests generated (visible on the responder dashboard).`)}
        >
          Generate rescue requests
        </Button>
        <Button
          size="lg"
          icon={House}
          disabled={serverDisabled}
          loading={busy === 'cap'}
          onClick={() => void step('cap', async () => {
            const r = await demo.shelterCapacity(region);
            await refreshData({ force: true });
            return `Shelter capacity changed for ${r.updated} shelters.`;
          })}
        >
          Change shelter capacity
        </Button>
        <Button
          size="lg"
          icon={Wifi}
          disabled={!net.simulated || busy !== null}
          onClick={() => void step('on', async () => (await setSimulatedOffline(false), 'Connection restored.'))}
        >
          Restore connection
        </Button>
        <Button
          size="lg"
          variant="primary"
          icon={RefreshCw}
          disabled={serverDisabled}
          loading={busy === 'sync'}
          onClick={() => void step('sync', async () => {
            const r = await requestSync();
            await refreshData({ force: true });
            return r
              ? `Synchronised: ${r.applied} sent, ${r.duplicates} already on server, ${r.rejected} rejected, ${r.remaining} waiting.`
              : 'Nothing to synchronise right now.';
          })}
        >
          Synchronise data ({pending} waiting)
        </Button>
        <Button
          size="lg"
          variant="danger-outline"
          icon={RotateCcw}
          disabled={serverDisabled}
          loading={busy === 'reset'}
          onClick={() =>
            window.confirm('Remove all DEMO incidents and alerts from the server?') &&
            void step('reset', async () => {
              const r = await demo.reset();
              await refreshData({ force: true });
              return `Demo data removed: ${r.incidentsRemoved} incidents, ${r.alertsRemoved} alerts.`;
            })
          }
        >
          Reset demo data
        </Button>
      </section>

      <Card>
        <h2 className="mb-2 text-lg font-bold">Suggested demonstration</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Generate a flood alert — it appears on Home with a DEMO label.</li>
          <li>Simulate offline. The header shows OFFLINE and a banner explains what still works.</li>
          <li>Open Request help, submit a request — it is saved as “Waiting for connection”.</li>
          <li>Open Safety guides and Emergency contacts — they still work.</li>
          <li>Restore connection — the queued request is sent automatically and gets a reference code.</li>
          <li>Open the Responder dashboard — the request shows “queued offline” time.</li>
        </ol>
      </Card>

      {log.length > 0 && (
        <Notice tone="demo" icon={FlaskConical} title="Simulation log">
          <ul className="mt-1 space-y-0.5 text-sm">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}
