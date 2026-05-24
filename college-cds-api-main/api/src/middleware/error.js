function notFoundHandler(req, res, next) {
  next({ status: 404, message: `Route not found: ${req.method} ${req.path}` });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', status, message, err.stack);
  }
  res.status(status).json({
    error: { code: status, message },
  });
}

module.exports = { notFoundHandler, errorHandler };
