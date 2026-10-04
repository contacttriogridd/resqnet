import type { OfflinePackDTO } from '@resqnet/shared';
import { listActiveAlerts } from './alertService.js';
import { listContacts } from './contactService.js';
import { listDisasterTypes, listGuides } from './guideService.js';
import { listShelters } from './shelterService.js';

/**
 * One request that gives a device everything it needs to keep working
 * offline for a region: contacts, shelters, alerts, guides and reference data.
 * The device stores it in IndexedDB together with `generatedAt`, which the UI
 * shows as "last synchronised".
 */
export async function buildOfflinePack(region?: string): Promise<OfflinePackDTO> {
  const [contacts, shelters, alerts, guides, disasterTypes] = await Promise.all([
    listContacts(region),
    listShelters(region),
    listActiveAlerts(region),
    listGuides(),
    listDisasterTypes(),
  ]);
  return {
    region: region ?? null,
    generatedAt: new Date().toISOString(),
    contacts,
    shelters,
    alerts,
    guides,
    disasterTypes,
  };
}
