class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404, 'NOT_FOUND'); }
}

class ValidationError extends AppError {
  constructor(fields = []) { super('Validation failed', 400, 'VALIDATION', { fields }); }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401, 'UNAUTHORIZED'); }
}

class ScraperDownError extends AppError {
  constructor() { super('All scrapers failed', 503, 'SCRAPER_DOWN'); }
}

class RateLimitError extends AppError {
  constructor(retryAfter) { super('Too many requests', 429, 'RATE_LIMITED', { retryAfter }); }
}

module.exports = { AppError, NotFoundError, ValidationError, UnauthorizedError, ScraperDownError, RateLimitError };
