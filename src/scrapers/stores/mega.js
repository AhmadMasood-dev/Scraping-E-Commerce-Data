/**
 * Mega.pk (https://www.mega.pk) — classic table-and-card grid. Product cards
 * use `.product-card` with embedded `.price`, `.brandname`.
 */
const { extractGeneric, adaptItems } = require('./_generic');

async function extractMega(page, store, query) {
  await page.waitForSelector('.product-card, .productimg, .search-item, [class*="product"]', { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-card, .productimg, .search-item');
    return Array.from(cards).slice(0, 30).map((el) => {
      const titleEl = el.querySelector('.product-name, .brandname, .productname, h2, h3, a[title]');
      const priceEl = el.querySelector('.price, .product-price, [class*="price"]');
      const linkEl = el.matches('a[href]') ? el : el.querySelector('a[href]');
      const imgEl = el.querySelector('img');

      const title = (titleEl?.innerText || titleEl?.title || '').trim();
      const priceText = (priceEl?.innerText || priceEl?.textContent || '').replace(/[^\d]/g, '');
      const price = priceText ? parseInt(priceText, 10) : null;
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

module.exports = extractMega;
