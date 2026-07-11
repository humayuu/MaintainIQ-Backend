import 'dotenv/config';

import app from './src/app.js';
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 8080;

/**
 * Boot the server: connect to MongoDB first, then start listening.
 * Keeping the listener out of app.js lets tests import the app without
 * opening a port or requiring a live database.
 */
const start = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`🚀 MaintainIQ API listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // Fail fast on unhandled async errors instead of limping along.
    process.on('unhandledRejection', (err) => {
      console.error('Unhandled rejection:', err);
      server.close(() => process.exit(1));
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();
