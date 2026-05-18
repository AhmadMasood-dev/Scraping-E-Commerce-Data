const crypto = require('crypto');
const ZameenProperty = require('../models/zameen.model');
const cache = require('../config/cache');

const SELECT_FIELDS = 'property_id property_type price location city province_name baths bedrooms area area_type area_size area_category purpose date_added latitude longitude page_url agency agent';

// ─── GET /api/v1/zameen/categories ──────────────────────────────────────────
exports.getZameenCategories = async (_req, res) => {
  const { value, fromCache } = await cache.wrap('zameen:categories', 600, async () => {
    const propertyTypes = await ZameenProperty.distinct('property_type');
    const result = {};
    await Promise.all(
      propertyTypes.filter(Boolean).map(async (type) => {
        const samples = await ZameenProperty.find({ property_type: type })
          .limit(10).select(SELECT_FIELDS).lean();
        if (samples.length > 0) result[type] = samples;
      })
    );
    return result;
  });
  res.status(200).json({ success: true, data: value, total_types: Object.keys(value).length, meta: { fromCache } });
};

// ─── GET /api/v1/zameen/category/:type ──────────────────────────────────────
exports.getZameenByCategory = async (req, res) => {
  const { type } = req.params;
  const { page, limit } = req.query;
  const skip = (page - 1) * limit;
  const filter = { property_type: { $regex: new RegExp(`^${type}$`, 'i') } };
  const [total, properties] = await Promise.all([
    ZameenProperty.countDocuments(filter),
    ZameenProperty.find(filter).skip(skip).limit(limit).select(SELECT_FIELDS).lean(),
  ]);
  res.status(200).json({ success: true, data: properties, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
};

// ─── GET /api/v1/zameen/search ──────────────────────────────────────────────
exports.searchZameenProperties = async (req, res) => {
  const { q, city, property_type, purpose, min_price, max_price, bedrooms, baths, page, limit } = req.query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (q) {
    filter.$or = [
      { location: { $regex: q, $options: 'i' } },
      { city: { $regex: q, $options: 'i' } },
      { province_name: { $regex: q, $options: 'i' } },
      { property_type: { $regex: q, $options: 'i' } },
      { area_category: { $regex: q, $options: 'i' } },
    ];
  }
  if (city) filter.city = { $regex: city, $options: 'i' };
  if (property_type) filter.property_type = { $regex: property_type, $options: 'i' };
  if (purpose) filter.purpose = { $regex: purpose, $options: 'i' };
  if (bedrooms !== undefined) filter.bedrooms = bedrooms;
  if (baths !== undefined) filter.baths = baths;
  if (min_price !== undefined || max_price !== undefined) {
    filter.price = {};
    if (min_price !== undefined) filter.price.$gte = min_price;
    if (max_price !== undefined) filter.price.$lte = max_price;
  }

  const hash = crypto.createHash('md5').update(JSON.stringify({ filter, page, limit })).digest('hex');
  const cacheKey = `zameen:search:${hash}`;

  const { value, fromCache } = await cache.wrap(cacheKey, 600, async () => {
    const [total, properties] = await Promise.all([
      ZameenProperty.countDocuments(filter),
      ZameenProperty.find(filter).skip(skip).limit(limit).select(SELECT_FIELDS).lean(),
    ]);
    return { total, properties };
  });

  res.status(200).json({
    success: true,
    data: value.properties,
    pagination: { total: value.total, page, pages: Math.ceil(value.total / limit), limit },
    meta: { fromCache },
  });
};

// ─── GET /api/v1/zameen/cities ──────────────────────────────────────────────
exports.getZameenCities = async (_req, res) => {
  const { value, fromCache } = await cache.wrap('zameen:cities', 3600, async () => {
    const cities = await ZameenProperty.distinct('city');
    return cities.filter(Boolean).sort();
  });
  res.status(200).json({ success: true, data: value, meta: { fromCache } });
};
