import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/users  (admin only)
 * Optional ?role= filter (e.g. ?role=technician). Returns lightweight,
 * password-free user records — used to populate the technician-assignment
 * picker on the issue detail screen.
 */
export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;

  const users = await User.find(filter).select('name email role').sort({ name: 1 });

  res.status(200).json({ success: true, data: { users } });
});
