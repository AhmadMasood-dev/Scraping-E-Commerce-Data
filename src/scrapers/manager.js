/**
 * Per-store scrape runner — handles page setup, retry/timeout, and health
 * tracking. Called once per store from scrapers/index.js orchestrator.
 */
const { randomUA } = require('./utils/userAgent');
const { withRetry } = require('./utils/withRetry');
const storeHealth = require('../services/storeHealth.service');
const logger = require('../config/logger');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const runStoreScrape = async (browser, store, query, extractItems) => {
  const start = Date.now();
  let page;

  try {
    // API-only extractors (Daraz JSON endpoint, future Algolia direct calls)
    // skip browser setup entirely — saves ~5s per request.
    if (extractItems?.usesBrowser === false) {
      const items = await withRetry(
        () => extractItems(null, store, query),
        { retries: 0, timeoutMs: 12000, label: `scrape:${store.key}` }
      );
      const durationMs = Date.now() - start;
      storeHealth.recordSuccess(store.key, durationMs).catch(() => {});
      return { items, durationMs };
    }

    const items = await withRetry(
      async () => {
        page = await browser.newPage();
        await page.setUserAgent(randomUA());
        await page.setViewport({ width: 1366, height: 768 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
          else req.continue();
        });

        // networkidle2 waits for ≤2 in-flight requests for 500ms — gives SPAs
        // (Algolia, React) time to hydrate without waiting for endlessly polled
        // analytics requests.
        await page.goto(store.searchUrl(query), {
          waitUntil: 'networkidle2',
          timeout: 10000,
        }).catch(() => {});

        // Short post-load settle (not a full delay — most pages are ready by now)
        await wait(200 + Math.floor(Math.random() * 300));

        const extracted = await extractItems(page, store, query);
        await page.close();
        page = null;
        return extracted;
      },
      // Single ~15s attempt per store. Real SPAs (Telemart's Algolia, Daraz)
      // need time for JS hydration; stores that block bots simply return 0 items.
      { retries: 0, timeoutMs: 15000, label: `scrape:${store.key}` }
    );

    const durationMs = Date.now() - start;
    storeHealth.recordSuccess(store.key, durationMs).catch((e) =>
      logger.warn(`storeHealth.recordSuccess failed: ${e.message}`)
    );
    return { items, durationMs };
  } catch (err) {
    storeHealth.recordFailure(store.key, err.message).catch(() => {});
    if (page) await page.close().catch(() => {});
    throw err;
  }
};

module.exports = { runStoreScrape };
