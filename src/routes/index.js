import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './authRoutes.js';
import assetRoutes from './assetRoutes.js';
import issueRoutes from './issueRoutes.js';
import publicRoutes from './publicRoutes.js';

const router = Router();

// Mounted under /api in app.js → GET /api/health
router.use('/health', healthRoutes);

// → /api/auth/*
router.use('/auth', authRoutes);

// → /api/assets/*  (protected)
router.use('/assets', assetRoutes);

// → /api/issues/*  (protected)
router.use('/issues', issueRoutes);

// → /api/public/*  (no auth)
router.use('/public', publicRoutes);

export default router;
