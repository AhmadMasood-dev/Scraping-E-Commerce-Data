const Review = require('../models/review.model');
const Product = require('../models/product.model');
const { NotFoundError } = require('../errors/AppError');

const getProductSentiment = async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new NotFoundError('Product');

  const reviews = await Review.find({ product_id: req.params.id }).lean();

  if (reviews.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No reviews found for this product yet',
      data: { quality_score: 0, distribution: { positive: 0, neutral: 0, negative: 0 }, total_reviews: 0, reviews: [] },
    });
  }

  let positive = 0, neutral = 0, negative = 0, totalScore = 0;
  for (const r of reviews) {
    totalScore += r.sentiment_score || 0;
    if (r.sentiment_label === 'Positive') positive++;
    else if (r.sentiment_label === 'Negative') negative++;
    else neutral++;
  }
  const total = reviews.length;
  res.status(200).json({
    success: true,
    data: {
      quality_score: totalScore / total,
      distribution: { positive: (positive / total) * 100, neutral: (neutral / total) * 100, negative: (negative / total) * 100 },
      total_reviews: total,
      reviews: reviews.slice(0, 50),
    },
  });
};

module.exports = { getProductSentiment };
