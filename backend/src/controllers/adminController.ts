import type { Request, Response } from 'express';
import type { Role } from '@resqnet/shared';
import * as alertService from '../services/alertService.js';
import * as analyticsService from '../services/analyticsService.js';
import { listAuditLogs } from '../services/auditService.js';
import * as contactService from '../services/contactService.js';
import * as guideService from '../services/guideService.js';
import * as shelterService from '../services/shelterService.js';
import * as userService from '../services/userService.js';
import { idParam } from '../utils/request.js';

/** Management endpoints (admin, and responders for shelter occupancy). */

const actor = (req: Request) => req.auth!.userId;
const body = <T>(req: Request) => req.validated.body as T;

/* Users */
export async function listUsers(req: Request, res: Response) {
  res.json({ users: await userService.listUsers(req.validated.query as { role?: Role; q?: string }) });
}
export async function createUser(req: Request, res: Response) {
  res.status(201).json({ user: await userService.createUser(body(req), actor(req), req.ip) });
}
export async function updateUser(req: Request, res: Response) {
  res.json({ user: await userService.updateUser(idParam(req), body(req), actor(req), req.ip) });
}
export async function assignable(req: Request, res: Response) {
  const { role } = req.validated.query as { role: 'RESPONDER' | 'VOLUNTEER' };
  res.json({ users: await userService.listAssignable(role) });
}

/* Alerts */
export async function listAllAlerts(_req: Request, res: Response) {
  res.json({ alerts: await alertService.listAllAlerts() });
}
export async function createAlert(req: Request, res: Response) {
  res.status(201).json({ alert: await alertService.createAlert(body(req), actor(req), { ip: req.ip }) });
}
export async function updateAlert(req: Request, res: Response) {
  res.json({ alert: await alertService.updateAlert(idParam(req), body(req), actor(req), req.ip) });
}
export async function deactivateAlert(req: Request, res: Response) {
  res.json({ alert: await alertService.deactivateAlert(idParam(req), actor(req), req.ip) });
}

/* Shelters */
export async function createShelter(req: Request, res: Response) {
  res.status(201).json({ shelter: await shelterService.createShelter(body(req), actor(req), req.ip) });
}
export async function updateShelter(req: Request, res: Response) {
  res.json({ shelter: await shelterService.updateShelter(idParam(req), body(req), actor(req), req.ip) });
}
export async function removeShelter(req: Request, res: Response) {
  await shelterService.removeShelter(idParam(req), actor(req), req.ip);
  res.status(204).end();
}

/* Contacts */
export async function createContact(req: Request, res: Response) {
  res.status(201).json({ contact: await contactService.createContact(body(req), actor(req), req.ip) });
}
export async function updateContact(req: Request, res: Response) {
  res.json({ contact: await contactService.updateContact(idParam(req), body(req), actor(req), req.ip) });
}
export async function removeContact(req: Request, res: Response) {
  await contactService.removeContact(idParam(req), actor(req), req.ip);
  res.status(204).end();
}

/* Guides & disaster types */
export async function createGuide(req: Request, res: Response) {
  res.status(201).json({ guide: await guideService.createGuide(body(req), actor(req), req.ip) });
}
export async function updateGuide(req: Request, res: Response) {
  res.json({ guide: await guideService.updateGuide(idParam(req), body(req), actor(req), req.ip) });
}
export async function unpublishGuide(req: Request, res: Response) {
  await guideService.unpublishGuide(idParam(req), actor(req), req.ip);
  res.status(204).end();
}
export async function createDisasterType(req: Request, res: Response) {
  res.status(201).json({ disasterType: await guideService.createDisasterType(body(req), actor(req)) });
}
export async function updateDisasterType(req: Request, res: Response) {
  res.json({ disasterType: await guideService.updateDisasterType(idParam(req), body(req), actor(req)) });
}

/* Analytics & audit */
export async function analytics(req: Request, res: Response) {
  const { includeDemo, days } = req.validated.query as { includeDemo: boolean; days: number };
  res.json(await analyticsService.getAnalytics({ includeDemo, days }));
}
export async function auditLogs(_req: Request, res: Response) {
  const logs = await listAuditLogs(200);
  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      actorName: l.actor?.name ?? null,
      actorRole: l.actor?.role ?? null,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
