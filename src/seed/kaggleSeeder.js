const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/product.model');
const db = require('../config/db');

dotenv.config();

// Connect to DB
db();

// Mock Dataset simulating Kaggle ecommerce data imports
const mockKaggleData = [
  {
    title: "iPhone 15 Pro Max 256GB Natural Titanium",
    brand: "Apple",
    category: "iphone",
    description: "The latest iPhone with A17 Pro chip and aerospace-grade titanium design.",
    rating: 4.8,
    specifications: { storage: "256GB", color: "Natural Titanium", ram: "8GB" },
    price_sources: [
      {
        store_name: "Kaggle_Seed",
        native_id: "ip15pm-256",
        url: "https://example.com/ip15pm",
        current_price: 360000,
        historical_prices: [{ price: 360000, date: new Date() }]
      }
    ]
  },
  {
    title: "Samsung Galaxy S23 Ultra",
    brand: "Samsung",
    category: "mobile",
    description: "Galaxy S23 Ultra smartphone with 200MP camera.",
    rating: 4.7,
    specifications: { storage: "512GB", ram: "12GB" },
    price_sources: [
      {
        store_name: "Kaggle_Seed",
        native_id: "sam-s23u",
        url: "https://example.com/sams23u",
        current_price: 300000,
        historical_prices: [{ price: 300000, date: new Date() }]
      }
    ]
  },
  {
    title: "Dell XPS 15",
    brand: "Dell",
    category: "laptop",
    description: "Premium laptop with 15.6-inch OLED display.",
    rating: 4.5,
    specifications: { processor: "Core i7", ram: "16GB", storage: "1TB SSD" },
    price_sources: [
      {
        store_name: "Kaggle_Seed",
        native_id: "dell-xps15",
        url: "https://example.com/xps15",
        current_price: 450000,
        historical_prices: [{ price: 450000, date: new Date() }]
      }
    ]
  },
  {
    title: "Panadol Extra Advance (100 Tabs)",
    brand: "GSK",
    category: "medicine",
    description: "Fast pain relief paracetamol formula.",
    rating: 4.9,
    specifications: { type: "tablets", pieces: 100 },
    price_sources: [
      {
        store_name: "Kaggle_Seed",
        native_id: "med-panadol",
        url: "https://example.com/panadol",
        current_price: 450,
        historical_prices: [{ price: 450, date: new Date() }]
      }
    ]
  },
  {
    title: "Honda Civic RS Turbo 2024",
    brand: "Honda",
    category: "pakwheels", // Used specifically for vehicle marketplace category
    description: "Honda Civic RS Turbo with advanced sensing features.",
    rating: 4.6,
    specifications: { engine: "1.5L Turbo", transmission: "Automatic", mileage: "0" },
    price_sources: [
      {
        store_name: "Kaggle_Seed",
        native_id: "pk-civic",
        url: "https://example.com/civic",
        current_price: 8600000,
        historical_prices: [{ price: 8600000, date: new Date() }]
      }
    ]
  },
  {
    title: "Generic Marketplace Items Collection",
    brand: "Generic",
    category: "marketplace",
    description: "Various household accessories bundled.",
    rating: 4.2,
    specifications: { type: "bundle" },
    price_sources: [
      {
        store_name: "Kaggle_Seed",
        native_id: "gen-bundle",
        url: "https://example.com/gen",
        current_price: 1500,
        historical_prices: [{ price: 1500, date: new Date() }]
      }
    ]
  }
];

const seedData = async () => {
  try {
    await Product.deleteMany(); // Clear existing
    console.log('Existing products cleared');

    await Product.insertMany(mockKaggleData);
    console.log('Kaggle mock data heavily seeded successfully!');
    
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error}`);
    process.exit(1);
  }
};

seedData();
