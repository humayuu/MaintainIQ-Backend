import { Router } from 'express';

import {
  register,
  login,
  getMe,
  updateMe,
  changeMyPassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from '../validators/authValidators.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), register);

// POST /api/auth/login
router.post('/login', validate(loginSchema), login);

// GET /api/auth/me  (protected)
router.get('/me', protect, getMe);

// PUT /api/auth/me  (protected) — update own profile (name / avatar)
router.put('/me', protect, updateMe);

// PUT /api/auth/me/password  (protected) — change own password
router.put('/me/password', protect, validate(changePasswordSchema), changeMyPassword);

export default router;
