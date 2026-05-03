const Review = require('../models/review.model');
const Product = require('../models/product.model');

// @desc    Get sentiment distributions and reviews for a product
// @route   GET /api/v1/products/:id/reviews/sentiment
// @access  Public
const getProductSentiment = async (req, res) => {
  try {
    const productId = req.params.id;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const reviews = await Review.find({ product_id: productId });

    if (reviews.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No reviews found for this product yet.',
        data: {
            quality_score: 0,
            distribution: { positive: 0, neutral: 0, negative: 0 },
            total_reviews: 0,
            reviews: []
        }
      });
    }

    let positive = 0, neutral = 0, negative = 0;
    let totalScore = 0;

    reviews.forEach(review => {
      totalScore += (review.sentiment_score || 0);
      if (review.sentiment_label === 'Positive') positive++;
      else if (review.sentiment_label === 'Negative') negative++;
      else neutral++;
    });

    const total = reviews.length;
    // Calculate an aggregate Quality Score between -1 and 1
    const aggregateQualityScore = totalScore / total;

    // A positive > 0.3 generally indicates a good product, negative < -0.3 is poor.
    const distribution = {
      positive: (positive / total) * 100,
      neutral: (neutral / total) * 100,
      negative: (negative / total) * 100
    };

    res.status(200).json({
      success: true,
      data: {
        quality_score: aggregateQualityScore,
        distribution,
        total_reviews: total,
        reviews: reviews.slice(0, 50) // Return top 50 recent reviews
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server Error fetching sentiments' });
  }
};

module.exports = {
  getProductSentiment
};
