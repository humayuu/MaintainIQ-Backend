import { Router } from 'express';

import healthRoutes from './health.routes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import assetRoutes from './assetRoutes.js';
import issueRoutes from './issueRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import publicRoutes from './publicRoutes.js';

const router = Router();

// Mounted under /api in app.js → GET /api/health
router.use('/health', healthRoutes);

// → /api/auth/*
router.use('/auth', authRoutes);

// → /api/users/*  (protected, admin-gated inside)
router.use('/users', userRoutes);

// → /api/assets/*  (protected)
router.use('/assets', assetRoutes);

// → /api/issues/*  (protected)
router.use('/issues', issueRoutes);

// → /api/uploads  (protected — evidence media upload to Cloudinary)
router.use('/uploads', uploadRoutes);

// → /api/public/*  (no auth)
router.use('/public', publicRoutes);

export default router;
