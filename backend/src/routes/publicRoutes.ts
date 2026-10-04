import { Router } from 'express';
import { regionQuerySchema, safetyStatusCreateSchema, syncBatchSchema, uuidParamSchema } from '@resqnet/shared';
import * as data from '../controllers/publicDataController.js';
import * as sync from '../controllers/syncController.js';
import { emergencyWriteLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { guideParamSchema } from '../validators/index.js';

/** Endpoints usable without an account. */
export const publicRoutes = Router();

const region = validate({ query: regionQuerySchema });

publicRoutes.get('/alerts', region, data.activeAlerts);
publicRoutes.get('/alerts/active', region, data.activeAlerts);
publicRoutes.get('/alerts/:id', validate({ params: uuidParamSchema }), data.getAlert);

publicRoutes.get('/shelters', region, data.shelters);
publicRoutes.get('/shelters/regions', data.shelterRegions);
publicRoutes.get('/shelters/:id', validate({ params: uuidParamSchema }), data.getShelter);

publicRoutes.get('/emergency-contacts', region, data.contacts);
publicRoutes.get('/safety-guides', data.guides);
publicRoutes.get('/safety-guides/:idOrSlug', validate({ params: guideParamSchema }), data.getGuide);
publicRoutes.get('/disaster-types', data.disasterTypes);
publicRoutes.get('/offline-pack', region, data.offlinePack);

publicRoutes.post('/safety-status', emergencyWriteLimiter, validate({ body: safetyStatusCreateSchema }), sync.createSafetyStatus);
publicRoutes.get('/safety-status', sync.getSafetyStatus);

publicRoutes.post('/sync', emergencyWriteLimiter, validate({ body: syncBatchSchema }), sync.sync);
publicRoutes.get('/sync/status', sync.status);
