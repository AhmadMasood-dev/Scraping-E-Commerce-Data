const express = require('express');
const {
  getZameenCategories, getZameenByCategory,
  searchZameenProperties, getZameenCities,
} = require('../controllers/zameen.controller');
const { validate } = require('../middlewares/validate');
const { zameenSearchQuery, zameenCategoryParams } = require('../validators/zameen.schema');

const router = express.Router();

router.get('/categories', getZameenCategories);
router.get('/cities', getZameenCities);
router.get('/search', validate(zameenSearchQuery), searchZameenProperties);
router.get('/category/:type', validate(zameenCategoryParams), getZameenByCategory);

module.exports = router;
