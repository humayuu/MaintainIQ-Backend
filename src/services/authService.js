import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../models/User.js';
import { sendVerificationEmail } from './emailService.js';

const SALT_ROUNDS = 10;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Create a fresh single-use verification token + its expiry timestamp.
const newVerification = () => ({
  verificationToken: crypto.randomBytes(32).toString('hex'),
  verificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
});

// Build the frontend link the user clicks to verify their email.
const buildVerifyLink = (token) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/verify-email?token=${token}`;
};

/**
 * Reusable authentication logic. Controllers orchestrate request/response;
 * this module owns the "how" (hashing, credential verification) so it can be
 * reused (e.g. seeding, password reset) without duplicating rules.
 *
 * Every function here returns a sanitized user object with `password` stripped —
 * passwords must never leave this layer.
 */

const sanitize = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  // Never expose the verification token/expiry, even if a query selected them.
  delete obj.verificationToken;
  delete obj.verificationTokenExpiresAt;
  return obj;
};

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/**
 * Create a new user with a hashed password. Rejects duplicate emails with 409.
 * Returns the created user without the password field.
 */
export const registerUser = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw httpError('Email is already registered', 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const verification = newVerification();

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    emailVerified: false,
    ...verification,
  });

  // Fire the verification email (non-blocking: send failures never fail signup).
  await sendVerificationEmail(user.email, buildVerifyLink(verification.verificationToken));

  return sanitize(user);
};

/**
 * Verify an account from its emailed token. Returns a status string so the
 * controller can respond/redirect precisely:
 *   'verified'         — token matched, account is now verified
 *   'already-verified' — token already consumed but that email is verified
 *   'invalid'          — no matching, unexpired token
 */
export const verifyEmailToken = async (token) => {
  if (!token) return 'invalid';

  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpiresAt: { $gt: new Date() },
  }).select('+verificationToken +verificationTokenExpiresAt');

  if (!user) return 'invalid';

  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpiresAt = undefined;
  await user.save();

  return 'verified';
};

/**
 * Re-issue a verification token + email for the given user. No-ops (returns
 * 'already-verified') if the account is already verified.
 */
export const resendVerification = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404);
  if (user.emailVerified) return 'already-verified';

  const verification = newVerification();
  user.verificationToken = verification.verificationToken;
  user.verificationTokenExpiresAt = verification.verificationTokenExpiresAt;
  await user.save();

  await sendVerificationEmail(user.email, buildVerifyLink(verification.verificationToken));
  return 'sent';
};

/**
 * Verify email + password. Returns the sanitized user on success, otherwise
 * throws a 401. Uses a single generic message so we don't leak which of the
 * two (email vs password) was wrong.
 */
export const loginUser = async ({ email, password }) => {
  // password has `select: false`, so explicitly include it for the comparison.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw httpError('Invalid email or password', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw httpError('Invalid email or password', 401);
  }

  return sanitize(user);
};

/**
 * Update a user's own editable profile fields (currently name + avatarUrl).
 * Only the whitelisted keys that are actually present are applied — email and
 * role are intentionally NOT editable here. Returns the sanitized user.
 */
export const updateProfile = async (userId, { name, avatarUrl } = {}) => {
  const updates = {};
  if (name !== undefined) {
    if (!String(name).trim()) throw httpError('Name cannot be empty', 400);
    updates.name = String(name).trim();
  }
  if (avatarUrl !== undefined) {
    updates.avatarUrl = String(avatarUrl).trim();
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw httpError('User not found', 404);

  return sanitize(user);
};

/**
 * Change a user's own password. Verifies the current password first (so a
 * stolen session can't silently reset it), then hashes and stores the new one.
 * Returns the sanitized user.
 */
export const changePassword = async (userId, { currentPassword, newPassword } = {}) => {
  if (!currentPassword || !newPassword) {
    throw httpError('currentPassword and newPassword are required', 400);
  }
  if (String(newPassword).length < 6) {
    throw httpError('New password must be at least 6 characters', 400);
  }

  // password is select:false — pull it in explicitly for the comparison.
  const user = await User.findById(userId).select('+password');
  if (!user) throw httpError('User not found', 404);

  const matches = await bcrypt.compare(currentPassword, user.password);
  if (!matches) {
    throw httpError('Current password is incorrect', 401);
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  return sanitize(user);
};
