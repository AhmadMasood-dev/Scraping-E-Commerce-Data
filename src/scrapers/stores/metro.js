/**
 * Metro (https://www.metro.pk / metro-online.pk) — supermarket storefront.
 * Best-effort selectors; falls back to generic if these miss.
 */
const { extractGeneric, adaptItems } = require('./_generic');

async function extractMetro(page, store, query) {
  await page.waitForSelector('.product-card, .product-item, [data-product-id], article[class*="product"]', { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-card, .product-item, .product-tile, article[class*="product"]');
    return Array.from(cards).slice(0, 30).map((el) => {
      const titleEl = el.querySelector('.product-name, .product-title, h3, h4, a[title]');
      const priceEl = el.querySelector('.price, .product-price, [class*="price"]');
      const linkEl = el.querySelector('a[href]');
      const imgEl = el.querySelector('img');

      const title = (titleEl?.innerText || titleEl?.title || '').trim();
      const priceText = (priceEl?.innerText || priceEl?.textContent || '').replace(/[^\d.]/g, '');
      const price = priceText ? Math.round(parseFloat(priceText)) : null;
      let url = linkEl?.href || '';
      if (url.startsWith('/')) url = location.origin + url;
      const image_url = imgEl?.src || imgEl?.dataset?.src || '';

      return { title, price, url, image_url, rating: null, reviews: null, brand: null };
    });
  }).catch(() => []);

  const adapted = adaptItems(raw, store, query);
  if (adapted.length > 0) return adapted;
  return extractGeneric(page, store, query);
}

module.exports = extractMetro;
