const mongoose = require('mongoose');

const priceSourceSchema = new mongoose.Schema({
  store_name: { type: String, required: true },
  native_id: { type: String },
  url: { type: String, required: true },
  current_price: { type: Number, required: true },
  historical_prices: [
    {
      price: { type: Number, required: true },
      date: { type: Date, default: Date.now },
    },
  ],
}, { _id: false });

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  brand: { type: String, index: true },
  category: { type: String, index: true },
  description: { type: String },
  image_url: { type: String },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  availability: { type: String, default: 'Unknown' },
  position: { type: Number, default: 0 },
  store_key: { type: String, index: true },
  match_key: { type: String, index: true },
  specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  price_sources: [priceSourceSchema],
}, { timestamps: true });

productSchema.index({ title: 'text', brand: 'text', category: 'text', description: 'text' });
productSchema.index({ category: 1, 'price_sources.current_price': 1 });
productSchema.index({ 'price_sources.store_name': 1 });
productSchema.index({ 'price_sources.store_name': 1, 'price_sources.native_id': 1 });

module.exports = mongoose.model('Product', productSchema);
