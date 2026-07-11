/**
 * Central error-handling middleware.
 *
 * Any error passed to `next(err)` or thrown in an async handler (and forwarded)
 * lands here and is serialized into a consistent JSON envelope:
 *
 *   { success: false, message, errors }
 *
 * `errors` carries field-level detail when available (e.g. Mongoose validation),
 * otherwise it's null.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by its 4-arg signature.
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Mongoose validation error → 400 with per-field messages.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Mongoose bad ObjectId → 400 rather than a 500 cast error.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Duplicate key.
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate value';
    errors = Object.keys(err.keyValue || {}).map((field) => ({
      field,
      message: `${field} already exists`,
    }));
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
};

export default errorHandler;
