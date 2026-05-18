/**
 * Scraper engine — orchestrates real DOM extraction per store.
 *
 * Each store has its own extractor in `./stores/<key>.js`. The generic
 * extractor in `./stores/_generic.js` (JSON-LD + common product-card patterns)
 * is the fallback when site-specific selectors miss.
 *
 * Stores that return 0 items (no products, blocked by anti-bot, or DOM changed)
 * simply contribute nothing — the controller treats absence as silence.
 */
const { launchBrowser } = require('./utils/stealth');
const { runStoreScrape } = require('./manager');
const logger = require('../config/logger');

const extractTelemart          = require('./stores/telemart');
const extractDaraz             = require('./stores/daraz');
const extractPriceoye          = require('./stores/priceoye');
const extractMega              = require('./stores/mega');
const extractImtiaz            = require('./stores/imtiaz');
const extractPunjabCashCarry   = require('./stores/punjab_cash_carry');
const extractMetro             = require('./stores/metro');

const STORES = {
  telemart:           { key: 'telemart',          name: 'Telemart',            hex: '22c55e', searchUrl: (q) => `https://www.telemart.pk/search?q=${encodeURIComponent(q)}`,           extractor: extractTelemart },
  daraz:              { key: 'daraz',             name: 'Daraz',               hex: 'f97316', searchUrl: (q) => `https://www.daraz.pk/catalog/?q=${encodeURIComponent(q)}`,             extractor: extractDaraz },
  priceoye:           { key: 'priceoye',          name: 'PriceOye',            hex: '3b82f6', searchUrl: (q) => `https://priceoye.pk/search?q=${encodeURIComponent(q)}`,                 extractor: extractPriceoye },
  mega:               { key: 'mega',              name: 'Mega',                hex: '8b5cf6', searchUrl: (q) => `https://www.mega.pk/search?q=${encodeURIComponent(q)}`,                 extractor: extractMega },
  imtiaz:             { key: 'imtiaz',            name: 'Imtiaz',              hex: 'ef4444', searchUrl: (q) => `https://www.imtiaz.com.pk/?s=${encodeURIComponent(q)}&post_type=product`, extractor: extractImtiaz },
  punjab_cash_carry:  { key: 'punjab_cash_carry', name: 'Punjab Cash & Carry', hex: '14b8a6', searchUrl: (q) => `https://www.punjabcashandcarry.com/search?q=${encodeURIComponent(q)}`, extractor: extractPunjabCashCarry },
  metro:              { key: 'metro',             name: 'Metro',               hex: 'f59e0b', searchUrl: (q) => `https://www.metro.pk/search?q=${encodeURIComponent(q)}`,                extractor: extractMetro },
};

/**
 * Single entry point for `runStoreScrape` — dispatches to the per-store
 * extractor based on `store.key`. Any unhandled key falls back to generic.
 */
async function extractItems(page, store, query) {
  const extractor = store.extractor;
  if (!extractor) {
    logger.warn(`[Scraper] no extractor for store=${store.key}; falling back to generic`);
    const { extractGeneric } = require('./stores/_generic');
    return extractGeneric(page, store, query);
  }
  return extractor(page, store, query);
}

/**
 * Top-level orchestrator — opens one browser, fans out to all stores in parallel
 * with retry/timeout/health tracking. Returns flat items + meta.
 */
const scrapePlatforms = async (query, platforms = []) => {
  const storeKeys = platforms.length > 0 ? platforms : Object.keys(STORES);
  const stores = storeKeys.map((k) => STORES[k]).filter(Boolean);

  const browser = await launchBrowser();
  const startedAt = Date.now();

  try {
    const settled = await Promise.allSettled(
      stores.map((store) => runStoreScrape(browser, store, query, extractItems))
    );

    const items = [];
    const successfulStores = [];
    const failedStores = [];

    settled.forEach((res, idx) => {
      const store = stores[idx];
      if (res.status === 'fulfilled' && res.value) {
        items.push(...res.value.items);
        successfulStores.push({ name: store.name, count: res.value.items.length, durationMs: res.value.durationMs });
      } else {
        const reason = res.status === 'rejected' ? (res.reason?.message || 'unknown') : 'no-data';
        failedStores.push({ name: store.name, reason });
      }
    });

    return {
      items,
      meta: {
        totalStores: stores.length,
        successfulStores,
        failedStores,
        durationMs: Date.now() - startedAt,
      },
    };
  } finally {
    await browser.close().catch(() => {});
  }
};

module.exports = { scrapePlatforms, STORES };
