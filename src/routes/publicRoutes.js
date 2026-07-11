import { Router } from 'express';

import { getPublicAsset } from '../controllers/publicAssetController.js';
import {
  triageIssuePreview,
  submitIssue,
} from '../controllers/publicIssueController.js';
import { publicIssueLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// GET /api/public/assets/:slug  — NO auth middleware here on purpose.
router.get('/assets/:slug', getPublicAsset);

// Step 1: AI triage preview (saves nothing). Rate-limited (public + calls AI).
router.post('/assets/:slug/issues/triage', publicIssueLimiter, triageIssuePreview);

// Step 2: submit the reviewed issue. Rate-limited (public-facing).
router.post('/assets/:slug/issues', publicIssueLimiter, submitIssue);

export default router;
