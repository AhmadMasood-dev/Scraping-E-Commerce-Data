const rateLimit = require('express-rate-limit');

const json429 = (_req, res) => res.status(429).json({
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false, handler: json429,
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, handler: json429,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, handler: json429,
});

module.exports = { generalLimiter, searchLimiter, authLimiter };
