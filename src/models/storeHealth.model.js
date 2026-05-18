const mongoose = require('mongoose');

const storeHealthSchema = new mongoose.Schema({
  store: { type: String, required: true, unique: true, index: true },
  lastSuccess: Date,
  lastFailure: Date,
  lastError: String,
  consecutiveFailures: { type: Number, default: 0 },
  avgDurationMs: { type: Number, default: 0 },
  totalRuns: { type: Number, default: 0 },
  status: { type: String, enum: ['healthy', 'degraded', 'down'], default: 'healthy' },
}, { timestamps: true });

module.exports = mongoose.model('StoreHealth', storeHealthSchema);
