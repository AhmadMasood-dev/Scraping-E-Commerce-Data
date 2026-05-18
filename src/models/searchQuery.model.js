const mongoose = require('mongoose');

const searchQuerySchema = new mongoose.Schema({
  original: { type: String, required: true },
  language: { type: String, default: 'en' },
  translated: String,
  keywords: [String],
  normalized: { type: String, index: true },
  resultCount: Number,
  fromCache: Boolean,
  durationMs: Number,
}, { timestamps: true });

searchQuerySchema.index({ normalized: 1, createdAt: -1 });

module.exports = mongoose.model('SearchQuery', searchQuerySchema);
