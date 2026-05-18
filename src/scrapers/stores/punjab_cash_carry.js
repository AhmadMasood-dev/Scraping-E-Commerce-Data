/**
 * Punjab Cash & Carry (https://www.punjabcashandcarry.com) — small Shopify-
 * style storefront. Falls back to the generic extractor since site-specific
 * selectors are unknown until first inspection.
 */
const { extractGeneric } = require('./_generic');

async function extractPunjabCashCarry(page, store, query) {
  return extractGeneric(page, store, query);
}

module.exports = extractPunjabCashCarry;
