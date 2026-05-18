const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const { bootstrap } = require('./src/seed/bootstrap');

const startServer = async () => {
  try {
    await connectDB();
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  // Idempotent first-run seed: only inserts when collections are empty.
  await bootstrap();

  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

process.on('unhandledRejection', (reason) => {
  logger.error(`[unhandledRejection] ${reason?.message || reason}`, { stack: reason?.stack });
});
process.on('uncaughtException', (err) => {
  logger.error(`[uncaughtException] ${err.message}`, { stack: err.stack });
  process.exit(1);
});

startServer();
