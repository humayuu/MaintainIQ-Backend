import { Router } from 'express';

import { listUsers } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// All user routes require a valid token.
router.use(protect);

// GET /api/users?role=technician  (admin only)
router.get('/', authorize('admin'), listUsers);

export default router;
