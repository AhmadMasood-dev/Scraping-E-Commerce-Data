/**
 * Shared service: take raw scraped items and upsert them into MongoDB.
 * Used by both the inline search flow and the BullMQ worker.
 */
const Product = require('../models/product.model');

const upsertScrapedProducts = async (scrapedData) => {
  const upserted = [];

  for (const item of scrapedData) {
    try {
      let existingProduct = await Product.findOne({ title: new RegExp(`^${item.title}$`, 'i') });

      if (existingProduct) {
        const sourceIndex = existingProduct.price_sources.findIndex(
          s => s.store_name === item.store_name
        );

        if (sourceIndex > -1) {
          existingProduct.price_sources[sourceIndex].current_price = item.price;
          existingProduct.price_sources[sourceIndex].historical_prices.push({
            price: item.price,
            date: new Date()
          });
        } else {
          existingProduct.price_sources.push({
            store_name: item.store_name,
            url: item.url,
            current_price: item.price,
            historical_prices: [{ price: item.price, date: new Date() }]
          });
        }

        await existingProduct.save();
        upserted.push(existingProduct);
      } else {
        const created = await Product.create({
          title: item.title,
          brand: item.brand || 'Generic',
          category: item.category || 'General',
          description: item.description || '',
          image_url: item.image_url || '',
          rating: item.rating || 0,
          specifications: item.specifications || {},
          price_sources: [{
            store_name: item.store_name,
            url: item.url,
            current_price: item.price,
            historical_prices: [{ price: item.price, date: new Date() }]
          }]
        });
        upserted.push(created);
      }
    } catch (err) {
      console.error(`[Upsert] Failed for item "${item.title}":`, err.message);
    }
  }

  return upserted;
};

module.exports = { upsertScrapedProducts };
