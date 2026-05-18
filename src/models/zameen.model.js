const mongoose = require('mongoose');

const zameenPropertySchema = new mongoose.Schema({
  property_id: { type: Number, index: true },
  location_id: { type: Number },
  page_url: { type: String },
  property_type: { type: String, index: true },
  price: { type: Number, index: true },
  location: { type: String },
  city: { type: String, index: true },
  province_name: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  baths: { type: Number },
  area: { type: String },
  purpose: { type: String, index: true },
  bedrooms: { type: Number },
  date_added: { type: String },
  agency: { type: String },
  agent: { type: String },
  area_type: { type: String },
  area_size: { type: Number },
  area_category: { type: String },
}, { timestamps: true });

// Compound index for the most common Zameen search filter combination — without
// this, 168k-doc filtered searches do a full collection scan (~800ms).
zameenPropertySchema.index({ city: 1, property_type: 1, purpose: 1, price: 1 });
zameenPropertySchema.index({ location: 'text', city: 'text', province_name: 'text', area_category: 'text' });

module.exports = mongoose.model('ZameenProperty', zameenPropertySchema);
