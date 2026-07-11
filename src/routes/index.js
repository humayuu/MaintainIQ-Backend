import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './authRoutes.js';

const router = Router();

// Mounted under /api in app.js → GET /api/health
router.use('/health', healthRoutes);

// → /api/auth/*
router.use('/auth', authRoutes);

export default router;
