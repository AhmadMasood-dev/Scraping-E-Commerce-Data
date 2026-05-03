const app = require('./src/app');
const connectDB = require('./src/config/db');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer();
