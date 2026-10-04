import type { Request, Response } from 'express';
import type { syncBatchSchema } from '@resqnet/shared';
import type { z } from 'zod';
import * as safetyStatusService from '../services/safetyStatusService.js';
import * as syncService from '../services/syncService.js';
import { reporterContext } from '../utils/request.js';

/** POST /api/sync — replay a batch of offline operations. Always 200 with per-op results. */
export async function sync(req: Request, res: Response) {
  const batch = req.validated.body as z.output<typeof syncBatchSchema>;
  res.json(await syncService.processBatch(batch, { userId: req.auth?.userId }));
}

export async function status(req: Request, res: Response) {
  res.json(await syncService.syncStatus(req.deviceId));
}

export async function createSafetyStatus(req: Request, res: Response) {
  const { status, created } = await safetyStatusService.recordSafetyStatus(
    req.validated.body as never,
    reporterContext(req),
  );
  res.status(created ? 201 : 200).json({ status, created });
}

export async function getSafetyStatus(req: Request, res: Response) {
  res.json({ status: await safetyStatusService.latestSafetyStatus(reporterContext(req)) });
}
