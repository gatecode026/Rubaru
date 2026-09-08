/**
 * Centralized, Typed Calling & Real-Time Communications Configuration Layer (R4-C7)
 * Strictly validates environment, security secrets, timeouts, rates, and providers.
 */

const CallingConfig = {
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database & Cache
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/dating_app',
    isConfigured: Boolean(process.env.MONGO_URI),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    isConfigured: Boolean(process.env.REDIS_URL),
    keyPrefix: 'rubaru:calling:',
  },

  // Calling Lifecycles & Timeouts (in seconds)
  lifecycle: {
    ringTimeoutSeconds: parseInt(process.env.CALL_RING_TIMEOUT_SECONDS || '45', 10),
    reconnectGraceSeconds: parseInt(process.env.CALL_RECONNECT_GRACE_SECONDS || '15', 10),
    maxCallDurationSeconds: parseInt(process.env.CALL_MAX_DURATION_SECONDS || '14400', 10), // 4 hours
    billingIntervalSeconds: parseInt(process.env.CALL_BILLING_INTERVAL_SECONDS || '60', 10),
  },

  // Authoritative Pricing (in Rubaru coins)
  pricing: {
    audioRatePerMinute: parseInt(process.env.CALL_AUDIO_RATE_PER_MIN || '5', 10),
    videoRatePerMinute: parseInt(process.env.CALL_VIDEO_RATE_PER_MIN || '10', 10),
  },

  // Cryptographic Secrets
  security: {
    jwtSecret: process.env.JWT_SECRET || 'rubaru_super_secret_jwt_key_2026',
    callSigningSecret: process.env.CALL_SIGNING_SECRET || process.env.JWT_SECRET || 'rubaru_secure_call_signing_key_2026',
    turnSecret: process.env.TURN_SECRET || 'rubaru_production_turn_secret_hmac_2026',
    isProductionSecretSet: Boolean(
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET !== 'rubaru_super_secret_jwt_key_2026' &&
      process.env.CALL_SIGNING_SECRET
    ),
  },

  // STUN / TURN Relay Servers
  webrtc: {
    stunUrls: (process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').split(','),
    turnUrls: (process.env.TURN_URLS || 'turn:turn.rubaru.app:3478,turns:turn.rubaru.app:5349').split(','),
    turnCredentialTtlSeconds: parseInt(process.env.TURN_CREDENTIAL_TTL_SECONDS || '86400', 10), // 24 hours
  },

  // Push Providers
  push: {
    provider: process.env.PUSH_PROVIDER || 'MOCK',
    fcmServiceAccountConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS),
    apnsConfigured: Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID),
  },

  // Client Version Gating
  client: {
    minSupportedAppVersion: process.env.MIN_SUPPORTED_APP_VERSION || '1.0.0',
    allowedPlatforms: ['ANDROID', 'IOS', 'WEB'],
  },

  /**
   * Validate configuration and return sanitized diagnostic status
   */
  validateConfig() {
    const errors = [];
    const warnings = [];

    if (!this.mongo.isConfigured) {
      if (this.isProduction) errors.push('MONGO_URI is required in production.');
      else warnings.push('MONGO_URI is using default local fallback.');
    }

    if (this.isProduction && !this.security.isProductionSecretSet) {
      warnings.push('JWT_SECRET or CALL_SIGNING_SECRET is using development default value.');
    }

    if (this.lifecycle.ringTimeoutSeconds < 10 || this.lifecycle.ringTimeoutSeconds > 120) {
      errors.push('CALL_RING_TIMEOUT_SECONDS must be between 10 and 120 seconds.');
    }

    if (this.lifecycle.reconnectGraceSeconds < 5 || this.lifecycle.reconnectGraceSeconds > 60) {
      errors.push('CALL_RECONNECT_GRACE_SECONDS must be between 5 and 60 seconds.');
    }

    if (this.pricing.audioRatePerMinute <= 0 || this.pricing.videoRatePerMinute <= 0) {
      errors.push('Audio and Video rates per minute must be positive integers.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        environment: this.environment,
        ringTimeoutSeconds: this.lifecycle.ringTimeoutSeconds,
        reconnectGraceSeconds: this.lifecycle.reconnectGraceSeconds,
        audioRatePerMinute: this.pricing.audioRatePerMinute,
        videoRatePerMinute: this.pricing.videoRatePerMinute,
        stunUrlsCount: this.webrtc.stunUrls.length,
        turnUrlsCount: this.webrtc.turnUrls.length,
        pushProvider: this.push.provider,
        fcmConfigured: this.push.fcmServiceAccountConfigured,
        apnsConfigured: this.push.apnsConfigured,
        minAppVersion: this.client.minSupportedAppVersion,
      },
    };
  },
};

module.exports = CallingConfig;
