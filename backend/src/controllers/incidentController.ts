import type { Request, Response } from 'express';
import type { IncidentCreate, incidentListQuerySchema, incidentUpdateSchema } from '@resqnet/shared';
import type { z } from 'zod';
import { toIncidentDTO } from '../models/mappers.js';
import * as incidentService from '../services/incidentService.js';
import { idParam, reporterContext, viewer } from '../utils/request.js';

/**
 * POST /api/incidents — idempotent.
 * 201 when created, 200 when the clientId was already received.
 */
export async function create(req: Request, res: Response) {
  const input = req.validated.body as IncidentCreate;
  const { incident, created } = await incidentService.createIncident(input, {
    ...reporterContext(req),
    source: 'DIRECT',
  });
  res
    .status(created ? 201 : 200)
    .location(`/api/incidents/${incident.id}`)
    .json({ incident: toIncidentDTO(incident, req.auth ? viewer(req) : undefined), created });
}

export async function list(req: Request, res: Response) {
  const query = req.validated.query as z.output<typeof incidentListQuerySchema>;
  res.json({ incidents: await incidentService.listIncidents(query, viewer(req)) });
}

export async function get(req: Request, res: Response) {
  res.json({ incident: await incidentService.getIncident(idParam(req), viewer(req)) });
}

export async function update(req: Request, res: Response) {
  const input = req.validated.body as z.output<typeof incidentUpdateSchema>;
  res.json({ incident: await incidentService.updateIncident(idParam(req), input, viewer(req), req.ip) });
}

export async function accept(req: Request, res: Response) {
  res.json({ incident: await incidentService.acceptIncident(idParam(req), viewer(req), req.ip) });
}

export async function addNote(req: Request, res: Response) {
  const { note } = req.validated.body as { note: string };
  res.status(201).json({ incident: await incidentService.addNote(idParam(req), note, viewer(req)) });
}

/** GET /api/incidents/mine?clientIds=a,b — status of the caller's own reports. */
export async function mine(req: Request, res: Response) {
  const { clientIds } = req.validated.query as { clientIds: string[] };
  res.json({ incidents: await incidentService.reporterStatuses(clientIds, reporterContext(req)) });
}

/** POST /api/incidents/client/:id/cancel — reporter withdraws a request. */
export async function cancelOwn(req: Request, res: Response) {
  const { reason } = req.validated.body as { reason?: string };
  res.json(await incidentService.cancelByReporter(idParam(req), reporterContext(req), reason));
}
