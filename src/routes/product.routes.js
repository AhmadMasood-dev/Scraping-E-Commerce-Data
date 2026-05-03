const express = require('express');
const { searchProducts, getProductById, setProductAlert, getLandingPageData, getAllProducts, getProductsByCategory } = require('../controllers/product.controller');
const { getProductSentiment } = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Static routes must be above /:id dynamic routes
router.get('/', getAllProducts);
router.get('/landing', getLandingPageData);
router.get('/search', searchProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);
router.post('/:id/alerts', protect, setProductAlert);

// Review/Sentiment relation route
router.get('/:id/reviews/sentiment', getProductSentiment);

module.exports = router;
