const ZameenProperty = require('../models/zameen.model');

// ── GET /api/v1/zameen/categories ─────────────────────────────────────────────
// Returns the distinct property types + city list and a sample of listings
// per property_type (like the landing page does for products)
exports.getZameenCategories = async (req, res) => {
  try {
    const propertyTypes = await ZameenProperty.distinct('property_type');

    // Build an object: { 'Flat': [...10 items], 'House': [...10 items], ... }
    const result = {};

    await Promise.all(
      propertyTypes
        .filter(Boolean)
        .map(async (type) => {
          const samples = await ZameenProperty.find({ property_type: type })
            .limit(10)
            .select('property_id property_type price location city province_name baths bedrooms area area_type area_size area_category purpose date_added latitude longitude page_url')
            .lean();
          if (samples.length > 0) result[type] = samples;
        })
    );

    res.status(200).json({
      success: true,
      data: result,
      total_types: Object.keys(result).length,
    });
  } catch (err) {
    console.error('getZameenCategories error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ── GET /api/v1/zameen/category/:type ────────────────────────────────────────
// Returns paginated listings for a specific property type
exports.getZameenByCategory = async (req, res) => {
  try {
    const { type } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { property_type: { $regex: new RegExp(`^${type}$`, 'i') } };
    const [total, properties] = await Promise.all([
      ZameenProperty.countDocuments(filter),
      ZameenProperty.find(filter)
        .skip(skip)
        .limit(limit)
        .select('property_id property_type price location city province_name baths bedrooms area area_type area_size area_category purpose date_added latitude longitude page_url agency agent')
        .lean()
    ]);

    res.status(200).json({
      success: true,
      data: properties,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (err) {
    console.error('getZameenByCategory error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ── GET /api/v1/zameen/search ─────────────────────────────────────────────────
// Query params: q, city, property_type, purpose, min_price, max_price, bedrooms, baths
// page, limit
exports.searchZameenProperties = async (req, res) => {
  try {
    const {
      q, city, property_type, purpose,
      min_price, max_price, bedrooms, baths,
    } = req.query;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};

    // Free-text search across location & city
    if (q) {
      filter.$or = [
        { location:      { $regex: q, $options: 'i' } },
        { city:          { $regex: q, $options: 'i' } },
        { province_name: { $regex: q, $options: 'i' } },
        { property_type: { $regex: q, $options: 'i' } },
        { area_category: { $regex: q, $options: 'i' } },
      ];
    }

    if (city)          filter.city          = { $regex: city, $options: 'i' };
    if (property_type) filter.property_type = { $regex: property_type, $options: 'i' };
    if (purpose)       filter.purpose       = { $regex: purpose, $options: 'i' };
    if (bedrooms)      filter.bedrooms      = parseInt(bedrooms);
    if (baths)         filter.baths         = parseInt(baths);

    if (min_price || max_price) {
      filter.price = {};
      if (min_price) filter.price.$gte = parseInt(min_price);
      if (max_price) filter.price.$lte = parseInt(max_price);
    }

    const [total, properties] = await Promise.all([
      ZameenProperty.countDocuments(filter),
      ZameenProperty.find(filter)
        .skip(skip)
        .limit(limit)
        .select('property_id property_type price location city province_name baths bedrooms area area_type area_size area_category purpose date_added latitude longitude page_url agency agent')
        .lean()
    ]);

    res.status(200).json({
      success: true,
      data: properties,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (err) {
    console.error('searchZameenProperties error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ── GET /api/v1/zameen/cities ─────────────────────────────────────────────────
// Returns list of distinct cities for filter dropdowns
exports.getZameenCities = async (req, res) => {
  try {
    const cities = await ZameenProperty.distinct('city');
    res.status(200).json({ success: true, data: cities.filter(Boolean).sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
