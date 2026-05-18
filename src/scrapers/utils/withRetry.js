/**
 * Run an async function with retry + timeout. Uses p-retry/p-timeout (ESM-only)
 * loaded via dynamic import so this stays in CommonJS.
 */
const withRetry = async (fn, { retries = 3, timeoutMs = 8000, label = 'task' } = {}) => {
  const { default: pRetry } = await import('p-retry');
  const { default: pTimeout } = await import('p-timeout');

  return pRetry(
    () => pTimeout(fn(), { milliseconds: timeoutMs, message: `${label} timed out after ${timeoutMs}ms` }),
    {
      retries,
      factor: 2,
      minTimeout: 500,
      maxTimeout: 4000,
      onFailedAttempt: (err) => {
        // eslint-disable-next-line global-require
        const logger = require('../../config/logger');
        logger.warn(`[${label}] attempt ${err.attemptNumber} failed: ${err.message}. Retries left: ${err.retriesLeft}`);
      },
    }
  );
};

module.exports = { withRetry };
