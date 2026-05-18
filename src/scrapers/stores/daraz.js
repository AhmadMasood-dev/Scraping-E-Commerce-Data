/**
 * Daraz (https://www.daraz.pk) — uses the public AJAX catalog endpoint
 * (`/catalog/?ajax=true&q=...`) which returns full product listings as JSON.
 * Much faster and more reliable than DOM scraping; no browser context needed.
 *
 * This extractor signature still accepts `page` for compatibility with the
 * dispatcher, but it ignores the browser and hits the JSON endpoint directly.
 */
const { adaptItems, resolveImageUrl } = require('./_generic');

const TIMEOUT_MS = 12000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.daraz.pk/',
};

async function fetchDarazCatalog(query) {
  const url = `https://www.daraz.pk/catalog/?ajax=true&isFirstRequest=true&page=1&q=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!r.ok) return [];
    const data = await r.json();
    return data?.mods?.listItems || [];
  } finally {
    clearTimeout(t);
  }
}

// eslint-disable-next-line no-unused-vars
async function extractDaraz(_page, store, query) {
  const listItems = await fetchDarazCatalog(query).catch(() => []);
  if (listItems.length === 0) return [];

  const raw = listItems.slice(0, 40).map((p) => {
    // Daraz uses protocol-relative URLs for productUrl
    let url = p.productUrl || '';
    if (url.startsWith('//')) url = 'https:' + url;
    return {
      title: (p.name || '').toString().trim(),
      price: p.price ?? p.priceShow,
      url,
      image_url: resolveImageUrl(p.image, 'https://www.daraz.pk'),
      rating: typeof p.ratingScore === 'number' ? p.ratingScore : parseFloat(p.ratingScore) || null,
      reviews: typeof p.review === 'number' ? p.review : parseInt(p.review || '0', 10) || null,
      brand: p.brandName && p.brandName !== 'No Brand' ? p.brandName : null,
    };
  });

  return adaptItems(raw, store, query);
}

// Tell the orchestrator we don't need a browser page — saves ~5s per request.
extractDaraz.usesBrowser = false;

module.exports = extractDaraz;
