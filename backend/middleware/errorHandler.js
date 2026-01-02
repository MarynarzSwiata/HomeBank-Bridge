export const errorHandler = (err, req, res, next) => {
  console.error(err);

  // SQLite constraint violations
  if (err.code && err.code.includes('SQLITE_CONSTRAINT')) {
    return res.status(409).json({
      error: 'Constraint violation',
      message: err.message
    });
  }

  // Not found
  if (err.status === 404) {
    return res.status(404).json({
      error: 'Resource not found',
      message: err.message
    });
  }

  // Default 500 (DEBUG MODE: Expose errors in production)
  console.error('CRITICAL SERVER ERROR:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: err.stack,
    env: process.env.NODE_ENV
  });
};
