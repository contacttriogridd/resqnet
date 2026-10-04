import { CheckCircle2, CloudUpload, FlaskConical, RefreshCw, WifiLow, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useFailedCount, usePendingCount } from '../../hooks/useOfflineData';
import { useNetwork, useStore, useSyncState } from '../../hooks/useStore';
import { setSimulatedOffline } from '../../offline/network';
import { pwaStore, updateApp } from '../../offline/pwa';
import { cn } from '../../utils/cn';
import { clockTime } from '../../utils/time';

/**
 * Persistent, non-blocking status line under the header. It always tells the
 * user what works, what is waiting to send, and when data last synced.
 */
export function StatusBanner() {
  const net = useNetwork();
  const sync = useSyncState();
  const pending = usePendingCount();
  const failed = useFailedCount();
  const pwa = useStore(pwaStore);
  const [justSynced, setJustSynced] = useState(false);

  const lastResult = sync.lastResult;
  useEffect(() => {
    if (!lastResult || lastResult.applied + lastResult.duplicates === 0 || lastResult.remaining > 0) return;
    setJustSynced(true);
    const t = setTimeout(() => setJustSynced(false), 8000);
    return () => clearTimeout(t);
  }, [lastResult]);

  const pendingText = pending > 0 ? ` ${pending} item${pending === 1 ? '' : 's'} waiting to send.` : '';

  let content: React.ReactNode = null;
  let tone = '';

  if (net.simulated) {
    tone = 'bg-demo-bg text-text border-demo';
    content = (
      <>
        <FlaskConical className="size-5 shrink-0 text-demo" aria-hidden />
        <span className="flex-1">
          <strong>DEMO — simulated offline.</strong> Emergency tools remain available on this device.{pendingText}
        </span>
        <button
          className="min-h-10 rounded-lg border-2 border-demo px-3 text-sm font-bold text-demo"
          onClick={() => void setSimulatedOffline(false)}
        >
          Restore connection
        </button>
      </>
    );
  } else if (net.state === 'offline' && !net.checking) {
    tone = 'bg-critical-bg text-text border-critical-line';
    content = (
      <>
        <WifiOff className="size-5 shrink-0 text-critical" aria-hidden />
        <span className="flex-1">
          <strong>You are offline.</strong> Emergency tools remain available.{pendingText}
          {net.reason === 'server-unreachable' && ' (The RESQNET server cannot be reached.)'}
        </span>
      </>
    );
  } else if (net.state === 'limited') {
    tone = 'bg-warning-bg text-text border-warning-line';
    content = (
      <>
        <WifiLow className="size-5 shrink-0 text-warning" aria-hidden />
        <span className="flex-1">
          <strong>Connection unstable.</strong> Requests are saved on this device and sent when possible.{pendingText}
        </span>
      </>
    );
  } else if (pending > 0) {
    tone = 'bg-info-bg text-text border-info-line';
    content = (
      <>
        <CloudUpload className="size-5 shrink-0 text-info" aria-hidden />
        <span className="flex-1">
          <strong>Sending saved information…</strong>
          {pendingText}
        </span>
      </>
    );
  } else if (failed > 0) {
    tone = 'bg-critical-bg text-text border-critical-line';
    content = (
      <>
        <CloudUpload className="size-5 shrink-0 text-critical" aria-hidden />
        <span className="flex-1">
          <strong>{failed} item{failed === 1 ? ' was' : 's were'} not accepted by the server.</strong>{' '}
          <Link to="/reports" className="font-semibold underline">
            Review
          </Link>
        </span>
      </>
    );
  } else if (justSynced && sync.lastSyncAt) {
    tone = 'bg-safe-bg text-text border-safe-line';
    content = (
      <>
        <CheckCircle2 className="size-5 shrink-0 text-safe" aria-hidden />
        <span className="flex-1">
          <strong>All emergency data synchronised.</strong> Last sync: {clockTime(sync.lastSyncAt)}
        </span>
      </>
    );
  } else if (pwa.updateAvailable) {
    tone = 'bg-info-bg text-text border-info-line';
    content = (
      <>
        <RefreshCw className="size-5 shrink-0 text-info" aria-hidden />
        <span className="flex-1">A new version of RESQNET is ready.</span>
        <button className="min-h-10 rounded-lg border-2 border-info px-3 text-sm font-bold text-info" onClick={() => void updateApp()}>
          Update
        </button>
      </>
    );
  }

  return (
    <div aria-live="polite" role="status">
      {content && (
        <div className={cn('border-b-2', tone)}>
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 text-[0.95rem]">{content}</div>
        </div>
      )}
    </div>
  );
}
