// Note: Express 5 has native async error propagation; no `express-async-errors` shim required.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const logger = require('./config/logger');
const { generalLimiter } = require('./middlewares/rateLimit');
const { errorHandler } = require('./middlewares/errorHandler');
const { notFound } = require('./middlewares/notFound');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const zameenRoutes = require('./routes/zameen.routes');
const pakwheelsRoutes = require('./routes/pakwheels.routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined', { stream: logger.stream }));
app.use(generalLimiter);

app.get('/', (_req, res) => res.json({ success: true, message: 'PQC System API is running', version: '2.0' }));
app.get('/health', (_req, res) => res.json({ success: true, status: 'healthy', uptime: process.uptime() }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/zameen', zameenRoutes);
app.use('/api/v1/pakwheels', pakwheelsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
