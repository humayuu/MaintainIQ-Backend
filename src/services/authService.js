import bcrypt from 'bcryptjs';

import User from '../models/User.js';

const SALT_ROUNDS = 10;

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

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
  });

  return sanitize(user);
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
