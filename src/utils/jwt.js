import jwt from 'jsonwebtoken';

/**
 * Reusable JWT sign/verify helpers so token config lives in exactly one place.
 * Secret and expiry are read at call time (not module load) so tests can set
 * env vars before invoking these.
 */

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in the environment');
  }
  return secret;
};

/**
 * Sign a JWT. Payload should carry `userId` and `role` so downstream
 * middleware can authorize without an extra DB lookup.
 */
export const generateToken = (payload) =>
  jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

/**
 * Verify and decode a JWT. Throws (JsonWebTokenError/TokenExpiredError) on an
 * invalid or expired token — callers should treat that as a 401.
 */
export const verifyToken = (token) => jwt.verify(token, getSecret());
