const Redis = require('ioredis');
let RedisMock;
try {
  RedisMock = require('ioredis-mock');
} catch (e) {
  RedisMock = null;
}

let commandClient = null;
let publisherClient = null;
let subscriberClient = null;
let isMockActive = false;
let isRedisConnected = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'rubaru:';
const REDIS_REQUIRED = process.env.REDIS_REQUIRED === 'true' || process.env.NODE_ENV === 'production';

/**
 * Build Redis connection options safely without logging credentials
 */
function getRedisOptions() {
  const options = {
    keyPrefix: REDIS_KEY_PREFIX,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > 5) {
        if (REDIS_REQUIRED) {
          console.error('[REDIS] Maximum reconnection attempts exceeded in production environment.');
          return null;
        }
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  };

  if (process.env.REDIS_TLS === 'true' || REDIS_URL.startsWith('rediss://')) {
    options.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  return options;
}

/**
 * Initialize Centralized Redis Clients
 * @param {Object} customOptions - Overrides for testing
 */
async function initRedis(customOptions = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceMock = customOptions.mock || process.env.ALLOW_MOCK_REDIS === 'true';

  if (isProduction && forceMock) {
    throw new Error('PRODUCTION_REDIS_MOCK_FORBIDDEN: In-memory mock Redis is strictly forbidden in production mode.');
  }

  const useMock = !isProduction && (forceMock || (!process.env.REDIS_URL && !REDIS_REQUIRED));

  if (useMock) {
    if (!RedisMock) {
      RedisMock = require('ioredis-mock');
    }
    console.log('[REDIS] Initializing in-memory mock Redis client for isolated test environment.');
    commandClient = new RedisMock();
    publisherClient = new RedisMock();
    subscriberClient = new RedisMock();
    isMockActive = true;
    isRedisConnected = true;
    return { commandClient, publisherClient, subscriberClient, isMock: true, distributedReady: false };
  }

  const options = { ...getRedisOptions(), ...customOptions };

  try {
    commandClient = new Redis(REDIS_URL, options);
    publisherClient = new Redis(REDIS_URL, options);
    subscriberClient = new Redis(REDIS_URL, options);

    commandClient.on('error', (err) => {
      console.warn('[REDIS COMMAND ERROR]:', err.message);
      isRedisConnected = false;
    });
    publisherClient.on('error', (err) => {
      console.warn('[REDIS PUB ERROR]:', err.message);
    });
    subscriberClient.on('error', (err) => {
      console.warn('[REDIS SUB ERROR]:', err.message);
    });

    commandClient.on('connect', () => {
      isRedisConnected = true;
      console.log('[REDIS] Command client connected successfully.');
    });

    // Test ping with timeout
    await Promise.race([
      commandClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 4000)),
    ]);

    isMockActive = false;
    isRedisConnected = true;
    return { commandClient, publisherClient, subscriberClient, isMock: false, distributedReady: true };
  } catch (err) {
    console.warn('[REDIS] Real connection failed:', err.message);
    if (REDIS_REQUIRED || isProduction) {
      throw new Error(`REDIS_REQUIRED_STARTUP_FAILURE: Failed to connect to Redis in required/production mode (${err.message})`);
    }

    console.log('[REDIS] Falling back to isolated in-memory test driver.');
    if (!RedisMock) {
      RedisMock = require('ioredis-mock');
    }
    commandClient = new RedisMock();
    publisherClient = new RedisMock();
    subscriberClient = new RedisMock();
    isMockActive = true;
    isRedisConnected = true;
    return { commandClient, publisherClient, subscriberClient, isMock: true, distributedReady: false };
  }
}

function getRedisClient() {
  if (!commandClient) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction && RedisMock) {
      commandClient = new RedisMock();
      isMockActive = true;
      isRedisConnected = true;
    } else if (isProduction) {
      throw new Error('PRODUCTION_REDIS_UNINITIALIZED: Redis client must be initialized with initRedis() before use.');
    }
  }
  return commandClient;
}

function getPublisherClient() {
  if (!publisherClient) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction && RedisMock) {
      publisherClient = new RedisMock();
    } else if (isProduction) {
      throw new Error('PRODUCTION_REDIS_UNINITIALIZED: Redis publisher client must be initialized before use.');
    }
  }
  return publisherClient;
}

function getSubscriberClient() {
  if (!subscriberClient) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction && RedisMock) {
      subscriberClient = new RedisMock();
    } else if (isProduction) {
      throw new Error('PRODUCTION_REDIS_UNINITIALIZED: Redis subscriber client must be initialized before use.');
    }
  }
  return subscriberClient;
}

async function closeRedis() {
  const closers = [];
  if (commandClient && typeof commandClient.quit === 'function') {
    closers.push(commandClient.quit().catch(() => {}));
  }
  if (publisherClient && typeof publisherClient.quit === 'function') {
    closers.push(publisherClient.quit().catch(() => {}));
  }
  if (subscriberClient && typeof subscriberClient.quit === 'function') {
    closers.push(subscriberClient.quit().catch(() => {}));
  }
  await Promise.all(closers);
  commandClient = null;
  publisherClient = null;
  subscriberClient = null;
  isRedisConnected = false;
  isMockActive = false;
}

function getRedisHealth() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    connected: isRedisConnected,
    isMock: isMockActive,
    distributedReady: isRedisConnected && !isMockActive,
    prefix: REDIS_KEY_PREFIX,
    status: isRedisConnected
      ? isMockActive
        ? isProduction
          ? 'UNAVAILABLE_MOCK_FORBIDDEN'
          : 'READY_MOCK_TEST_ONLY'
        : 'READY'
      : 'DISCONNECTED',
  };
}

module.exports = {
  initRedis,
  getRedisClient,
  getPublisherClient,
  getSubscriberClient,
  closeRedis,
  getRedisHealth,
};
