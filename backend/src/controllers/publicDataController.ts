import type { Request, Response } from 'express';
import * as alertService from '../services/alertService.js';
import * as contactService from '../services/contactService.js';
import * as guideService from '../services/guideService.js';
import * as offlinePackService from '../services/offlinePackService.js';
import * as shelterService from '../services/shelterService.js';
import { idParam } from '../utils/request.js';

/**
 * Read-only public endpoints. Responses use `Cache-Control: no-cache` + ETag
 * so the service worker revalidates cheaply (304) when online and can fall
 * back to its cached copy when offline.
 */
const region = (req: Request) => (req.validated.query as { region?: string } | undefined)?.region || undefined;

function revalidate(res: Response) {
  res.set('Cache-Control', 'no-cache');
}

export async function activeAlerts(req: Request, res: Response) {
  revalidate(res);
  res.json({ alerts: await alertService.listActiveAlerts(region(req)), serverTime: new Date().toISOString() });
}

export async function getAlert(req: Request, res: Response) {
  revalidate(res);
  res.json({ alert: await alertService.getAlert(idParam(req)) });
}

export async function shelters(req: Request, res: Response) {
  revalidate(res);
  res.json({ shelters: await shelterService.listShelters(region(req)), serverTime: new Date().toISOString() });
}

export async function shelterRegions(_req: Request, res: Response) {
  revalidate(res);
  res.json({ regions: await shelterService.listRegions() });
}

export async function getShelter(req: Request, res: Response) {
  revalidate(res);
  res.json({ shelter: await shelterService.getShelter(idParam(req)) });
}

export async function contacts(req: Request, res: Response) {
  revalidate(res);
  res.json({ contacts: await contactService.listContacts(region(req)) });
}

export async function guides(_req: Request, res: Response) {
  revalidate(res);
  res.json({ guides: await guideService.listGuides() });
}

export async function getGuide(req: Request, res: Response) {
  revalidate(res);
  res.json({ guide: await guideService.getGuide((req.validated.params as { idOrSlug: string }).idOrSlug) });
}

export async function disasterTypes(_req: Request, res: Response) {
  revalidate(res);
  res.json({ disasterTypes: await guideService.listDisasterTypes() });
}

/** Everything a device needs to work offline for a region, in one response. */
export async function offlinePack(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  res.json(await offlinePackService.buildOfflinePack(region(req)));
}
