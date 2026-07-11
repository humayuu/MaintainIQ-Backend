import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

const unauthorized = (message = 'Not authorized') => {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
};

/**
 * Verifies the `Authorization: Bearer <token>` header, then loads a FRESH copy
 * of the user from the DB (password excluded via the model's select:false) and
 * attaches it as req.user. Fetching fresh means a deleted/updated user can't
 * keep acting on a still-valid token.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    throw unauthorized('Missing or malformed Authorization header');
  }

  const token = header.slice(7).trim();

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw unauthorized('User no longer exists');
  }

  req.user = user;
  next();
});

/**
 * Role gate. Use after `protect`:
 *   router.get('/', protect, authorize('admin'), handler)
 *   router.patch('/:id', protect, authorize('admin', 'technician'), handler)
 * Reads role from req.user (populated by protect); returns 403 if not allowed.
 */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const err = new Error('You do not have permission to perform this action');
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
