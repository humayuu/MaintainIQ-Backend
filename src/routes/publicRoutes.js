import { Router } from 'express';

import { getPublicAsset } from '../controllers/publicAssetController.js';

const router = Router();

// GET /api/public/assets/:slug  — NO auth middleware here on purpose.
router.get('/assets/:slug', getPublicAsset);

export default router;
