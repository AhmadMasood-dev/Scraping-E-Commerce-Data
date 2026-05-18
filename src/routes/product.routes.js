const express = require('express');
const {
  searchProducts, getProductById, setProductAlert,
  getLandingPageData, getAllProducts, getProductsByCategory,
} = require('../controllers/product.controller');
const { getProductSentiment } = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { searchLimiter } = require('../middlewares/rateLimit');
const { searchQuery, categoryParams, idParams, listQuery } = require('../validators/product.schema');

const router = express.Router();

router.get('/', validate(listQuery), getAllProducts);
router.get('/landing', getLandingPageData);
router.get('/search', searchLimiter, validate(searchQuery), searchProducts);
router.get('/category/:category', validate(categoryParams), getProductsByCategory);
router.get('/:id', validate(idParams), getProductById);
router.post('/:id/alerts', protect, validate(idParams), setProductAlert);
router.get('/:id/reviews/sentiment', validate(idParams), getProductSentiment);

module.exports = router;
