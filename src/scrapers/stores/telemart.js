/**
 * Telemart (https://www.telemart.pk) — Algolia InstantSearch SPA. Product
 * cards are anchors with direct slug URLs (no `/product/` prefix) that contain
 * the title and price as plain text.
 */
const { extractGeneric, adaptItems } = require('./_generic');

async function extractTelemart(page, store, query) {
  await page.waitForSelector('a[href^="https://www.telemart.pk/"]', { timeout: 3000 }).catch(() => {});

  const raw = await page.evaluate(() => {
    // Find anchors whose visible text contains both a title-like chunk and a price.
    const anchors = Array.from(document.querySelectorAll('a[href^="https://www.telemart.pk/"], a[href^="/"]'));
    const seen = new Set();
    const out = [];

    for (const a of anchors) {
      const text = (a.innerText || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 15) continue;

      // Must contain a Pakistani-rupee price
      const priceMatch = text.match(/(?:Rs|PKR|₨)\.?\s*([\d,]+)/i);
      if (!priceMatch) continue;

      // Skip nav links and obvious chrome
      if (/^(Sort|Filters|Login|Sign|Categories|Home|About|Contact)/i.test(text)) continue;

      const href = a.href;
      if (!href || seen.has(href)) continue;
      seen.add(href);

      // Title = text before the first price marker
      const beforePrice = text.slice(0, priceMatch.index).trim();
      // Remove common card UI fragments
      const title = beforePrice.replace(/(Add to (Cart|Wishlist)|Quick View|Compare)/gi, '').trim();

      // Image — first <img> descendant of the anchor (or its parent if needed)
      const imgEl = a.querySelector('img') || a.parentElement?.querySelector('img');
      const image_url = imgEl?.src || imgEl?.dataset?.src || imgEl?.dataset?.original || '';

      out.push({
        title: title.slice(0, 200),
        price: priceMatch[1],
        url: href,
        image_url,
        rating: null,
        reviews: null,
        brand: null,
      });
      if (out.length >= 30) break;
    }
    return out;
  }).catch(() => []);

  const adapted = adaptItems(raw, store, query);
  if (adapted.length > 0) return adapted;
  return extractGeneric(page, store, query);
}

module.exports = extractTelemart;
