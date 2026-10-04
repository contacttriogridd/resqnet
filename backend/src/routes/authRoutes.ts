import { Router } from 'express';
import { loginSchema, registerSchema } from '@resqnet/shared';
import * as ctrl from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrfHeader } from '../middleware/csrf.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, validate({ body: registerSchema }), ctrl.register);
authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), ctrl.login);
// Cookie-authenticated endpoints → CSRF-protected.
authRoutes.post('/refresh', requireCsrfHeader, ctrl.refresh);
authRoutes.post('/logout', requireCsrfHeader, ctrl.logout);
authRoutes.get('/me', requireAuth, ctrl.me);
