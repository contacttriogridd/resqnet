import { Router } from 'express';
import {
  incidentCreateSchema,
  incidentListQuerySchema,
  incidentNoteSchema,
  incidentUpdateSchema,
  uuidParamSchema,
} from '@resqnet/shared';
import * as ctrl from '../controllers/incidentController.js';
import { requireRole } from '../middleware/auth.js';
import { emergencyWriteLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { cancelBodySchema, clientIdsQuerySchema } from '../validators/index.js';

export const incidentRoutes = Router();

const field = requireRole('VOLUNTEER', 'RESPONDER', 'ADMIN');
const id = validate({ params: uuidParamSchema });

// Anyone can ask for help — no account needed in an emergency.
incidentRoutes.post('/', emergencyWriteLimiter, validate({ body: incidentCreateSchema }), ctrl.create);

// Reporter (user or device) views/cancels their own reports.
incidentRoutes.get('/mine', validate({ query: clientIdsQuerySchema }), ctrl.mine);
incidentRoutes.post(
  '/client/:id/cancel',
  emergencyWriteLimiter,
  validate({ params: uuidParamSchema, body: cancelBodySchema }),
  ctrl.cancelOwn,
);

// Field roles.
incidentRoutes.get('/', field, validate({ query: incidentListQuerySchema }), ctrl.list);
incidentRoutes.get('/:id', field, id, ctrl.get);
incidentRoutes.patch('/:id', field, validate({ params: uuidParamSchema, body: incidentUpdateSchema }), ctrl.update);
incidentRoutes.post('/:id/accept', field, id, ctrl.accept);
incidentRoutes.post('/:id/notes', field, validate({ params: uuidParamSchema, body: incidentNoteSchema }), ctrl.addNote);
