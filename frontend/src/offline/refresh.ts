import { META, getMeta } from '../database/db';
import { downloadOfflinePack, pruneExpiredAlerts, refreshAlerts } from './datasets';
import { networkStore } from './network';

const PACK_MAX_AGE_MS = 10 * 60_000;

let running: Promise<void> | null = null;

/**
 * Keeps cached information fresh while online. The full regional pack is
 * re-downloaded at most every 10 minutes; alerts are refreshed more often.
 * Never throws — when offline the cached copy simply stays (clearly dated).
 */
export function refreshData(opts: { force?: boolean } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    await pruneExpiredAlerts();
    if (networkStore.get().state === 'offline') return;
    try {
      const last = await getMeta<string>(META.lastPackAt);
      const stale = !last || Date.now() - new Date(last).getTime() > PACK_MAX_AGE_MS;
      if (opts.force || stale) await downloadOfflinePack();
      else await refreshAlerts();
    } catch {
      /* Keep the cached copy; the UI shows its age. */
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
