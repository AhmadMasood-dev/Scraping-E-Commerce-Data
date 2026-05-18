/* Live smoke test for every store. Run: node tools/scrape-smoke.js [query] */
require('dotenv').config();
const { scrapePlatforms } = require('../src/scrapers');

(async () => {
  const query = process.argv[2] || 'iphone 15';
  const stores = ['telemart','priceoye','daraz','mega','imtiaz','metro','punjab_cash_carry'];
  console.log(`Query: "${query}"\n`);
  const t = Date.now();
  const r = await scrapePlatforms(query, stores);
  console.log(`Total: ${r.items.length} items in ${Date.now()-t}ms across ${r.meta.totalStores} stores\n`);
  for (const s of r.meta.successfulStores) {
    const tag = s.count > 0 ? '✓' : '·';
    console.log(`  ${tag} ${s.name.padEnd(22)} ${String(s.count).padStart(3)} items (${s.durationMs}ms)`);
  }
  console.log();
  if (r.items[0]) {
    console.log('Samples (one per store, first item):');
    const seen = new Set();
    for (const it of r.items) {
      if (seen.has(it.store_name)) continue;
      seen.add(it.store_name);
      console.log(`  • ${it.store_name.padEnd(10)} Rs.${String(it.price).padStart(8)} | "${(it.title || '').slice(0,60)}"${it.image_url ? ' [img]' : ''}`);
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
