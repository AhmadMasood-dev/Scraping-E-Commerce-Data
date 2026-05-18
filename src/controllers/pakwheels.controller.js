const crypto = require('crypto');
const PakWheelsVehicle = require('../models/pakwheels.model');
const cache = require('../config/cache');
const { NotFoundError } = require('../errors/AppError');

const SORT_MAP = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  year_desc: { year: -1 },
  newest: { posted_at: -1, createdAt: -1 },
};

exports.searchVehicles = async (req, res) => {
  const { q, make, model, city, fuel_type, transmission, condition,
    body_type, province, assembly,
    min_year, max_year, min_price, max_price, sort, page, limit } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (q) filter.$text = { $search: q };
  if (make) filter.make = { $regex: `^${make}$`, $options: 'i' };
  if (model) filter.model = { $regex: `^${model}$`, $options: 'i' };
  if (city) filter.city = { $regex: city, $options: 'i' };
  if (fuel_type) filter.fuel_type = { $regex: fuel_type, $options: 'i' };
  if (transmission) filter.transmission = { $regex: transmission, $options: 'i' };
  if (condition) filter.condition = condition;
  if (body_type) filter.body_type = { $regex: `^${body_type}$`, $options: 'i' };
  if (province) filter.province = { $regex: `^${province}$`, $options: 'i' };
  if (assembly) filter.assembly = { $regex: `^${assembly}$`, $options: 'i' };
  if (min_year !== undefined || max_year !== undefined) {
    filter.year = {};
    if (min_year !== undefined) filter.year.$gte = min_year;
    if (max_year !== undefined) filter.year.$lte = max_year;
  }
  if (min_price !== undefined || max_price !== undefined) {
    filter.price = {};
    if (min_price !== undefined) filter.price.$gte = min_price;
    if (max_price !== undefined) filter.price.$lte = max_price;
  }

  const sortSpec = SORT_MAP[sort] || { posted_at: -1 };
  const hash = crypto.createHash('md5').update(JSON.stringify({ filter, sortSpec, page, limit })).digest('hex');
  const cacheKey = `pakwheels:search:${hash}`;

  const { value, fromCache } = await cache.wrap(cacheKey, 600, async () => {
    const [total, vehicles] = await Promise.all([
      PakWheelsVehicle.countDocuments(filter),
      PakWheelsVehicle.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
    ]);
    return { total, vehicles };
  });

  res.status(200).json({
    success: true,
    data: value.vehicles,
    pagination: { total: value.total, page, pages: Math.ceil(value.total / limit), limit },
    meta: { fromCache },
  });
};

exports.getMakes = async (_req, res) => {
  const { value, fromCache } = await cache.wrap('pakwheels:makes', 3600, async () => {
    const makes = await PakWheelsVehicle.distinct('make');
    return makes.filter(Boolean).sort();
  });
  res.status(200).json({ success: true, data: value, meta: { fromCache } });
};

exports.getBodyTypes = async (_req, res) => {
  const { value, fromCache } = await cache.wrap('pakwheels:body-types', 3600, async () => {
    const types = await PakWheelsVehicle.distinct('body_type');
    return types.filter(Boolean).sort();
  });
  res.status(200).json({ success: true, data: value, meta: { fromCache } });
};

exports.getCities = async (_req, res) => {
  const { value, fromCache } = await cache.wrap('pakwheels:cities', 3600, async () => {
    const cities = await PakWheelsVehicle.distinct('city');
    return cities.filter(Boolean).sort();
  });
  res.status(200).json({ success: true, data: value, meta: { fromCache } });
};

exports.getCategoriesByMake = async (_req, res) => {
  const makes = await PakWheelsVehicle.distinct('make');
  const result = {};
  await Promise.all(
    makes.filter(Boolean).slice(0, 10).map(async (make) => {
      const samples = await PakWheelsVehicle.find({ make }).limit(8).lean();
      if (samples.length > 0) result[make] = samples;
    })
  );
  res.status(200).json({ success: true, data: result, total_makes: Object.keys(result).length });
};

exports.getVehicleById = async (req, res) => {
  const vehicle = await PakWheelsVehicle.findById(req.params.id).lean();
  if (!vehicle) throw new NotFoundError('Vehicle');
  res.status(200).json({ success: true, data: vehicle });
};
