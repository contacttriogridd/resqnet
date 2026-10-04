import type { Request, Response } from 'express';
import type { HealthResponse } from '@resqnet/shared';
import { APP_VERSION, env } from '../config/env.js';
import { prisma } from '../models/prisma.js';

/**
 * Used by the PWA to tell "the browser thinks it's online" apart from "the
 * RESQNET backend is actually reachable". Never cached.
 */
export async function health(_req: Request, res: Response) {
  let database: HealthResponse['database'] = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  const body: HealthResponse = {
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    serverTime: new Date().toISOString(),
    demoMode: env.DEMO_MODE_ENABLED,
    version: APP_VERSION,
  };
  res.set('Cache-Control', 'no-store').status(database === 'up' ? 200 : 503).json(body);
}
