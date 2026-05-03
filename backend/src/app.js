const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load env vars (can also be done in server.js but good practice here)
dotenv.config();

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const zameenRoutes = require('./routes/zameen.routes');

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: "*",
}));

// Body parser
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/zameen', zameenRoutes);

// Base route for testing
app.get('/', (req, res) => {
  res.send('PQC System API is running...');
});

module.exports = app;
