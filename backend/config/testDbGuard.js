const mongoose = require('mongoose');

/**
 * Enterprise Test Database Safety Guard
 * Guarantees that integration tests and destructive test fixtures NEVER execute against
 * an unverified, production, or unidentified MongoDB database.
 */

const ALLOWED_TEST_DB_NAMES = [
  'dating_app_test',
  'rubaru_test',
  'rubaru_integration_test',
  'rubaru_ci_test',
  'test',
];

/**
 * Validates and safely resolves the test MongoDB database URI.
 * Throws a fatal error if pointing to production.
 * @param {string} [customUri] - Optional URI to validate
 * @returns {string} Safe test database URI
 */
function getSafeTestMongoUri(customUri = null) {
  let uri = customUri || process.env.TEST_MONGO_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: No MongoDB URI provided. Refusing to execute integration tests without explicit connection string.'
    );
  }

  // Parse database name from URI
  let dbName = null;
  try {
    const parsed = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
    const pathname = parsed.pathname.replace(/^\//, '');
    if (pathname) {
      dbName = pathname.split('?')[0];
    }
  } catch (e) {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    if (match) {
      dbName = match[1];
    }
  }

  // If pointing directly to production database name 'dating_app' or root without suffix
  if (dbName === 'dating_app' || dbName === 'production' || dbName === 'rubaru_prod') {
    // Automatically switch or append safe test database suffix
    const safeDbName = 'dating_app_test';
    if (uri.includes('/dating_app?')) {
      uri = uri.replace('/dating_app?', `/${safeDbName}?`);
    } else if (uri.endsWith('/dating_app')) {
      uri = uri.replace(/\/dating_app$/, `/${safeDbName}`);
    } else {
      uri = `${uri.replace(/\/[^/?]*(\?|$)/, `/${safeDbName}$1`)}`;
    }
    dbName = safeDbName;
  } else if (!dbName) {
    // Append default test db if none in URI
    const separator = uri.includes('?') ? '?' : '';
    const safeDbName = 'dating_app_test';
    if (separator) {
      uri = uri.replace('?', `/${safeDbName}?`);
    } else {
      uri = `${uri}/${safeDbName}`;
    }
    dbName = safeDbName;
  }

  // Final validation check
  const isAllowlisted = ALLOWED_TEST_DB_NAMES.includes(dbName) || dbName.endsWith('_test');
  if (!isAllowlisted) {
    throw new Error(
      `TEST_DB_SAFETY_VIOLATION: Target database '${dbName}' is NOT an allowlisted test database name (must end with '_test' or be in allowlist: ${ALLOWED_TEST_DB_NAMES.join(', ')}). Aborting test execution to protect data integrity.`
    );
  }

  return {
    uri,
    dbName,
    maskedHost: maskMongoUri(uri),
  };
}

/**
 * Mask sensitive credentials in MongoDB URI for safe logging
 */
function maskMongoUri(uri) {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

/**
 * Connect to isolated test database with safety verification
 */
async function connectSafeTestDB(customUri = null) {
  const { uri, dbName, maskedHost } = getSafeTestMongoUri(customUri);

  if (mongoose.connection.readyState === 1) {
    const activeDbName = mongoose.connection.db?.databaseName;
    if (activeDbName && activeDbName !== dbName && !ALLOWED_TEST_DB_NAMES.includes(activeDbName) && !activeDbName.endsWith('_test')) {
      throw new Error(
        `TEST_DB_SAFETY_VIOLATION: Active Mongoose connection is targeting '${activeDbName}', which is not a test database. Disconnecting immediately.`
      );
    }
    return { connection: mongoose.connection, dbName: activeDbName || dbName, maskedHost };
  }

  const conn = await mongoose.connect(uri);
  console.log(`[SAFE TEST DB] Connected to isolated test database: '${conn.connection.name}' (Host: ${maskedHost})`);
  return { connection: conn, dbName: conn.connection.name, maskedHost };
}

module.exports = {
  getSafeTestMongoUri,
  maskMongoUri,
  connectSafeTestDB,
  ALLOWED_TEST_DB_NAMES,
};
