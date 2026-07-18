import {
  registerUser,
  loginUser,
  updateProfile,
  changePassword,
  verifyEmailToken,
  resendVerification,
} from '../services/authService.js';
import { generateToken } from '../utils/jwt.js';
import asyncHandler from '../utils/asyncHandler.js';

// JWT payload carries userId + role so authorize() needs no DB lookup.
const signFor = (user) => generateToken({ userId: user._id, role: user.role });

/**
 * POST /api/auth/register
 * Creates a user (password hashed in the service) and returns a JWT.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    const err = new Error('name, email, password and role are required');
    err.statusCode = 400;
    throw err;
  }

  const user = await registerUser({ name, email, password, role });
  const token = signFor(user);

  res.status(201).json({ success: true, data: { user, token } });
});

/**
 * POST /api/auth/login
 * Verifies credentials and returns a JWT.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const err = new Error('email and password are required');
    err.statusCode = 400;
    throw err;
  }

  const user = await loginUser({ email, password });
  const token = signFor(user);

  res.status(200).json({ success: true, data: { user, token } });
});

/**
 * POST /api/auth/verify
 * Verifies an account from its emailed token. Public (the user isn't logged in
 * when they click the link). Body: { token }.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const status = await verifyEmailToken(token);

  if (status === 'invalid') {
    const err = new Error('This verification link is invalid or has expired.');
    err.statusCode = 400;
    throw err;
  }

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: { status },
  });
});

/**
 * POST /api/auth/resend-verification  (protected)
 * Re-sends the verification email to the logged-in user.
 */
export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const status = await resendVerification(req.user._id);
  res.status(200).json({
    success: true,
    message:
      status === 'already-verified'
        ? 'Your email is already verified'
        : 'Verification email sent',
    data: { status },
  });
});

/**
 * GET /api/auth/me
 * Returns the authenticated user (already loaded, password-free, by `protect`).
 */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

/**
 * PUT /api/auth/me  (protected)
 * Updates the caller's own profile (name / avatarUrl only).
 */
export const updateMe = asyncHandler(async (req, res) => {
  const { name, avatarUrl } = req.body;
  const user = await updateProfile(req.user._id, { name, avatarUrl });
  res.status(200).json({ success: true, data: { user } });
});

/**
 * PUT /api/auth/me/password  (protected)
 * Changes the caller's own password after verifying the current one.
 */
export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await changePassword(req.user._id, { currentPassword, newPassword });
  res.status(200).json({ success: true, message: 'Password updated successfully' });
});
