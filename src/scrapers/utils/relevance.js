/**
 * Relevance scoring for scraped items.
 *
 * Score in [0, 1]:
 *   - Token overlap between item title and query keywords (Jaccard-style)
 *   - Bonus when ALL query keywords appear in the title
 *   - Bonus when the title literally STARTS with the query (e.g. "iPhone 15 ..." for "iphone")
 *   - Light bonus for higher rating (so close-relevance ties prefer higher-rated items)
 *
 * Used both to (a) cap each store at top-N most-relevant items before persisting
 * and (b) pick the single representative per store for the comparison view.
 */
const stringSimilarity = require('string-similarity');

const tokenize = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

const scoreItem = (item, queryKeywords) => {
  const title = (item.title || '').toLowerCase();
  if (!title) return 0;

  const kws = (queryKeywords || []).map((k) => k.toLowerCase()).filter(Boolean);
  if (kws.length === 0) {
    // No query keywords — fall back to similarity of title against original query string
    return Math.min(1, (item.rating || 0) / 5);
  }

  const titleTokens = new Set(tokenize(title));
  const matches = kws.filter((k) => titleTokens.has(k) || title.includes(k));
  const overlap = matches.length / kws.length;             // 0..1
  const allMatch = matches.length === kws.length ? 0.15 : 0;
  const startsWith = title.startsWith(kws[0]) ? 0.10 : 0;
  const ratingBoost = (item.rating || 0) / 50;             // up to 0.10 for rating 5
  const fuzzy = stringSimilarity.compareTwoStrings(title, kws.join(' ')) * 0.10;

  return Math.min(1, overlap * 0.65 + allMatch + startsWith + ratingBoost + fuzzy);
};

/**
 * Score every item, sort by relevance DESC, slice to topN.
 * Mutates each item with `_score` and rewrites `position` to its rank.
 */
const rankAndCap = (items, queryKeywords, topN = 5) => {
  const scored = items.map((it) => ({ ...it, _score: scoreItem(it, queryKeywords) }));
  scored.sort((a, b) => b._score - a._score);
  const capped = scored.slice(0, topN);
  capped.forEach((it, idx) => { it.position = idx; }); // rank = new position (0 = most relevant)
  return capped;
};

module.exports = { scoreItem, rankAndCap, tokenize };
