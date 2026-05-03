const { scrapePlatforms } = require('./src/scrapers/index.js');
const db = require('./src/config/db.js');

(async () => {
    // We just want to see what the puppeteer scraper pulls without inserting into MongoDB
    console.log("Starting scrape for 'iphone 16pro max' on Telemart...");
    const data = await scrapePlatforms('iphone 16pro max', ['telemart']);
    
    if (data.length === 0) {
        console.log("No data returned! This is typical if the mock CSS selectors (e.g., '.product-card', '.product-title') do not match Telemart's live React/Vue DOM elements.");
    } else {
        console.log("Scrape Results:");
        console.dir(data, { depth: null });
    }

    process.exit(0);
})();
