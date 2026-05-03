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
  purpose: { type: String },
  bedrooms: { type: Number },
  date_added: { type: String },
  agency: { type: String },
  agent: { type: String },
  area_type: { type: String },
  area_size: { type: Number },
  area_category: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('ZameenProperty', zameenPropertySchema);
