import { Router } from 'express';
import {
  adminCreateUserSchema,
  alertCreateSchema,
  alertUpdateSchema,
  contactCreateSchema,
  contactUpdateSchema,
  disasterTypeCreateSchema,
  disasterTypeUpdateSchema,
  guideCreateSchema,
  guideUpdateSchema,
  shelterCreateSchema,
  shelterUpdateSchema,
  userAdminUpdateSchema,
  uuidParamSchema,
} from '@resqnet/shared';
import * as ctrl from '../controllers/adminController.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { analyticsQuerySchema, assignableQuerySchema, usersQuerySchema } from '../validators/index.js';

/**
 * Management API. Mounted at /api. Write routes on shared resources
 * (POST/PATCH/DELETE) live next to their public GETs for REST symmetry.
 */
export const adminRoutes = Router();

const admin = requireRole('ADMIN');
const staff = requireRole('RESPONDER', 'ADMIN');
const id = validate({ params: uuidParamSchema });
const withBody = (body: Parameters<typeof validate>[0]['body']) => validate({ params: uuidParamSchema, body });

// Users
adminRoutes.get('/admin/users', admin, validate({ query: usersQuerySchema }), ctrl.listUsers);
adminRoutes.post('/admin/users', admin, validate({ body: adminCreateUserSchema }), ctrl.createUser);
adminRoutes.patch('/admin/users/:id', admin, withBody(userAdminUpdateSchema), ctrl.updateUser);
adminRoutes.get('/users/assignable', staff, validate({ query: assignableQuerySchema }), ctrl.assignable);

// Analytics & audit
adminRoutes.get('/admin/analytics', admin, validate({ query: analyticsQuerySchema }), ctrl.analytics);
adminRoutes.get('/admin/audit-logs', admin, ctrl.auditLogs);

// Alerts
adminRoutes.get('/admin/alerts', admin, ctrl.listAllAlerts);
adminRoutes.post('/alerts', admin, validate({ body: alertCreateSchema }), ctrl.createAlert);
adminRoutes.patch('/alerts/:id', admin, withBody(alertUpdateSchema), ctrl.updateAlert);
adminRoutes.delete('/alerts/:id', admin, id, ctrl.deactivateAlert);

// Shelters — responders may update occupancy/status in the field.
adminRoutes.post('/shelters', admin, validate({ body: shelterCreateSchema }), ctrl.createShelter);
adminRoutes.patch('/shelters/:id', staff, withBody(shelterUpdateSchema), ctrl.updateShelter);
adminRoutes.delete('/shelters/:id', admin, id, ctrl.removeShelter);

// Emergency contacts
adminRoutes.post('/emergency-contacts', admin, validate({ body: contactCreateSchema }), ctrl.createContact);
adminRoutes.patch('/emergency-contacts/:id', admin, withBody(contactUpdateSchema), ctrl.updateContact);
adminRoutes.delete('/emergency-contacts/:id', admin, id, ctrl.removeContact);

// Safety guides & disaster types
adminRoutes.post('/safety-guides', admin, validate({ body: guideCreateSchema }), ctrl.createGuide);
adminRoutes.patch('/safety-guides/:id', admin, withBody(guideUpdateSchema), ctrl.updateGuide);
adminRoutes.delete('/safety-guides/:id', admin, id, ctrl.unpublishGuide);
adminRoutes.post('/disaster-types', admin, validate({ body: disasterTypeCreateSchema }), ctrl.createDisasterType);
adminRoutes.patch('/disaster-types/:id', admin, withBody(disasterTypeUpdateSchema), ctrl.updateDisasterType);
