const Product = require('../models/product.model');
const SearchQuery = require('../models/searchQuery.model');
const { scrapePlatforms } = require('../scrapers');
const { upsertScrapedProducts } = require('../services/scraper.service');
const { processQuery } = require('../nlp/processor');
const { rankAndCap } = require('../scrapers/utils/relevance');
const productMatcher = require('../scrapers/utils/productMatcher');
const cache = require('../config/cache');
const logger = require('../config/logger');
const { NotFoundError } = require('../errors/AppError');

const ALL_PLATFORMS = ['telemart', 'priceoye', 'mega', 'imtiaz', 'punjab_cash_carry', 'metro'];
// Per-store cap. With 1, each store contributes at most one record — its single
// most-relevant item ranked across the items the scraper returned. Stores that
// return zero results contribute nothing.
const MAX_ITEMS_PER_STORE = 1;
// Minimum relevance score for an item to survive ranking. Below this, the
// store's "best" match is just noise. Tuned empirically:
//   - "Apple iPhone 15" for "iphone 15" → ~0.97 (perfect, all keywords match)
//   - "Redmi 15" for "iphone 15"        → ~0.43 (only "15" matches)
//   - "Boxing Gloves 15" for "iphone 15"→ ~0.33
//   - "Durex Play" for "samsung galaxy" → ~0.05 (zero keyword overlap)
// 0.45 keeps fully on-topic items while dropping items that only share one
// numeric token or rating-boost noise.
const MIN_RELEVANCE_SCORE = 0.45;

// ─── GET /api/v1/products/search?q=&lang= ────────────────────────────────────
const searchProducts = async (req, res) => {
  const startedAt = Date.now();
  const { q, lang } = req.query;

  // 1. NLP
  const nlp = await processQuery(q, lang);
  const cacheKey = `search:${nlp.normalized || nlp.original.toLowerCase()}`;

  // 2. Cache check
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({ ...cached, meta: { ...cached.meta, fromCache: true } });
  }

  // 3. DB fast path
  let dbProducts = await Product.find({ $text: { $search: nlp.translated || nlp.original } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(20)
    .lean();
  if (dbProducts.length === 0) {
    dbProducts = await Product.find({ title: { $regex: nlp.translated || nlp.original, $options: 'i' } })
      .limit(20)
      .lean();
  }

  if (dbProducts.length >= 5) {
    const payload = {
      success: true,
      data: dbProducts,
      store_results: [],
      scraped: false,
      meta: {
        nlp: { language: nlp.language, translated: nlp.translated, keywords: nlp.keywords, units: nlp.units },
        durationMs: Date.now() - startedAt,
        fromCache: false,
        totalStores: 0,
        successfulStores: [],
        failedStores: [],
      },
    };
    await cache.set(cacheKey, payload, 600);
    SearchQuery.create({ original: q, language: nlp.language, translated: nlp.translated, keywords: nlp.keywords, normalized: nlp.normalized, resultCount: dbProducts.length, fromCache: false, durationMs: payload.meta.durationMs }).catch(() => {});
    return res.status(200).json(payload);
  }

  // 4. Live scrape — keep mocks; infrastructure hardened (stealth, retry, p-map equivalent)
  logger.info(`[Search] DB miss for "${nlp.translated}" — running live parallel scrape across ${ALL_PLATFORMS.length} platforms`);
  let scrapeResult = { items: [], meta: { totalStores: ALL_PLATFORMS.length, successfulStores: [], failedStores: [], durationMs: 0 } };
  try {
    scrapeResult = await scrapePlatforms(nlp.translated || q, ALL_PLATFORMS);
  } catch (err) {
    logger.error(`[Search] scrape orchestration failed: ${err.message}`);
  }

  // 5. Group raw items by store, then per-store: relevance-rank + keep top N.
  //    With MAX_ITEMS_PER_STORE=1, each store contributes only its single
  //    most-relevant item — saving exactly one DB record per store with hits,
  //    and zero records for stores that returned nothing.
  const queryKeywords = (nlp.keywords.length ? nlp.keywords : (nlp.translated || q).toLowerCase().split(/\s+/))
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k && k.length > 1);

  const byStore = new Map();
  for (const item of scrapeResult.items) {
    if (!byStore.has(item.store_name)) byStore.set(item.store_name, []);
    byStore.get(item.store_name).push(item);
  }

  const cappedPerStore = new Map(); // store_name -> ranked top-N items
  const flatToPersist = [];
  for (const [storeName, storeItems] of byStore.entries()) {
    const ranked = rankAndCap(storeItems, queryKeywords, MAX_ITEMS_PER_STORE);
    // Drop items that scored below the relevance floor — these are stores
    // whose search engine returned items unrelated to the query (e.g.,
    // Telemart's trending grid). Keeping them would pollute the comparison.
    const filtered = ranked.filter((it) => (it._score || 0) >= MIN_RELEVANCE_SCORE);
    if (filtered.length === 0 && ranked.length > 0) {
      logger.info(`[Search] dropping ${storeName} — top item scored ${(ranked[0]._score || 0).toFixed(3)} < ${MIN_RELEVANCE_SCORE}`);
    }
    cappedPerStore.set(storeName, filtered);
    flatToPersist.push(...filtered);
  }

  // 6. Persist the capped, ranked items as INDIVIDUAL Product records
  let savedDocs = [];
  if (flatToPersist.length > 0) {
    savedDocs = await upsertScrapedProducts(flatToPersist);
    logger.info(`[Search] Upserted ${savedDocs.length} per-item records (top ${MAX_ITEMS_PER_STORE} per store)`);
  } else if (scrapeResult.items.length === 0) {
    // Every store returned zero — typically a sign of selector breakage,
    // anti-bot blocking, or a genuinely unseen query. Log so it's debuggable.
    logger.warn(`[Search] all ${scrapeResult.meta.totalStores} stores returned 0 items for "${q}" — check selectors or query`);
  }

  // 7. Build native_id → saved-doc lookup
  const docByNativeId = new Map();
  for (let i = 0; i < flatToPersist.length; i++) {
    const it = flatToPersist[i];
    if (savedDocs[i]) docByNativeId.set(it.native_id, savedDocs[i]);
  }

  // 8. Pick the SINGLE most-relevant item across all stores, then find its
  //    cross-store matches via title-similarity clustering. The result is one
  //    "primary" product with a per-store price comparison. If no other stores
  //    have a similar item, the primary just contains the single source — UI
  //    renders a single card with no comparison row.
  let primary = null;
  if (flatToPersist.length > 0) {
    const allRanked = [...flatToPersist].sort((a, b) => (b._score || 0) - (a._score || 0));
    const top = allRanked[0];
    const clusters = productMatcher.group(allRanked);
    const cluster = clusters.find((c) => c.some((it) => it.native_id === top.native_id)) || [top];

    // Best variant per store within the cluster (highest-scored if multiple)
    const storeMap = new Map();
    for (const it of cluster) {
      const existing = storeMap.get(it.store_name);
      if (!existing || (existing._score || 0) < (it._score || 0)) storeMap.set(it.store_name, it);
    }

    const comparisons = Array.from(storeMap.values())
      .map((it) => ({
        store_name: it.store_name,
        price: it.price,
        url: it.url,
        rating: it.rating,
        reviews: it.reviews,
        product_id: docByNativeId.get(it.native_id)?._id,
        title: it.title,
        image_url: it.image_url,
      }))
      .sort((a, b) => (a.price || 0) - (b.price || 0));   // cheapest first

    primary = {
      title: top.title,
      description: top.description,
      image_url: top.image_url,
      rating: top.rating,
      category: top.category,
      brand: top.brand,
      cheapest_store: comparisons[0]?.store_name,
      comparisons,
      has_comparison: comparisons.length > 1,
    };
  }

  // 9. Backward-compat: also return the per-store representative grid (rank 0
  //    of each store), unchanged.
  const representatives = [];
  for (const [, ranked] of cappedPerStore.entries()) {
    if (ranked.length === 0) continue;
    const docTop = ranked[0];
    const doc = docByNativeId.get(docTop.native_id);
    if (doc) representatives.push({ item: docTop, doc });
  }
  const storeResults = representatives.map(({ item, doc }) => ({
    _id: doc._id,
    store_name: item.store_name,
    title: item.title,
    description: item.description,
    rating: item.rating,
    price: item.price,
    reviews: item.reviews,
    url: item.url,
    brand: item.brand,
    category: item.category,
    image_url: item.image_url,
  }));

  const payload = {
    success: true,
    data: dbProducts,
    primary,
    store_results: storeResults,
    scraped: storeResults.length > 0,
    meta: {
      nlp: { language: nlp.language, translated: nlp.translated, keywords: nlp.keywords, units: nlp.units },
      durationMs: Date.now() - startedAt,
      fromCache: false,
      totalStores: scrapeResult.meta.totalStores,
      successfulStores: scrapeResult.meta.successfulStores,
      failedStores: scrapeResult.meta.failedStores,
      itemsScraped: scrapeResult.items.length,
      itemsPersisted: savedDocs.length,
      itemsPerStoreCap: MAX_ITEMS_PER_STORE,
    },
  };

  if (storeResults.length > 0 || dbProducts.length > 0) {
    await cache.set(cacheKey, payload, 600);
  }

  SearchQuery.create({
    original: q, language: nlp.language, translated: nlp.translated, keywords: nlp.keywords,
    normalized: nlp.normalized, resultCount: storeResults.length + dbProducts.length,
    fromCache: false, durationMs: payload.meta.durationMs,
  }).catch(() => {});

  const status = storeResults.length === 0 && dbProducts.length === 0 ? 202 : 200;
  return res.status(status).json(payload);
};

// ─── GET /api/v1/products/:id ────────────────────────────────────────────────
const getProductById = async (req, res) => {
  const cacheKey = `product:${req.params.id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.status(200).json({ success: true, data: cached, fromCache: true });

  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new NotFoundError('Product');

  await cache.set(cacheKey, product, 3600);
  res.status(200).json({ success: true, data: product });
};

// ─── POST /api/v1/products/:id/alerts ────────────────────────────────────────
const setProductAlert = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product');

  const user = req.user;
  if (!user.wishlist.includes(req.params.id)) {
    user.wishlist.push(req.params.id);
    await user.save();
  }
  res.status(200).json({ success: true, message: 'Product added to alerts', wishlist: user.wishlist });
};

// ─── GET /api/v1/products/landing ────────────────────────────────────────────
const getLandingPageData = async (_req, res) => {
  const { value, fromCache } = await cache.wrap('landing:categories', 300, async () => {
    const aggregated = await Product.aggregate([
      { $group: { _id: '$category', products: { $push: '$$ROOT' } } },
      { $project: { category: '$_id', products: { $slice: ['$products', 8] }, _id: 0 } },
      { $sort: { category: 1 } },
      { $limit: 10 },
    ]);
    const out = {};
    aggregated.forEach((g) => { out[g.category || 'Featured'] = g.products; });
    return out;
  });
  res.status(200).json({ success: true, data: value, meta: { fromCache } });
};

// ─── GET /api/v1/products ────────────────────────────────────────────────────
const getAllProducts = async (req, res) => {
  const { page, limit } = req.query;
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Product.find().skip(skip).limit(limit).lean(),
    Product.countDocuments(),
  ]);
  res.status(200).json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
};

// ─── GET /api/v1/products/category/:category ─────────────────────────────────
const getProductsByCategory = async (req, res) => {
  const { page, limit } = req.query;
  const skip = (page - 1) * limit;
  const filter = { category: new RegExp(`^${req.params.category}$`, 'i') };
  const [data, total] = await Promise.all([
    Product.find(filter).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
};

module.exports = {
  searchProducts, getProductById, setProductAlert,
  getLandingPageData, getAllProducts, getProductsByCategory,
};
