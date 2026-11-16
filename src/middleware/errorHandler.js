const { sendError } = require('../utils/response.util');
const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
  // Always log error details to console for debugging
  console.error(`[API ERROR] ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return sendError(res, 'Validation Error', 422, formattedErrors);
  }

  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    return sendError(res, `Duplicate field value entered: ${fields.join(', ')}`, 409);
  }

  if (err.code === 'P2025') {
    return sendError(res, 'Requested record not found', 404);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  const extraData = err.existingProductId ? { existingProductId: err.existingProductId } : null;

  return sendError(res, message, statusCode, null, extraData);
};

module.exports = errorHandler;
