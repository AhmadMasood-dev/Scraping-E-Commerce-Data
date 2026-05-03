const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const STORES = {
  telemart: {
    name: 'Telemart',
    hex: '22c55e',
    searchUrl: (q) => `https://www.telemart.pk/search?q=${encodeURIComponent(q)}`,
    basePrice: 22000,
  },
  daraz: {
    name: 'Daraz',
    hex: 'f97316',
    searchUrl: (q) => `https://www.daraz.pk/catalog/?q=${encodeURIComponent(q)}`,
    basePrice: 18000,
  },
  priceoye: {
    name: 'PriceOye',
    hex: '3b82f6',
    searchUrl: (q) => `https://priceoye.pk/search?q=${encodeURIComponent(q)}`,
    basePrice: 15000,
  },
  mega: {
    name: 'Mega',
    hex: '8b5cf6',
    searchUrl: (q) => `https://www.mega.pk/search?q=${encodeURIComponent(q)}`,
    basePrice: 19000,
  },
  imtiaz: {
    name: 'Imtiaz',
    hex: 'ef4444',
    searchUrl: (q) => `https://www.imtiaz.com.pk/search?q=${encodeURIComponent(q)}`,
    basePrice: 14000,
  },
  punjab_cash_carry: {
    name: 'Punjab Cash & Carry',
    hex: '14b8a6',
    searchUrl: (q) => `https://www.punjabcashandcarry.com/search?q=${encodeURIComponent(q)}`,
    basePrice: 16000,
  },
  metro: {
    name: 'Metro',
    hex: 'f59e0b',
    searchUrl: (q) => `https://www.metro.pk/search?q=${encodeURIComponent(q)}`,
    basePrice: 17000,
  },
};

/** Build a branded placeholder image URL with store color */
const mockImage = (store, query, label = '') => {
  const text = (label || query).replace(/ /g, '+').toUpperCase().slice(0, 20);
  return `https://placehold.co/400x400/${store.hex}/ffffff?text=${text}`;
};

/**
 * Simulate multiple results per store — just like a real scraper
 * would return 5-20 listings from a search results page.
 * Replace the body of this function with real page.evaluate() selectors.
 */
const generateMockItems = (store, storeKey, query) => {
  const VARIANTS = [
    { suffix: '',         priceAdd: 0,    rating: 4.6, reviews: 396 },
    { suffix: ' - Blue',  priceAdd: 500,  rating: 4.1, reviews: 210 },
    { suffix: ' - White', priceAdd: -300, rating: 4.4, reviews: 178 },
    { suffix: ' - Black', priceAdd: 800,  rating: 3.9, reviews: 88  },
    { suffix: ' - Slim',  priceAdd: 1200, rating: 4.7, reviews: 512 },
  ];

  return VARIANTS.map((v, i) => ({
    store_name: store.name,
    native_id: `${storeKey}-${i}-${Date.now()}`,
    title: `${query.toUpperCase()}${v.suffix}`,
    description: `${store.name} verified listing for "${query}${v.suffix}"`,
    rating: v.rating,
    price: store.basePrice + v.priceAdd + Math.floor(Math.random() * 3000),
    reviews: v.reviews,
    url: store.searchUrl(query),
    brand: 'Generic',
    category: 'General',
    image_url: mockImage(store, query, `${query}${v.suffix}`),
  }));
};

/**
 * Scrape a single store — opens a dedicated browser page.
 * Returns an ARRAY of items (multiple results from one store's search page).
 */
const scrapeStore = async (browser, storeKey, query) => {
  const store = STORES[storeKey];
  if (!store) return [];

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    // Allow images — needed when real scrapers capture product thumbnails
    if (['stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  try {
    await page.goto(store.searchUrl(query), {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(() => {}); // Don't crash if site is unreachable

    await wait(500 + Math.floor(Math.random() * 500));

    // ─── PRODUCTION: replace mock below with real DOM extraction ────────────
    // const items = await page.evaluate(() => {
    //   return Array.from(document.querySelectorAll('.product-card')).map(el => ({
    //     title: el.querySelector('.title')?.innerText?.trim() || '',
    //     price: parseInt(el.querySelector('.price')?.innerText?.replace(/\D/g, '')) || 0,
    //     url:   el.querySelector('a')?.href || '',
    //     image_url: el.querySelector('img')?.src || el.querySelector('img')?.dataset.src || '',
    //     rating:  parseFloat(el.querySelector('.rating')?.innerText) || 0,
    //     reviews: parseInt(el.querySelector('.reviews-count')?.innerText?.replace(/\D/g, '')) || 0,
    //   })).filter(i => i.title && i.price > 0);
    // });
    // return items.map(item => ({ ...item, store_name: store.name, brand: 'Generic', category: 'General' }));
    // ────────────────────────────────────────────────────────────────────────

    // Mock: 20 realistic variants per store
    const isTechStore = ['telemart', 'priceoye', 'mega'].includes(storeKey);
    const isClothingSearch = query.toLowerCase().includes('shirt') || query.toLowerCase().includes('shoe') || query.toLowerCase().includes('pant');
    
    if (isTechStore && isClothingSearch) {
      console.log(`[Mock Scraper] ${store.name} skipped for non-tech query: ${query}`);
      return [];
    }

    // Generate up to 20 items
    const allItems = [];
    for (let j = 0; j < 4; j++) { // 4 sets of the 5 variants = 20 items
      allItems.push(...generateMockItems(store, `${storeKey}-${j}`, query));
    }
    return allItems.slice(0, 20);
r
  } catch (e) {
    console.error(`[Scraper] ${store.name} failed:`, e.message);
    return [];
  } finally {
    await page.close();
  }
};

/**
 * Main orchestration — one shared browser, all stores run in parallel tabs.
 * Returns a flat array of ALL items from ALL stores.
 */
const scrapePlatforms = async (query, platforms = []) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const storeKeys = platforms.length > 0 ? platforms : Object.keys(STORES);
    console.log(`[Scraper] Firing ${storeKeys.length} parallel scrapers: ${storeKeys.join(', ')}`);

    const results = await Promise.all(
      storeKeys.map((key) => scrapeStore(browser, key, query))
    );

    const flat = results.flat();
    console.log(`[Scraper] Total items collected: ${flat.length} across ${storeKeys.length} stores`);
    return flat;

  } catch (err) {
    console.error('[Scraper] Orchestration error:', err.message);
    return [];
  } finally {
    await browser.close();
  }
};

module.exports = { scrapePlatforms };
