const StoreHealth = require('../models/storeHealth.model');

const recordSuccess = async (storeKey, durationMs) => {
  const doc = await StoreHealth.findOne({ store: storeKey });
  if (!doc) {
    await StoreHealth.create({
      store: storeKey,
      lastSuccess: new Date(),
      consecutiveFailures: 0,
      avgDurationMs: durationMs,
      totalRuns: 1,
      status: 'healthy',
    });
    return;
  }
  const totalRuns = doc.totalRuns + 1;
  doc.avgDurationMs = Math.round((doc.avgDurationMs * doc.totalRuns + durationMs) / totalRuns);
  doc.totalRuns = totalRuns;
  doc.lastSuccess = new Date();
  doc.consecutiveFailures = 0;
  doc.status = 'healthy';
  await doc.save();
};

const recordFailure = async (storeKey, errMsg) => {
  const doc = await StoreHealth.findOne({ store: storeKey });
  if (!doc) {
    await StoreHealth.create({
      store: storeKey,
      lastFailure: new Date(),
      lastError: errMsg,
      consecutiveFailures: 1,
      status: 'degraded',
    });
    return;
  }
  doc.lastFailure = new Date();
  doc.lastError = errMsg;
  doc.consecutiveFailures += 1;
  doc.status = doc.consecutiveFailures >= 5 ? 'down' : 'degraded';
  await doc.save();
};

module.exports = { recordSuccess, recordFailure };
