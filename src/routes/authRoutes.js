import { Router } from 'express';

import {
  register,
  login,
  getMe,
  updateMe,
  changeMyPassword,
  verifyEmail,
  resendVerificationEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  verifyEmailSchema,
} from '../validators/authValidators.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), register);

// POST /api/auth/login
router.post('/login', validate(loginSchema), login);

// POST /api/auth/verify  — verify email from the emailed token (public)
router.post('/verify', validate(verifyEmailSchema), verifyEmail);

// POST /api/auth/resend-verification  (protected) — re-send the verify email
router.post('/resend-verification', protect, resendVerificationEmail);

// GET /api/auth/me  (protected)
router.get('/me', protect, getMe);

// PUT /api/auth/me  (protected) — update own profile (name / avatar)
router.put('/me', protect, updateMe);

// PUT /api/auth/me/password  (protected) — change own password
router.put('/me/password', protect, validate(changePasswordSchema), changeMyPassword);

export default router;
