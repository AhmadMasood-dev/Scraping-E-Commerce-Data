const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const isProd = process.env.NODE_ENV === 'production';

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${message}${rest}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  defaultMeta: { service: 'pqc-api' },
  transports: [
    new winston.transports.Console({ format: isProd ? fileFormat : consoleFormat }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error', format: fileFormat }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log'), format: fileFormat }),
  ],
});

logger.stream = { write: (msg) => logger.info(msg.trim()) };

module.exports = logger;
