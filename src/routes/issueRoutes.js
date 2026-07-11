import { Router } from 'express';

import {
  listIssues,
  getIssueStats,
  getIssue,
  assignIssue,
} from '../controllers/issueController.js';
import {
  createMaintenance,
  updateStatus,
  reopenIssue,
} from '../controllers/maintenanceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import technicianOwnsIssue from '../middleware/technicianOwnsIssue.js';

const router = Router();

// All internal issue routes require a valid token.
router.use(protect);

// GET /api/issues  (any authenticated role)
router.get('/', listIssues);

// Aggregate stats — MUST be before '/:id' so 'stats' isn't captured as an id.
router.get('/stats', getIssueStats);

// GET /api/issues/:id  (any authenticated role)
router.get('/:id', getIssue);

// PUT /api/issues/:id/assign  (admin only)
router.put('/:id/assign', authorize('admin'), assignIssue);

// Maintenance workflow — technicianOwnsIssue lets an assigned technician act on
// their own issues; admins bypass the ownership check inside that middleware.
router.post('/:id/maintenance', technicianOwnsIssue, createMaintenance);
router.put('/:id/status', technicianOwnsIssue, updateStatus);
router.put('/:id/reopen', technicianOwnsIssue, reopenIssue);

export default router;
