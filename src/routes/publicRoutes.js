import { Router } from 'express';

import { getPublicAsset } from '../controllers/publicAssetController.js';
import {
  triageIssuePreview,
  submitIssue,
} from '../controllers/publicIssueController.js';
import { uploadEvidence } from '../controllers/uploadController.js';
import { publicIssueLimiter } from '../middleware/rateLimiter.js';
import { uploadEvidenceFiles } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { submitIssueSchema, triageIssueSchema } from '../validators/issueValidators.js';

const router = Router();

// GET /api/public/assets/:slug  — NO auth middleware here on purpose.
router.get('/assets/:slug', getPublicAsset);

// POST /api/public/uploads — public issue-report evidence (no auth). Rate-limited
// and behind multer; the reporter uploads photos/videos before submitting.
router.post('/uploads', publicIssueLimiter, uploadEvidenceFiles, uploadEvidence);

// Step 1: AI triage preview (saves nothing). Rate-limited (public + calls AI).
router.post(
  '/assets/:slug/issues/triage',
  publicIssueLimiter,
  validate(triageIssueSchema),
  triageIssuePreview,
);

// Step 2: submit the reviewed issue. Rate-limited (public-facing).
router.post(
  '/assets/:slug/issues',
  publicIssueLimiter,
  validate(submitIssueSchema),
  submitIssue,
);

export default router;
