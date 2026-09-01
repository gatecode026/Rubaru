const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google DNS to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  console.log('[DNS] Configured node dns servers to Google DNS (8.8.8.8, 8.8.4.4) for Atlas SRV resolution.');
} catch (dnsErr) {
  console.warn('[DNS] Warning: failed to set custom DNS servers:', dnsErr.message);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
