import { networkStore, startNetworkMonitor } from './offline/network';
import { refreshData } from './offline/refresh';
import { refreshMyReportStatuses } from './services/incidentService';
import { restoreSession } from './services/session';
import { onAfterSync, startSyncManager } from './sync/syncManager';

/**
 * Starts the offline machinery. Nothing here blocks first render: the UI
 * renders immediately from IndexedDB / bundled data.
 */
export async function bootstrap() {
  // Ask the browser not to evict our IndexedDB data under storage pressure.
  void navigator.storage?.persist?.().catch(() => undefined);

  await restoreSession();
  await startNetworkMonitor();

  onAfterSync(async () => {
    await refreshMyReportStatuses().catch(() => undefined);
    await refreshData();
  });
  await startSyncManager();

  // Periodic refresh of alerts / regional data while the app is open.
  setInterval(() => {
    if (networkStore.get().state !== 'offline') void refreshData();
  }, 5 * 60_000);
  void refreshData();
}
