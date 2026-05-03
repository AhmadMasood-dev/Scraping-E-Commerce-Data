const express = require('express');
const {
  getZameenCategories,
  getZameenByCategory,
  searchZameenProperties,
  getZameenCities,
} = require('../controllers/zameen.controller');

const router = express.Router();

router.get('/categories', getZameenCategories);
router.get('/cities', getZameenCities);
router.get('/search', searchZameenProperties);
router.get('/category/:type', getZameenByCategory);

module.exports = router;
