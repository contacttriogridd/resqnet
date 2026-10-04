import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import * as ctrl from '../controllers/demoController.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { demoBodySchema } from '../validators/index.js';

/**
 * SIMULATION endpoints. When DEMO_MODE_ENABLED is false they do not exist
 * (404), so they cannot be triggered in a real deployment.
 */
export const demoRoutes = Router();

function demoEnabled(_req: Request, _res: Response, next: NextFunction) {
  if (!env.DEMO_MODE_ENABLED) return next(notFound('Page'));
  next();
}

demoRoutes.use(demoEnabled, requireRole('ADMIN'));
const body = validate({ body: demoBodySchema });

demoRoutes.post('/flood-alert', body, ctrl.floodAlert);
demoRoutes.post('/rescue-requests', body, ctrl.rescueRequests);
demoRoutes.post('/shelter-capacity', body, ctrl.shelterCapacity);
demoRoutes.post('/reset', ctrl.reset);
