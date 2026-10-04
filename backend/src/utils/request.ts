import type { Request } from 'express';
import type { Viewer } from '../models/mappers.js';
import type { ClientContext } from '../services/authService.js';

export function clientContext(req: Request): ClientContext {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

/** The authenticated caller. Only use after `requireAuth`/`requireRole`. */
export function viewer(req: Request): Viewer {
  return { userId: req.auth!.userId, role: req.auth!.role };
}

/** Identity used for reporter-owned records (user and/or device). */
export function reporterContext(req: Request) {
  return { userId: req.auth?.userId, deviceId: req.deviceId };
}

export function idParam(req: Request): string {
  return (req.validated.params as { id: string }).id;
}
