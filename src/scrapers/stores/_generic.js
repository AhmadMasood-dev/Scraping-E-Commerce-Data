/**
 * Generic product extractor — works on any e-commerce search-results page that
 * either (a) embeds JSON-LD Product/ItemList schema, or (b) uses common
 * product-card class patterns.
 *
 * Per-store files (telemart.js, priceoye.js, etc.) override this with site-
 * specific selectors when the generic pass returns nothing useful.
 */

/**
 * Runs inside the browser context — only standard DOM APIs available.
 * Returns a flat array of raw item shapes.
 */
function pageEvaluator() {
  // ─── Strategy 1: JSON-LD structured data (most reliable when present) ──────
  const jsonLdItems = [];
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const s of ldScripts) {
    try {
      const data = JSON.parse(s.textContent || '{}');
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const node = stack.shift();
        if (!node || typeof node !== 'object') continue;

        // ItemList holds an array of products
        if (node['@type'] === 'ItemList' && Array.isArray(node.itemListElement)) {
          for (const el of node.itemListElement) {
            if (el?.item) stack.push(el.item);
            else if (el) stack.push(el);
          }
        }

        if (node['@type'] === 'Product' || node['@type']?.includes?.('Product')) {
          const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          const priceRaw = offer?.price ?? offer?.lowPrice ?? null;
          const price = priceRaw != null ? Number(String(priceRaw).replace(/[^\d.]/g, '')) : null;
          const image = Array.isArray(node.image) ? node.image[0] : (node.image?.url || node.image);
          jsonLdItems.push({
            title: (node.name || '').toString().trim(),
            price: Number.isFinite(price) && price > 0 ? price : null,
            url: node.url || node['@id'] || '',
            image_url: typeof image === 'string' ? image : '',
            rating: node.aggregateRating?.ratingValue ? Number(node.aggregateRating.ratingValue) : null,
            reviews: node.aggregateRating?.reviewCount ? Number(node.aggregateRating.reviewCount) : null,
            brand: typeof node.brand === 'object' ? node.brand?.name : node.brand || null,
          });
        }
      }
    } catch (_e) { /* invalid JSON in this script tag — skip */ }
  }

  // Deduplicate JSON-LD entries by title
  const seen = new Set();
  const dedupedLd = jsonLdItems.filter((it) => {
    if (!it.title || !it.price) return false;
    const k = it.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (dedupedLd.length > 0) return { source: 'jsonld', items: dedupedLd };

  // ─── Strategy 2: DOM scraping fallback ─────────────────────────────────────
  const CARD_SELECTORS = [
    '[data-product]', '[data-product-id]', '[data-sku]', '[data-qa-locator="product-item"]',
    'article[class*="product"]', 'div[class*="product-card"]', 'div[class*="product-item"]',
    'div[class*="productBox"]', 'div[class*="ProductCard"]', 'li[class*="product"]',
    '.product-card', '.product-item', '.item-card', '.product', '.productBox',
    '.products-grid > li', '.products > li', '.products-grid > div',
    'li.item.product', 'li.product',
    '.search-result-item', '.search-item', '.search-result',
    '.product-tile', '.product-block', '.product-grid-item', '.grid-product',
    '.item-cell', '.item-product', '.col-item', '[class*="card-product"]',
  ];

  const PRICE_SKIP_RE = /(old|original|was|crossed|line-?through|strike|del|compare)/i;
  let cards = Array.from(document.querySelectorAll(CARD_SELECTORS.join(',')));

  // Strategy 2b — last-resort anchor scan: if nothing matched, look for any
  // <a> that contains BOTH a price-like text and a heading-like text. Catches
  // weird custom storefronts that don't use any common product-card class.
  if (cards.length === 0) {
    const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 200);
    cards = anchors.filter((a) => {
      const t = a.innerText || '';
      const hasPrice = /(?:Rs|PKR|₨)\.?\s*\d{2,}|\d{3,}(?:,\d{3})/i.test(t);
      const hasTitle = t.replace(/\s+/g, ' ').trim().length > 12;
      return hasPrice && hasTitle;
    });
  }

  const out = [];
  for (const el of cards.slice(0, 50)) {
    // Title
    const titleEl = el.querySelector('h1, h2, h3, h4, .title, .product-title, [class*="title"], [class*="name"], a[title]');
    const title = (titleEl?.innerText || titleEl?.textContent || el.querySelector('a[href]')?.title || '').trim();
    if (!title || title.length < 3) continue;

    // Price — prefer the visible, non-strikethrough price
    let priceEl = null;
    const priceCandidates = Array.from(el.querySelectorAll('.price, [class*="price"], [data-price]'));
    for (const p of priceCandidates) {
      const cls = (p.className || '').toString();
      if (PRICE_SKIP_RE.test(cls)) continue;
      const txt = (p.innerText || p.textContent || '').trim();
      if (/\d/.test(txt)) { priceEl = p; break; }
    }
    const priceText = (priceEl?.innerText || priceEl?.textContent || '').replace(/[^\d.,]/g, '');
    const priceClean = priceText.replace(/,/g, '');
    const price = priceClean ? Math.round(parseFloat(priceClean)) : null;
    if (!price || price <= 0) continue;

    // Link
    const linkEl = el.matches('a[href]') ? el : el.querySelector('a[href]');
    let url = linkEl?.href || '';
    if (url && url.startsWith('/')) url = location.origin + url;

    // Image — try several lazy-loading attributes
    const imgEl = el.querySelector('img');
    const imageUrl =
      imgEl?.src ||
      imgEl?.dataset?.src ||
      imgEl?.dataset?.original ||
      imgEl?.dataset?.lazy ||
      imgEl?.getAttribute?.('data-srcset')?.split(',')[0]?.split(' ')[0] ||
      '';

    // Rating
    const ratingEl = el.querySelector('.rating, [class*="rating"], .stars, [class*="stars"]');
    const ratingText = (ratingEl?.innerText || ratingEl?.textContent || ratingEl?.getAttribute?.('aria-label') || '');
    const ratingMatch = ratingText.match(/\d+(?:\.\d+)?/);
    const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;

    // Reviews count
    const reviewsEl = el.querySelector('.reviews, [class*="review-count"], [class*="reviews"]');
    const reviewsText = (reviewsEl?.innerText || reviewsEl?.textContent || '');
    const reviewsMatch = reviewsText.match(/\d[\d,]*/);
    const reviews = reviewsMatch ? parseInt(reviewsMatch[0].replace(/,/g, ''), 10) : null;

    out.push({ title, price, url, image_url: imageUrl, rating, reviews, brand: null });
  }
  return { source: 'dom', items: out };
}

// ─── Node-side normalization helpers ────────────────────────────────────────
// Per-store extractors do best-effort parsing in-browser; these helpers run
// after `page.evaluate` and clean up whatever they returned. They also handle
// edge cases (relative URLs, srcset, currency symbols) that store-specific
// selectors might miss.

/** Parse "Rs. 1,234.00" / "PKR 1234" / "₨1,234" / number → integer rupees or null. */
function parsePrice(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? Math.round(input) : null;
  }
  if (typeof input !== 'string') return null;
  // Strip everything that isn't a digit or decimal point. Commas are removed
  // along with currency markers ("Rs", "PKR", "₨", "RS.").
  const cleaned = input.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** URLs containing these path fragments are the site's "no image yet" sentinel. */
const PLACEHOLDER_PATTERNS = [
  'product-placeholder',
  'no-image',
  'no_image',
  'noimage',
  'placeholder.',
  '/placeholder',
  '/default-product',
  '/default_product',
  'image-coming-soon',
  'comingsoon',
];

function isPlaceholderImage(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Resolve an image URL to an absolute http(s) URL.
 * Handles: relative paths (/path), protocol-relative (//cdn/...), data:/blob:
 * URLs (rejected), srcset strings (picks the largest candidate), AND filters
 * out the store's "no image yet" placeholder so the frontend renders its own
 * branded fallback instead of a generic gray box.
 */
function resolveImageUrl(src, origin) {
  if (!src || typeof src !== 'string') return null;
  let s = src.trim();
  // srcset: pick the largest width entry
  if (s.includes(' ') && /\d+w/.test(s)) {
    const candidates = s.split(',').map((c) => c.trim().split(/\s+/));
    let best = null;
    let bestW = 0;
    for (const [url, w] of candidates) {
      const width = parseInt((w || '0').replace(/\D/g, ''), 10) || 0;
      if (width >= bestW) { best = url; bestW = width; }
    }
    s = best || candidates[0]?.[0] || s;
  }
  if (!s) return null;
  if (s.startsWith('data:') || s.startsWith('blob:')) return null;
  let absolute;
  if (s.startsWith('//')) absolute = 'https:' + s;
  else if (s.startsWith('/')) absolute = (origin || '').replace(/\/$/, '') + s;
  else if (/^https?:/i.test(s)) absolute = s;
  else return null;
  return isPlaceholderImage(absolute) ? null : absolute;
}

/** Adapter from raw browser items → the shape the scraper service expects. */
function adaptItems(rawItems, store, query) {
  const querySlug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const origin = (() => {
    try { return new URL(store.searchUrl(query)).origin; }
    catch (_e) { return ''; }
  })();

  return (rawItems || [])
    .map((it, idx) => {
      const price = parsePrice(it.price);
      const title = (it.title || '').toString().trim().replace(/\s+/g, ' ');
      const nativeId = `${store.key}-${querySlug}-${idx}`;
      // Item URL must be per-item — fall back to a search-page anchor if the
      // card didn't expose a direct link (rare on real sites).
      const url = it.url && /^https?:/i.test(it.url)
        ? it.url
        : `${store.searchUrl(query)}#item-${nativeId}`;
      return {
        store_name: store.name,
        store_key: store.key,
        native_id: nativeId,
        title,
        description: `${store.name} — ${title}`,
        rating: typeof it.rating === 'number' ? Math.min(5, Math.max(0, it.rating)) : 0,
        price,
        reviews: typeof it.reviews === 'number' ? it.reviews : 0,
        url,
        brand: (it.brand || '').toString().trim() || 'Unknown',
        category: (it.category || 'General').toString().trim() || 'General',
        image_url: resolveImageUrl(it.image_url, origin),
      };
    })
    .filter((it) => it.title && it.title.length >= 3 && it.price && it.price > 0)
    .slice(0, 30); // hard ceiling per store at the extractor layer
}

/** Default extractor — page.evaluate(pageEvaluator) → adapt → return. */
async function extractGeneric(page, store, query) {
  // Give the page a moment to render product cards
  await page.waitForSelector(
    'script[type="application/ld+json"], .product-card, .product-item, [data-product], article[class*="product"]',
    { timeout: 5000 }
  ).catch(() => {});
  const result = await page.evaluate(pageEvaluator).catch(() => ({ source: 'error', items: [] }));
  return adaptItems(result.items || [], store, query);
}

module.exports = { extractGeneric, adaptItems, pageEvaluator, parsePrice, resolveImageUrl, isPlaceholderImage };
