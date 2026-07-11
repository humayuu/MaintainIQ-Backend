/**
 * Catch-all for routes that didn't match anything above it.
 * Forwards a 404 to the central error handler for a consistent response shape.
 */
const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

export default notFound;
