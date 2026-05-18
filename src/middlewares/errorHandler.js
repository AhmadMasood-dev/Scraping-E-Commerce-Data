const { ZodError } = require('zod');
const { AppError } = require('../errors/AppError');
const logger = require('../config/logger');

const errorHandler = (err, req, res, _next) => {
  // Zod validation (v3 uses err.errors, v4 uses err.issues)
  const isZod = err instanceof ZodError || err?.constructor?.name === 'ZodError' || Array.isArray(err?.issues);
  if (isZod) {
    const issues = err.issues || err.errors || [];
    const fields = issues.map((e) => ({ path: (e.path || []).join('.'), message: e.message }));
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid input', fields } });
  }

  // Mongoose CastError (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid identifier' } });
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError' && err.errors) {
    const fields = Object.entries(err.errors).map(([k, v]) => ({ path: k, message: v.message }));
    return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Invalid input', fields } });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Resource already exists' } });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }

  // Our typed errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { ...err.details } : {}) },
    });
  }

  // Unknown — log full stack, return generic
  logger.error(`[unhandled] ${err.message}`, { stack: err.stack, path: req.originalUrl });
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message },
  });
};

module.exports = { errorHandler };
