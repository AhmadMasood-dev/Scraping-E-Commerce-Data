/**
 * One-off cleanup: removes Product documents created by the OLD scraper that
 * stored the store's search-page URL on every item. Preserves Kaggle_Seed and
 * CSV-imported (MEGA.PK) records.
 *
 * Run with: node src/seed/cleanupLegacyScrapes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const connectDB = require('../config/db');
const logger = require('../config/logger');

const LIVE_SCRAPE_STORES = [
  'Telemart', 'Daraz', 'PriceOye', 'Mega',
  'Imtiaz', 'Punjab Cash & Carry', 'Metro',
];

const run = async () => {
  await connectDB();
  logger.info(`Connected to ${mongoose.connection.name}`);

  // Match docs where ANY price_source is from a live-scrape store AND its url
  // looks like a search-results page (no #item- fragment, contains ?q= or /search).
  // Kaggle_Seed and MEGA.PK CSV imports never match.
  const filter = {
    price_sources: {
      $elemMatch: {
        store_name: { $in: LIVE_SCRAPE_STORES },
        url: { $regex: /\/search\?|\?q=/, $options: 'i' },
        // exclude per-item URLs (which contain #item- fragment)
        $nor: [{ url: { $regex: /#item-/ } }],
      },
    },
  };

  const matched = await Product.countDocuments(filter);
  logger.info(`Found ${matched} legacy scraped products with search-page URLs`);

  if (matched === 0) {
    logger.info('Nothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  const result = await Product.deleteMany(filter);
  logger.info(`Deleted ${result.deletedCount} legacy documents`);

  await mongoose.disconnect();
};

run().catch((err) => {
  logger.error(`Cleanup failed: ${err.message}`);
  process.exit(1);
});
