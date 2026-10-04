import { Router } from 'express';
import { health } from '../controllers/healthController.js';
import { adminRoutes } from './adminRoutes.js';
import { authRoutes } from './authRoutes.js';
import { demoRoutes } from './demoRoutes.js';
import { incidentRoutes } from './incidentRoutes.js';
import { publicRoutes } from './publicRoutes.js';

export const apiRouter = Router();

apiRouter.get('/health', health);
apiRouter.head('/health', health);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/incidents', incidentRoutes);
apiRouter.use('/demo', demoRoutes);
apiRouter.use('/', publicRoutes);
apiRouter.use('/', adminRoutes);
