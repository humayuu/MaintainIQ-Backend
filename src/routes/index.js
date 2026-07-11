import { Router } from 'express';

import healthRoutes from './health.routes.js';

const router = Router();

// Mounted under /api in app.js → GET /api/health
router.use('/health', healthRoutes);

export default router;
