import { ZodError } from 'zod';

/**
 * Request-validation middleware factory backed by Zod.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), register);
 *
 * On success the parsed (and coerced/trimmed) value replaces `req.body`, so
 * controllers can trust the shape. On failure it produces the same
 * `{ success, message, errors }` envelope the central errorHandler uses, with
 * `errors` as an array of `{ field, message }` — the shape the frontend maps
 * onto individual form fields.
 *
 * `source` selects which part of the request to validate ('body' | 'query' |
 * 'params'); defaults to the body.
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const errors = (result.error instanceof ZodError ? result.error.issues : []).map(
      (issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }),
    );

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Replace with the parsed/sanitized value (trimmed strings, coerced types).
  req[source] = result.data;
  return next();
};

export default validate;
