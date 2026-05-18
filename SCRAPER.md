# Scraper — How to fix a broken store

Real-DOM scraping replaces the mock. Selectors are best-effort and break when stores redesign. This is the runbook for fixing one.

## Architecture

```
src/scrapers/
├── index.js              ← STORES map: name + searchUrl + extractor fn
├── manager.js            ← per-store timeout (15s), networkidle2 page load
├── utils/
│   ├── stealth.js        ← launchBrowser() w/ puppeteer-extra-plugin-stealth
│   ├── withRetry.js      ← p-retry + p-timeout
│   └── relevance.js      ← rankAndCap(): scores by keyword overlap, picks top N
└── stores/
    ├── _generic.js       ← shared: parsePrice, resolveImageUrl, adaptItems,
    │                       JSON-LD strategy, DOM fallback strategies
    ├── telemart.js       ← Algolia SPA: anchor-with-price scan
    ├── priceoye.js       ← `.productBox` cards
    ├── mega.js           ← Magento-style (currently 404 — investigate)
    ├── daraz.js          ← Akamai-protected; returns generic items
    ├── imtiaz.js         ← WordPress/Woo; products not detected (investigate)
    ├── metro.js          ← site returns near-empty (anti-bot or moved)
    └── punjab_cash_carry.js  ← domain DNS-unresolved (likely dead)
```

## Current live-test status (run: `node tools/scrape-smoke.js`)

| Store | Status | Notes |
|---|---|---|
| **PriceOye** | ✅ Works | Returns 30 real iPhones / laptops; images included |
| **Telemart** | ⚠️ Partial | Extractor works (20 items, images) but Telemart's own search returns trending products regardless of query — upstream issue. Relevance ranker filters these out. |
| **Daraz** | ⚠️ Partial | Returns 30 items but mostly accessories matching loosely. Selectors work; Daraz's search just isn't tight. |
| **Mega** | ❌ Broken | `/search?q=...` returns 404. Need to find correct URL pattern. |
| **Imtiaz** | ❌ Broken | URL returns 200 but no product DOM detected after load. Likely async-rendered with custom markup. |
| **Metro** | ❌ Broken | `metro-online.pk` returns ~11 chars — probably anti-bot or domain change. |
| **Punjab Cash & Carry** | ❌ Broken | DNS unresolved. Domain may be retired. |

## To fix a broken store

1. **Open the actual search URL in Chrome.** Confirm products appear.
2. **Right-click a product card → Inspect.** Note:
   - The container element's `class` or `data-*` attribute.
   - The title element's selector (often `h2`, `h3`, or a class with `name`/`title`).
   - The price element (look for `.price`, `[data-price]`, or a class containing `price`).
   - The product link (the `<a>` whose `href` is the detail page).
   - The image (look for `data-src` if the page lazy-loads).
3. **Edit `src/scrapers/stores/<key>.js`.** Each file is ~30 lines:
   ```js
   const raw = await page.evaluate(() => {
     const cards = document.querySelectorAll('YOUR_CARD_SELECTOR');
     return Array.from(cards).slice(0, 30).map((el) => ({
       title:     el.querySelector('YOUR_TITLE_SELECTOR')?.innerText,
       price:     el.querySelector('YOUR_PRICE_SELECTOR')?.innerText,
       url:       el.querySelector('a[href]')?.href,
       image_url: el.querySelector('img')?.src || el.querySelector('img')?.dataset?.src,
     }));
   });
   return adaptItems(raw, store, query);
   ```
4. **Confirm:**
   ```bash
   cd Backend
   node -e "
   require('dotenv').config();
   const { scrapePlatforms } = require('./src/scrapers');
   scrapePlatforms('iphone 15', ['<key>']).then(r => {
     console.log(r.items.length, 'items');
     r.items.slice(0,3).forEach(it => console.log(it.title, 'Rs.' + it.price));
   });
   "
   ```

## Notes

- **Daraz won't ever work perfectly.** Akamai bot detection. Headless Puppeteer + stealth plugin gets some results but not all; paid proxies would fix it but are out of scope.
- **Stores that return 0 items are silently dropped.** The controller skips them — UI shows only stores with results.
- **Per-store timeout is 15s** (`src/scrapers/manager.js`). SPAs need this; raise if a real site genuinely needs longer.
- **Normalization** (price parsing, image URL resolution, brand cleanup) is centralized in `stores/_generic.js#adaptItems` and `services/scraper.service.js#normalizeBrand`. Per-store files only need to extract raw values.
- **Relevance** is computed in `src/scrapers/utils/relevance.js#rankAndCap`. With `MAX_ITEMS_PER_STORE = 1` in the controller, only the single most-keyword-matching item per store is persisted.
