from playwright.sync_api import sync_playwright
import json
import time
import re
import csv

def scrape_telemart():
    with sync_playwright() as p:
        # Use a standard user agent to avoid detection
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        url = "https://telemart.pk/mobile-and-tablets.html"
        print(f"Navigating to {url}...")
        page.goto(url)
        
        # Wait for products to load
        print("Waiting for products to load...")
        try:
            page.wait_for_selector("a[href^='/'][href*='-']", timeout=30000)
        except Exception as e:
            print(f"Error waiting for selector: {e}")
            browser.close()
            return

        # Scroll down to ensure lazy loading
        print("Scrolling to load products...")
        # Scroll more to get at least 20 products
        for _ in range(8):
            page.evaluate("window.scrollBy(0, 1000)")
            time.sleep(1.5)
            
        products = []
        
        # Select all 'a' tags
        links = page.query_selector_all("a")
        
        print(f"Found {len(links)} links. Filtering for products...")
        
        for link in links:
            try:
                href = link.get_attribute("href")
                
                # Filter: Must have h4 (title) AND href must look like a product
                if not href or not href.startswith("/") or "-" not in href:
                    continue
                    
                if not link.query_selector("h4"):
                    continue
                
                title = link.query_selector("h4").inner_text().strip()
                
                # Image extraction
                image_url = "N/A"
                img_elem = link.query_selector("img")
                if img_elem:
                    image_url = img_elem.get_attribute("src")
                
                # Detailed Price & Rating extraction
                current_price = "N/A"
                old_price = "N/A"
                discount = "N/A"
                rating = "N/A"
                review_count = "0"
                
                full_text = link.inner_text()
                
                # Extract Discount (e.g., "5 % OFF")
                discount_match = re.search(r"(\d+\s*%\s*OFF)", full_text, re.IGNORECASE)
                if discount_match:
                    discount = discount_match.group(1)
                
                # Extract Prices (e.g., "Rs. 88,399 Rs. 93,000")
                prices = re.findall(r"Rs\.\s*[\d,]+", full_text)
                if prices:
                    current_price = prices[0]
                    if len(prices) > 1:
                        old_price = prices[1]
                
                # Extract Rating (e.g., "4.00")
                # Look for X.XX pattern that is NOT part of a price (no Rs. prefix)
                # We can look for lines that are exactly X.XX or start with it
                rating_match = re.search(r"(\d\.\d{2})", full_text)
                if rating_match:
                    rating = rating_match.group(1)

                # Extract Review Count (e.g., "(2)")
                review_match = re.search(r"\((\d+)\)", full_text)
                if review_match:
                    review_count = review_match.group(1)
                
                product_url = "https://telemart.pk" + href

                if title:
                    products.append({
                        "name": title,
                        "current_price": current_price,
                        "old_price": old_price,
                        "discount": discount,
                        "rating": rating,
                        "reviews": review_count,
                        "image_url": image_url,
                        "product_url": product_url
                    })
                    
                    if len(products) >= 20:
                        break
            except Exception as e:
                continue

        print(f"Scraped {len(products)} products.")
        
        # Save to JSON
        with open("products.json", "w") as f:
            json.dump(products, f, indent=2)
        print("Saved to products.json")
        
        # Save to CSV
        if products:
            keys = products[0].keys()
            with open("products.csv", "w", newline="") as f:
                dict_writer = csv.DictWriter(f, fieldnames=keys)
                dict_writer.writeheader()
                dict_writer.writerows(products)
            print("Saved to products.csv")
        
        browser.close()

if __name__ == "__main__":
    scrape_telemart()
