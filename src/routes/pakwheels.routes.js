const express = require('express');
const {
  searchVehicles, getMakes, getBodyTypes, getCities, getCategoriesByMake, getVehicleById,
} = require('../controllers/pakwheels.controller');
const { validate } = require('../middlewares/validate');
const { pakwheelsSearchQuery, idParam } = require('../validators/pakwheels.schema');

const router = express.Router();

router.get('/categories', getCategoriesByMake);
router.get('/makes', getMakes);
router.get('/body-types', getBodyTypes);
router.get('/cities', getCities);
router.get('/search', validate(pakwheelsSearchQuery), searchVehicles);
router.get('/:id', validate(idParam), getVehicleById);

module.exports = router;
