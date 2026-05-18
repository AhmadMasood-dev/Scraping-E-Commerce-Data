const stringSimilarity = require('string-similarity');

const SIMILARITY_THRESHOLD = 0.7;

/**
 * Cluster similar items by title (≥ 0.70 similarity). Returns an array of
 * groups; each group contains items judged to be the same product.
 */
const group = (items) => {
  const groups = [];
  for (const item of items) {
    let matched = false;
    for (const g of groups) {
      const sim = stringSimilarity.compareTwoStrings(
        (item.title || '').toLowerCase(),
        (g[0].title || '').toLowerCase()
      );
      if (sim >= SIMILARITY_THRESHOLD) {
        g.push(item);
        matched = true;
        break;
      }
    }
    if (!matched) groups.push([item]);
  }
  return groups;
};

const normalizeKey = (title) =>
  (title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

module.exports = { group, normalizeKey, SIMILARITY_THRESHOLD };
