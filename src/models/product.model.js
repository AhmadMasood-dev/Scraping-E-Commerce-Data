const mongoose = require('mongoose');

const priceSourceSchema = new mongoose.Schema({
  store_name: { type: String, required: true },
  native_id: { type: String }, // Store's internal item ID
  url: { type: String, required: true },
  current_price: { type: Number, required: true },
  historical_prices: [
    {
      price: { type: Number, required: true },
      date: { type: Date, default: Date.now }
    }
  ]
});

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true // index for faster text search
  },
  brand: {
    type: String,
    index: true
  },
  category: {
    type: String,
    index: true
  },
  description: {
    type: String
  },
  image_url: {
    type: String
  },
  rating: {
    type: Number,
    default: 0
  },
  specifications: {
    type: mongoose.Schema.Types.Mixed, // Dynamic key-value pairs
    default: {}
  },
  price_sources: [priceSourceSchema]
}, {
  timestamps: true
});

// Create text index for search
productSchema.index({ title: 'text', brand: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
