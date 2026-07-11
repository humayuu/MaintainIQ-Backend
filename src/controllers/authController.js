import { registerUser, loginUser } from '../services/authService.js';
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
 * GET /api/auth/me
 * Returns the authenticated user (already loaded, password-free, by `protect`).
 */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});
