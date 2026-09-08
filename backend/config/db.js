const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google DNS to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  console.log('[DNS] Configured node dns servers to Google DNS (8.8.8.8, 8.8.4.4) for Atlas SRV resolution.');
} catch (dnsErr) {
  console.warn('[DNS] Warning: failed to set custom DNS servers:', dnsErr.message);
}

/**
 * Resolves safe MongoDB URI based on environment.
 * If NODE_ENV is 'test' or test flags are present, automatically isolates
 * to 'dating_app_test' so automated tests can never pollute the app database.
 */
const getTargetUri = () => {
  let uri = process.env.MONGO_URI || '';
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.IS_TEST_SUITE === 'true';

  if (isTestEnv) {
    if (process.env.TEST_MONGO_URI) {
      return process.env.TEST_MONGO_URI;
    }
    // Automatically redirect to isolated test database
    if (uri.includes('/dating_app?')) {
      return uri.replace('/dating_app?', '/dating_app_test?');
    } else if (uri.endsWith('/dating_app')) {
      return uri.replace(/\/dating_app$/, '/dating_app_test');
    }
  }

  return uri;
};

const connectDB = async () => {
  try {
    const targetUri = getTargetUri();
    const conn = await mongoose.connect(targetUri);
    console.log(`MongoDB Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

