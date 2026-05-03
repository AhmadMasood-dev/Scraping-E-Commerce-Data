const Product = require('../models/product.model');
const { scrapePlatforms } = require('../scrapers');
const { upsertScrapedProducts } = require('../services/scraper.service');

// Simple in-memory cache to avoid hammering MongoDB on every landing page request
const cache = { landingData: null, landingAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const ALL_PLATFORMS = ['telemart', 'priceoye', 'mega', 'imtiaz', 'punjab_cash_carry', 'metro'];

// @desc    Search for products and compute NLP queries
// @route   GET /api/v1/products/search?q=&lang=
// @access  Public
const searchProducts = async (req, res) => {
  try {
    const { q, lang = 'en' } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, message: 'Please provide a search query' });
    }

    // 1. NLP Transliteration
    const { processQuery } = require('../nlp/transliterate');
    const translatedQuery = processQuery(q, lang);

    // 2. Query MongoDB — full text first, then fallback regex
    let products = await Product.find({
      $text: { $search: translatedQuery }
    }).sort({ score: { $meta: 'textScore' } }).lean();

    if (products.length === 0) {
      products = await Product.find({
        title: { $regex: translatedQuery, $options: 'i' }
      }).lean();
    }

    // 3. If DB has enough data, return it immediately
    if (products.length >= 5) {
      return res.status(200).json({ success: true, data: products });
    }

    // 4. Not enough data — run scrapers DIRECTLY (no Redis/queue dependency)
    console.log(`[Search] DB miss for "${translatedQuery}" — running live parallel scrape across ${ALL_PLATFORMS.length} platforms...`);

    let scrapedItems = [];
    try {
      scrapedItems = await scrapePlatforms(translatedQuery, ALL_PLATFORMS);
    } catch (scrapeErr) {
      console.error('[Search] Scrape failed:', scrapeErr.message);
    }

    if (scrapedItems.length > 0) {
      // 1. Relevance Filtering: Ensure titles match query keywords
      // This prevents electronics stores from showing "trending" phones when you search for "shirts"
      const queryKeywords = translatedQuery.toLowerCase().split(/\s+/).filter(k => k.length > 1);
      const filteredItems = scrapedItems.filter(item => {
        const title = item.title.toLowerCase();
        // Return true if any keyword matches (or if query is too short to filter)
        return queryKeywords.length === 0 || queryKeywords.some(kw => title.includes(kw));
      });

      if (filteredItems.length === 0) {
        console.log(`[Search] ${scrapedItems.length} items scraped, but none matched keyword filter for "${translatedQuery}". Skipping store display.`);
      } else {
        console.log(`[Search] Upserting ${filteredItems.length} items from scrape to MongoDB...`);

        // Upsert filtered items — order is preserved
        const savedDocs = await upsertScrapedProducts(filteredItems);

        // 2. Return ONE representative per store (only from the items we JUST scraped)
        const seenStores = new Set();
        const storeResults = [];

        // We iterate through filteredItems to find the first occurrence of each store
        for (let i = 0; i < filteredItems.length; i++) {
          const item = filteredItems[i];
          const doc = savedDocs[i];
          
          if (!seenStores.has(item.store_name)) {
            seenStores.add(item.store_name);
            storeResults.push({
              _id: doc._id,
              store_name: item.store_name,
              title: item.title,       // Use the specific title from the scrape
              description: item.description || doc.description, 
              rating: item.rating ?? doc.rating,
              price: item.price, 
              reviews: item.reviews ?? doc.reviews,
              url: item.url, 
              brand: item.brand || doc.brand,
              category: item.category || doc.category,
              image_url: item.image_url || doc.image_url,
            });
          }
        }

        return res.status(200).json({
          success: true,
          data: [],              // Empty — no grouped DB docs for this fresh scrape
          store_results: storeResults,
          scraped: true
        });
      }
    }

    // 5. Scrapers returned nothing — still return whatever was in the DB (may be empty)
    return res.status(202).json({
      success: true,
      message: 'No data found locally or via live scrape. Please try a different query.',
      data: products
    });

  } catch (error) {
    console.error('[Search] Unexpected error:', error);
    return res.status(500).json({ success: false, message: 'Server Error on Search' });
  }
};

// @desc    Get product by ID
// @route   GET /api/v1/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error(error);
    if(error.kind === 'ObjectId') {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(500).json({ success: false, message: 'Server Error fetching product' });
  }
};

// @desc    Add product to wishlist/alerts
// @route   POST /api/v1/products/:id/alerts
// @access  Private
const setProductAlert = async (req, res) => {
  try {
    const productId = req.params.id;
    const user = req.user; // Appended by protect middleware

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Product added to alerts successfully',
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server Error setting alert' });
  }
};

// @desc    Get organized data for the Landing Page
// @route   GET /api/v1/products/landing
// @access  Public
const getLandingPageData = async (req, res) => {
  try {
    // Serve from cache if still fresh
    const now = Date.now();
    if (cache.landingData && now - cache.landingAt < CACHE_TTL_MS) {
      return res.status(200).json({ success: true, data: cache.landingData, cached: true });
    }

    const aggregationPipeline = [
      {
        $group: {
          _id: '$category',
          products: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          category: '$_id',
          products: { $slice: ['$products', 8] },
          _id: 0
        }
      },
      { $sort: { category: 1 } },
      { $limit: 10 }
    ];

    const aggregated = await Product.aggregate(aggregationPipeline);

    const results = {};
    aggregated.forEach(group => {
      results[group.category || 'Featured'] = group.products;
    });

    // Store in cache
    cache.landingData = results;
    cache.landingAt = now;

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error fetching landing page data' });
  }
};

// @desc    Get all products (Paginated)
// @route   GET /api/v1/products
// @access  Public
const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const products = await Product.find().skip(skip).limit(limit);
    const total = await Product.countDocuments();

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error fetching products' });
  }
};

// @desc    Get products by category (Paginated)
// @route   GET /api/v1/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Exact or case-insensitive match for category
    const categoryQuery = { category: new RegExp(`^${req.params.category}$`, 'i') };

    const products = await Product.find(categoryQuery).skip(skip).limit(limit);
    const total = await Product.countDocuments(categoryQuery);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error fetching category products' });
  }
};

module.exports = {
  searchProducts,
  getProductById,
  setProductAlert,
  getLandingPageData,
  getAllProducts,
  getProductsByCategory
};
