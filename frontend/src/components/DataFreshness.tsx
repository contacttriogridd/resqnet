import { CheckCircle2, Clock, HardDrive } from 'lucide-react';
import { STALE_AFTER_MS } from '../config';
import { useNow } from '../hooks/useOfflineData';
import { useNetwork } from '../hooks/useStore';
import { cn } from '../utils/cn';
import { smartTime, timeAgo } from '../utils/time';

/**
 * Honest data age indicator. Cached information is never presented as live:
 * offline (or old) data always shows when it was last synchronised.
 */
export function DataFreshness({
  syncedAt,
  source,
  what = 'Information',
  className,
}: {
  syncedAt: string | null;
  source: 'bundled' | 'server';
  what?: string;
  className?: string;
}) {
  const now = useNow();
  const net = useNetwork();
  const offline = net.state === 'offline';

  if (source === 'bundled' || !syncedAt) {
    return (
      <p className={cn('flex items-start gap-2 text-sm text-muted', className)}>
        <HardDrive className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Built into the app — works offline.{' '}
          {offline ? 'Connect to the internet to get the latest local information.' : 'Checking for updates…'}
        </span>
      </p>
    );
  }

  const age = now - new Date(syncedAt).getTime();
  const stale = age > STALE_AFTER_MS;
  const Icon = offline || stale ? Clock : CheckCircle2;
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm',
        offline || stale ? 'font-semibold text-warning' : 'text-muted',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {offline ? 'Offline information — ' : ''}
        {what} last synchronised {smartTime(syncedAt)} ({timeAgo(syncedAt, now)}).
        {offline && ' It may be out of date.'}
      </span>
    </p>
  );
}
