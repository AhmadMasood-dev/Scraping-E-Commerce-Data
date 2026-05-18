const mongoose = require('mongoose');

const pakwheelsVehicleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  make: { type: String, index: true },
  model: { type: String, index: true },
  variant: String,
  year: { type: Number, index: true },
  mileage: Number,                                                  // km, parsed from "42,000 km"
  fuel_type: String,                                                // Petrol / Diesel / Hybrid / CNG / Lpg
  transmission: String,                                             // Manual / Automatic
  color: String,
  city: { type: String, index: true },
  province: { type: String, index: true },                          // Punjab / Sindh / KPK / Balochistan / Islamabad
  price: { type: Number, index: true },
  condition: { type: String, index: true, enum: ['New', 'Used'], default: 'Used' },
  description: String,
  image_urls: [String],
  seller_type: { type: String, enum: ['Individual', 'Dealer'], default: 'Individual' },
  posted_at: Date,
  source_url: String,                                               // ad permalink (if available)
  // ─── Extended from Kaggle usedCars.json ──────────────────────────────────
  body_type: { type: String, index: true },                         // Hatchback / SUV / Sedan / Micro Van / ...
  engine_capacity: Number,                                          // cc, parsed from "800cc"
  registered_in: String,                                            // city the car is registered in (often != seller city)
  assembly: String,                                                 // Local / Imported
  features: [String],                                               // Air bags, ABS, Power Steering, ...
  source_ref: { type: String, unique: true, sparse: true },         // AdRef# — prevents dupes on re-seed
}, { timestamps: true });

pakwheelsVehicleSchema.index({ make: 1, model: 1, year: -1, price: 1 });
pakwheelsVehicleSchema.index({ city: 1, condition: 1 });
pakwheelsVehicleSchema.index({ body_type: 1, make: 1, year: -1 });
pakwheelsVehicleSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('PakWheelsVehicle', pakwheelsVehicleSchema);
