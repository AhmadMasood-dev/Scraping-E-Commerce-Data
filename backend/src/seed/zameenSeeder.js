require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ZameenProperty = require('../models/zameen.model');

const CSV_FILE_PATH = __dirname + '/../../zameen-updated.csv';

const seedZameen = async () => {
    try {
        await connectDB();
        console.log('Clearing existing Zameen properties...');
        await ZameenProperty.deleteMany({});
        
        let recordsToInsert = [];
        let totalInserted = 0;
        console.log('Parsing CSV...');
        
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv())
            .on('data', (row) => {
                const parseNum = (val) => {
                    const parsed = Number(val);
                    return isNaN(parsed) ? null : parsed;
                };

                const property = {
                    property_id: parseNum(row['property_id']),
                    location_id: parseNum(row['location_id']),
                    page_url: row['page_url'] || null,
                    property_type: row['property_type'] || null,
                    price: parseNum(row['price']),
                    location: row['location'] || null,
                    city: row['city'] || null,
                    province_name: row['province_name'] || null,
                    latitude: parseNum(row['latitude']),
                    longitude: parseNum(row['longitude']),
                    baths: parseNum(row['baths']),
                    area: row['area'] || null,
                    purpose: row['purpose'] || null,
                    bedrooms: parseNum(row['bedrooms']),
                    date_added: row['date_added'] || null,
                    agency: row['agency'] || null,
                    agent: row['agent'] || null,
                    area_type: row['Area Type'] || null,
                    area_size: parseNum(row['Area Size']),
                    area_category: row['Area Category'] || null
                };
                
                recordsToInsert.push(property);
            })
            .on('end', async () => {
                console.log(`CSV parsed. Total records: ${recordsToInsert.length}. Inserting into database...`);
                // Use chunking to avoid running out of memory or hitting MongoDB transaction limits
                const chunkSize = 1000;
                for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
                    const chunk = recordsToInsert.slice(i, i + chunkSize);
                    await ZameenProperty.insertMany(chunk);
                    totalInserted += chunk.length;
                    
                    if ((i / chunkSize) % 10 === 0) {
                        console.log(`Inserted ${totalInserted} / ${recordsToInsert.length} records`);
                    }
                }
                console.log(`Seeding completed successfully! Total inserted: ${totalInserted}`);
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

seedZameen();
