import rateLimit from 'express-rate-limit';

/**
 * Rate limit for public, unauthenticated issue endpoints (triage + submit).
 * 10 requests / 15 minutes per IP — these are internet-facing and the triage
 * path also calls an external AI API, so we cap abuse.
 */
export const publicIssueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again in a few minutes.',
    errors: null,
  },
});
