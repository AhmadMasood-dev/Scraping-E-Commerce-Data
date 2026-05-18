/**
 * PriceOye (https://priceoye.pk) — Next.js-style listing. Product cards live
 * inside `.productBox` with nested `.p-title`, `.price-box`.
 */
const { extractGeneric, adaptItems } = require('./_generic');

async function extractPriceoye(page, store, query) {
  await page.waitForSelector('.productBox, .product-card, [data-product-id]', { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate(() => {
    const cards = document.querySelectorAll('.productBox, .product-card, .product-item');
    return Array.from(cards).slice(0, 30).map((el) => {
      const titleEl = el.querySelector('.p-title, .product-title, h3, h4, a[title]');
      const priceEl = el.querySelector('.price-box .price, .product-price, [class*="price"]');
      const linkEl = el.matches('a[href]') ? el : el.querySelector('a[href]');
      const imgEl = el.querySelector('img');
      const ratingEl = el.querySelector('.rating-num, [class*="rating"]');

      const title = (titleEl?.innerText || titleEl?.title || '').trim();
      const priceText = (priceEl?.innerText || priceEl?.textContent || '').replace(/[^\d]/g, '');
      const price = priceText ? parseInt(priceText, 10) : null;
      let url = linkEl?.href || '';
      if (url.startsWith('/')) url = location.origin + url;
      const image_url = imgEl?.src || imgEl?.dataset?.src || '';
      const ratingMatch = (ratingEl?.innerText || '').match(/\d+(?:\.\d+)?/);
      const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;

      return { title, price, url, image_url, rating, reviews: null, brand: null };
    });
  }).catch(() => []);

  const adapted = adaptItems(raw, store, query);
  if (adapted.length > 0) return adapted;
  return extractGeneric(page, store, query);
}

module.exports = extractPriceoye;
