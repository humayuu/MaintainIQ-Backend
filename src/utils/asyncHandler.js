/**
 * Wraps an async route/middleware handler so any rejected promise is forwarded
 * to Express's central error handler via next(), instead of crashing or hanging.
 *
 *   router.post('/', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
