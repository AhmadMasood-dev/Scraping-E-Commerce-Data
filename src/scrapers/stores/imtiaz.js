/**
 * Imtiaz Super Market (https://www.imtiaz.com.pk) — Shopify-based storefront.
 * Shopify renders consistent product-card markup via `.product-card` /
 * `.product-grid-item` classes.
 */
const { extractGeneric, adaptItems } = require('./_generic');

async function extractImtiaz(page, store, query) {
  await page.waitForSelector('.product-card, .product-grid-item, .grid-product, [class*="product-item"]', { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-card, .product-grid-item, .grid-product, .product-item');
    return Array.from(cards).slice(0, 30).map((el) => {
      const titleEl = el.querySelector('.product-card__title, .product-title, .product-name, h3, h2, a[title]');
      const priceEl = el.querySelector('.price__current, .product-price, .price-item--regular, [class*="price"]');
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

module.exports = extractImtiaz;
