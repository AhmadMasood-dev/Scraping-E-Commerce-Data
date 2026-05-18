/**
 * Idempotent first-run seed. Called from server.js after DB connect.
 *
 * Logic per collection:
 *   - If documents already exist, skip (log only)
 *   - Else, seed from the project's CSV file when available
 *   - Else, fall back to a tiny in-memory mock so the UI is never empty
 *
 * Set env SKIP_AUTO_SEED=true to disable entirely.
 */
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Product = require('../models/product.model');
const ZameenProperty = require('../models/zameen.model');
const PakWheelsVehicle = require('../models/pakwheels.model');
const logger = require('../config/logger');

const ROOT = path.join(__dirname, '..', '..');

const KAGGLE_MOCK = [
  {
    title: 'iPhone 15 Pro Max 256GB Natural Titanium', brand: 'Apple', category: 'Mobile',
    description: 'Latest iPhone with A17 Pro chip and titanium design.', rating: 4.8,
    specifications: { storage: '256GB', color: 'Natural Titanium', ram: '8GB' },
    price_sources: [{ store_name: 'Kaggle_Seed', native_id: 'ip15pm-256', url: 'https://example.com/ip15pm', current_price: 360000, historical_prices: [{ price: 360000, date: new Date() }] }],
  },
  {
    title: 'Samsung Galaxy S23 Ultra', brand: 'Samsung', category: 'Mobile',
    description: 'Galaxy S23 Ultra with 200MP camera.', rating: 4.7,
    specifications: { storage: '512GB', ram: '12GB' },
    price_sources: [{ store_name: 'Kaggle_Seed', native_id: 'sam-s23u', url: 'https://example.com/sams23u', current_price: 300000, historical_prices: [{ price: 300000, date: new Date() }] }],
  },
  {
    title: 'Dell XPS 15', brand: 'Dell', category: 'Laptop',
    description: 'Premium laptop with 15.6-inch OLED display.', rating: 4.5,
    specifications: { processor: 'Core i7', ram: '16GB', storage: '1TB SSD' },
    price_sources: [{ store_name: 'Kaggle_Seed', native_id: 'dell-xps15', url: 'https://example.com/xps15', current_price: 450000, historical_prices: [{ price: 450000, date: new Date() }] }],
  },
  {
    title: 'Sony WF-1000XM5 Earbuds', brand: 'Sony', category: 'Earbuds',
    description: 'Industry-leading noise cancellation in true wireless earbuds.', rating: 4.6,
    specifications: { battery: '8h', noise_cancel: 'yes' },
    price_sources: [{ store_name: 'Kaggle_Seed', native_id: 'sony-wfxm5', url: 'https://example.com/wfxm5', current_price: 75000, historical_prices: [{ price: 75000, date: new Date() }] }],
  },
  {
    title: 'Apple Watch Series 9 GPS 45mm', brand: 'Apple', category: 'Watch',
    description: 'Apple Watch with always-on Retina display.', rating: 4.7,
    specifications: { size: '45mm', connectivity: 'GPS' },
    price_sources: [{ store_name: 'Kaggle_Seed', native_id: 'aw-s9-45', url: 'https://example.com/aw9', current_price: 120000, historical_prices: [{ price: 120000, date: new Date() }] }],
  },
  {
    title: 'Logitech MX Master 3S', brand: 'Logitech', category: 'General',
    description: 'Wireless productivity mouse with quiet clicks.', rating: 4.7,
    specifications: { dpi: '8000', buttons: 7 },
    price_sources: [{ store_name: 'Kaggle_Seed', native_id: 'mxm3s', url: 'https://example.com/mxm3s', current_price: 28000, historical_prices: [{ price: 28000, date: new Date() }] }],
  },
];

const parseCsvStream = (filePath, mapRow) =>
  new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const mapped = mapRow(row);
        if (mapped) rows.push(mapped);
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const insertChunked = async (Model, docs, chunkSize, label) => {
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    await Model.insertMany(chunk, { ordered: false }).catch((e) => {
      logger.warn(`[bootstrap:${label}] chunk ${i / chunkSize} insert had ${e.writeErrors?.length || 0} errors`);
    });
  }
  logger.info(`[bootstrap:${label}] inserted ${docs.length} documents`);
};

const seedProductsIfEmpty = async () => {
  const count = await Product.countDocuments();
  if (count > 0) {
    logger.info(`[bootstrap] Products: ${count} docs already present — skipping seed`);
    return;
  }

  const csvPath = path.join(ROOT, 'data.csv');
  if (fs.existsSync(csvPath)) {
    logger.info('[bootstrap] Products empty — seeding from data.csv');
    const docs = await parseCsvStream(csvPath, (row) => {
      if (!row.title) return null;
      let specs = {};
      if (row.specifications) {
        try { specs = JSON.parse(row.specifications.replace(/'/g, '"')); } catch (_e) { /* ignore */ }
      }
      let imageUrl = '';
      if (row.imgs) {
        try {
          const arr = JSON.parse(row.imgs.replace(/'/g, '"'));
          if (Array.isArray(arr) && arr.length > 0) imageUrl = arr[0];
        } catch (_e) { imageUrl = row.imgs; }
      }
      const product = {
        title: row.title,
        brand: row.brand || 'Unknown',
        category: row.category || 'Uncategorized',
        description: row.description || '',
        image_url: imageUrl,
        specifications: specs,
        price_sources: [],
      };
      const price = parseFloat(row.original_price);
      if (!Number.isNaN(price)) {
        product.price_sources.push({
          store_name: row.vendor || 'MEGA.PK',
          url: row.slug || row.url || '',
          current_price: price,
          historical_prices: [{ price, date: new Date() }],
        });
      }
      return product;
    });
    await insertChunked(Product, docs, 500, 'Products');
    return;
  }

  logger.info('[bootstrap] Products empty and data.csv not found — seeding Kaggle mock');
  await Product.insertMany(KAGGLE_MOCK);
  logger.info(`[bootstrap:Products] inserted ${KAGGLE_MOCK.length} mock documents`);
};

const seedZameenIfEmpty = async () => {
  const count = await ZameenProperty.countDocuments();
  if (count > 0) {
    logger.info(`[bootstrap] Zameen: ${count} docs already present — skipping seed`);
    return;
  }
  const csvPath = path.join(ROOT, 'zameen-updated.csv');
  if (!fs.existsSync(csvPath)) {
    logger.warn('[bootstrap] zameen-updated.csv not found — Zameen DB will remain empty');
    return;
  }
  logger.info('[bootstrap] Zameen empty — seeding from zameen-updated.csv (this may take ~30s)');

  const parseNum = (v) => {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  const docs = await parseCsvStream(csvPath, (row) => ({
    property_id: parseNum(row['property_id']),
    location_id: parseNum(row['location_id']),
    page_url: row['page_url'] || null,
    property_type: row['property_type'] || null,
    price: parseNum(row['price']),
    location: row['location'] || null,
    city: row['city'] || null,
    province_name: row['province_name'] || null,
    latitude: parseNum(row['latitude']),
    longitude: parseNum(row['longitude']),
    baths: parseNum(row['baths']),
    area: row['area'] || null,
    purpose: row['purpose'] || null,
    bedrooms: parseNum(row['bedrooms']),
    date_added: row['date_added'] || null,
    agency: row['agency'] || null,
    agent: row['agent'] || null,
    area_type: row['Area Type'] || null,
    area_size: parseNum(row['Area Size']),
    area_category: row['Area Category'] || null,
  }));
  await insertChunked(ZameenProperty, docs, 1000, 'Zameen');
};

// ─── PakWheels (Kaggle usedCars.json) ────────────────────────────────────────
// 55k+ records. File is ~2.7MB → JSON.parse synchronously is fine on a dev
// machine. Maps the schema.org Car shape to our PakWheelsVehicle model.

/** Parse "42,000 km" → 42000, also handles "42000 KM" / "42000". */
const parseMileage = (raw) => {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
};

/** Parse "800cc" / "1300 cc" / "1.6 L" → integer cc (rough — "1.6 L" → 16). */
const parseEngineCc = (raw) => {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
};

/** Split " Rawalpindi Punjab" or " Airport Enclave, Islamabad Islamabad" → { city, province }. */
const parseSellerLocation = (raw) => {
  if (!raw) return { city: null, province: null };
  let s = String(raw).trim();
  // If there's a comma, the part AFTER the comma is "city province"
  if (s.includes(',')) s = s.split(',').pop().trim();
  // Split on whitespace — last token is province, everything before is city
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { city: null, province: null };
  if (tokens.length === 1) return { city: tokens[0], province: null };
  const province = tokens[tokens.length - 1];
  const city = tokens.slice(0, -1).join(' ');
  return { city, province };
};

/** Map "Aug 27, 2021" → Date, else null. */
const parsePostedAt = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Map one usedCars.json record to a PakWheelsVehicle doc.
 * Returns null when the record lacks the bare minimum to be useful.
 */
const mapPakWheelsRow = (rec) => {
  if (!rec || typeof rec !== 'object') return null;

  const make = rec.brand?.name || rec.manufacturer;
  const title = rec.name;
  const price = typeof rec.price === 'number' ? rec.price : parseInt(rec.price, 10);
  if (!title || !make || !Number.isFinite(price) || price <= 0) return null;

  const { city, province } = parseSellerLocation(rec.sellerLocation);
  const extra = rec.extraFeatures || {};
  const adRef = extra['AdRef#'] || extra.AdRef || null;

  return {
    title,
    make,
    model: rec.model || null,
    year: typeof rec.modelDate === 'number' ? rec.modelDate : parseInt(rec.modelDate, 10) || null,
    mileage: parseMileage(rec.mileageFromOdometer),
    fuel_type: rec.fuelType || null,
    transmission: rec.vehicleTransmission || null,
    color: rec.color || extra.Color || null,
    city,
    province,
    price,
    condition: rec.itemCondition && rec.itemCondition.toLowerCase() === 'new' ? 'New' : 'Used',
    description: rec.description || null,
    image_urls: rec.image ? [rec.image] : [],
    seller_type: 'Individual', // dataset doesn't distinguish; default
    posted_at: parsePostedAt(rec.adLastUpdated || extra['LastUpdated:'] || extra.LastUpdated),
    source_url: adRef ? `https://www.pakwheels.com/used-cars/listing/${adRef}` : null,
    body_type: rec.bodyType || extra.BodyType || null,
    engine_capacity: parseEngineCc(rec.vehicleEngine?.engineDisplacement || extra.EngineCapacity),
    registered_in: extra.RegisteredIn || null,
    assembly: extra.Assembly || null,
    features: Array.isArray(rec.features) ? rec.features : [],
    source_ref: adRef || null,
  };
};

const seedPakWheelsIfEmpty = async () => {
  const count = await PakWheelsVehicle.countDocuments();
  if (count > 0) {
    logger.info(`[bootstrap] PakWheels: ${count} docs already present — skipping seed`);
    return;
  }
  const jsonPath = path.join(ROOT, 'usedCars.json');
  if (!fs.existsSync(jsonPath)) {
    logger.warn('[bootstrap] usedCars.json not found — PakWheels DB will remain empty');
    return;
  }
  logger.info('[bootstrap] PakWheels empty — seeding from usedCars.json (this may take ~30s)');

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    logger.error(`[bootstrap] usedCars.json parse failed: ${err.message}`);
    return;
  }
  const records = Array.isArray(raw) ? raw : (raw.usedCars || []);
  const docs = records.map(mapPakWheelsRow).filter(Boolean);
  logger.info(`[bootstrap] PakWheels: parsed ${records.length} records → ${docs.length} valid`);
  await insertChunked(PakWheelsVehicle, docs, 1000, 'PakWheels');
};

const bootstrap = async () => {
  if (process.env.SKIP_AUTO_SEED === 'true') {
    logger.info('[bootstrap] SKIP_AUTO_SEED=true — auto-seed disabled');
    return;
  }
  try {
    await Promise.all([
      seedProductsIfEmpty(),
      seedZameenIfEmpty(),
      seedPakWheelsIfEmpty(),
    ]);
  } catch (err) {
    logger.error(`[bootstrap] auto-seed failed: ${err.message}`);
  }
};

module.exports = { bootstrap, seedProductsIfEmpty, seedZameenIfEmpty, seedPakWheelsIfEmpty };
