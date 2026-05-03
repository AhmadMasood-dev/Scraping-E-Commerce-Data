const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  original_text: {
    type: String,
    required: true
  },
  transliterated_text: {
    type: String
  },
  sentiment_score: {
    type: Number,
    min: -1.0,
    max: 1.0
  },
  sentiment_label: {
    type: String,
    enum: ['Positive', 'Neutral', 'Negative']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Review', reviewSchema);
