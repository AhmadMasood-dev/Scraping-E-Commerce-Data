require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/product.model');

const CSV_FILE_PATH = __dirname + '/../../../data.csv';

const seedCSV = async () => {
    try {
        await connectDB();
        console.log('Clearing existing products...');
        await Product.deleteMany(); // We start fresh with the mega mart dataset
        
        const productsToInsert = [];
        console.log('Parsing CSV...');
        
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv())
            .on('data', (row) => {
                // Parse specifications from string to object if possible
                let specs = {};
                if (row.specifications) {
                    try {
                        // The python dict uses single quotes. Quick regex hack:
                        let correctedJson = row.specifications.replace(/'/g, '"');
                        specs = JSON.parse(correctedJson);
                    } catch (e) {
                         // silently fallback if parse fails
                    }
                }
                
                // Parse imgs from "['url']" to "url"
                let imageUrl = '';
                if (row.imgs) {
                    try {
                        let correctedImgs = row.imgs.replace(/'/g, '"');
                        const arr = JSON.parse(correctedImgs);
                        if (arr && arr.length > 0) imageUrl = arr[0];
                    } catch (e) {
                        // fallback
                        imageUrl = row.imgs;
                    }
                }
                
                // Only insert records with an actual title
                if (!row.title) return;
                
                const product = {
                    title: row.title,
                    brand: row.brand || 'Unknown',
                    category: row.category || 'Uncategorized',
                    description: row.description || '',
                    image_url: imageUrl,
                    specifications: specs,
                    price_sources: []
                };
                
                // If there's an original_price, add it as a price source for MEGA.PK (which comes from the vendor column)
                if (row.original_price && !isNaN(parseFloat(row.original_price))) {
                    product.price_sources.push({
                        store_name: row.vendor || 'MEGA.PK',
                        url: row.slug || '', // use slug column as URL
                        current_price: parseFloat(row.original_price),
                        historical_prices: [
                            {
                                price: parseFloat(row.original_price),
                                date: new Date()
                            }
                        ]
                    });
                }
                
                productsToInsert.push(product);
            })
            .on('end', async () => {
                console.log(`CSV parsed. Inserting ${productsToInsert.length} products into the database...`);
                // Use chunking to avoid running out of memory or hitting MongoDB transaction limits
                const chunkSize = 500;
                for (let i = 0; i < productsToInsert.length; i += chunkSize) {
                    const chunk = productsToInsert.slice(i, i + chunkSize);
                    await Product.insertMany(chunk);
                    console.log(`Inserted chunk ${Math.ceil(i / chunkSize) + 1} (${chunk.length} items)`);
                }
                console.log('Seeding completed successfully!');
                process.exit(0);
            })
            .on('error', (err) => {
                console.error("Error reading CSV:", err);
                process.exit(1);
            });
            
    } catch (err) {
        console.error("Database connection error:", err);
        process.exit(1);
    }
};

seedCSV();
