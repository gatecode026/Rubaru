const crypto = require('crypto');

/**
 * TURN and WebRTC Infrastructure Service
 * Supports RFC 5766 time-limited credentials and fail-closed production validation
 */
class TurnService {
  /**
   * Generate short-lived HMAC-SHA1 TURN credentials
   * @param {string} username - Client user identifier
   * @param {number} ttlSeconds - Duration in seconds (default 24h = 86400)
   */
  generateTurnCredentials(username, ttlSeconds = 86400) {
    const turnSecret = process.env.COTURN_SECRET || process.env.TURN_SECRET;
    const turnUrls = (process.env.TURN_URLS || process.env.COTURN_URLS || 'stun:stun.l.google.com:19302')
      .split(',')
      .map((u) => u.trim());

    const isProduction = process.env.NODE_ENV === 'production';

    // Fail-closed check: In production, real TURN secret and server URLs must be present
    if (isProduction && (!turnSecret || turnSecret === 'test_turn_secret' || turnUrls.length === 0)) {
      throw new Error(
        'PRODUCTION_TURN_UNAVAILABLE: Production requires valid COTURN_SECRET and TURN_URLS. Refusing to operate on unconfigured or mock calling infrastructure.'
      );
    }

    if (!turnSecret) {
      // Return public STUN only in development
      return {
        iceServers: [{ urls: turnUrls }],
        username: null,
        credential: null,
        expiresAt: null,
        isProductionHardened: false,
      };
    }

    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const timedUsername = `${expiry}:${username}`;

    const hmac = crypto.createHmac('sha1', turnSecret);
    hmac.update(timedUsername);
    const password = hmac.digest('base64');

    return {
      iceServers: [
        {
          urls: turnUrls,
          username: timedUsername,
          credential: password,
        },
      ],
      username: timedUsername,
      credential: password,
      expiresAt: new Date(expiry * 1000),
      isProductionHardened: true,
    };
  }

  /**
   * Validate SDP payload structure and size
   */
  validateSdp(sdp) {
    if (!sdp || typeof sdp !== 'string') {
      return { valid: false, error: 'SDP must be a non-empty string' };
    }
    // Limit SDP size to 64KB to prevent memory exhaustion / DoS
    if (Buffer.byteLength(sdp, 'utf8') > 65536) {
      return { valid: false, error: 'SDP payload exceeds maximum size limit of 64KB' };
    }
    // Must contain basic SDP markers
    if (!sdp.includes('v=0') || !sdp.includes('m=')) {
      return { valid: false, error: 'Malformed SDP structure: missing standard headers' };
    }
    return { valid: true };
  }

  /**
   * Validate ICE candidate payload structure
   */
  validateIceCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, error: 'ICE candidate must be an object' };
    }
    if (typeof candidate.candidate !== 'string' || candidate.candidate.length === 0) {
      return { valid: false, error: 'ICE candidate string is required' };
    }
    if (Buffer.byteLength(candidate.candidate, 'utf8') > 2048) {
      return { valid: false, error: 'ICE candidate exceeds maximum allowable length' };
    }
    return { valid: true };
  }
}

const turnService = new TurnService();

module.exports = turnService;
