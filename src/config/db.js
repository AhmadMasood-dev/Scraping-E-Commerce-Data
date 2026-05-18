const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pqc_db';
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
};

module.exports = connectDB;
