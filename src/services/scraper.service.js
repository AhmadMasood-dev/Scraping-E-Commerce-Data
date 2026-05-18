/**
 * Take raw scraped items and persist them as INDIVIDUAL product records.
 *
 * Dedup is keyed on { store_name, native_id || url } — i.e. the same listing
 * from the same store updates in place; everything else creates a new doc. We
 * deliberately do NOT collapse 20 store items into 1 by title — each listing
 * on a search-results page becomes its own Product so the comparison view can
 * pick the first item per store.
 *
 * Price history is appended only when the price actually changed (reduces
 * write load and keeps the time series meaningful).
 */
const Product = require('../models/product.model');
const logger = require('../config/logger');

/**
 * Normalize brand strings before persistence so "Samsung ", " samsung", "SAMSUNG"
 * all collapse to "Samsung". Prevents catalog fragmentation across scrapes.
 */
const normalizeBrand = (raw) => {
  const cleaned = (raw || '').toString().trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Unknown';
  // Title-case the brand (preserves all-caps acronyms like "HP" or "LG")
  return cleaned.length <= 3
    ? cleaned.toUpperCase()
    : cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};

const upsertScrapedProducts = async (scrapedItems) => {
  const upserted = [];

  for (const item of scrapedItems) {
    try {
      // Normalize brand in place so dedup/grouping queries match consistently
      item.brand = normalizeBrand(item.brand);
      const sourceKey = item.native_id || item.url;
      // Match an existing doc that already has THIS exact source from THIS store
      const existing = await Product.findOne({
        price_sources: { $elemMatch: { store_name: item.store_name, $or: [{ native_id: sourceKey }, { url: item.url }] } },
      });

      if (existing) {
        const sourceIdx = existing.price_sources.findIndex((s) =>
          s.store_name === item.store_name && (s.native_id === sourceKey || s.url === item.url)
        );
        if (sourceIdx > -1) {
          const src = existing.price_sources[sourceIdx];
          if (src.current_price !== item.price) {
            src.current_price = item.price;
            src.historical_prices.push({ price: item.price, date: new Date() });
          }
          src.url = item.url;
          src.native_id = sourceKey;
        }
        // Keep top-level fields fresh
        if (item.image_url) existing.image_url = item.image_url;
        if (item.rating) existing.rating = item.rating;
        await existing.save();
        upserted.push(existing);
        continue;
      }

      // New listing → create a dedicated product doc
      const created = await Product.create({
        title: item.title,
        brand: item.brand || 'Generic',
        category: item.category || 'General',
        description: item.description || '',
        image_url: item.image_url || '',
        rating: item.rating || 0,
        reviews: item.reviews || 0,
        position: item.position ?? 0,
        store_key: item.store_key,
        match_key: (item.title || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        specifications: item.specifications || {},
        price_sources: [{
          store_name: item.store_name,
          native_id: sourceKey,
          url: item.url,
          current_price: item.price,
          historical_prices: [{ price: item.price, date: new Date() }],
        }],
      });
      upserted.push(created);
    } catch (err) {
      logger.error(`[Upsert] Failed for "${item.title}" (${item.store_name}): ${err.message}`);
    }
  }

  return upserted;
};

module.exports = { upsertScrapedProducts };
