const { getRedisClient } = require('../config/redis');

/**
 * Distributed Redis-backed Rate Limiter for Calling & Signaling
 * Enforces per-action throughput limits across all backend instances
 */
class CallRateLimiter {
  constructor() {
    this.memoryFallback = new Map();
  }

  /**
   * Generic atomic rate limit check
   * @param {string} key - Redis rate limit key
   * @param {number} maxLimit - Max allowed events in window
   * @param {number} windowSeconds - Expiration window in seconds (default 60s)
   * @returns {Promise<{ allowed: boolean, remaining: number, current: number }>}
   */
  async checkRateLimit(key, maxLimit, windowSeconds = 60) {
    const isStrict = process.env.NODE_ENV === 'production' || process.env.STRICT_REDIS === 'true';

    try {
      const redis = getRedisClient();
      if (redis && typeof redis.incr === 'function') {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSeconds);
        }
        return {
          allowed: count <= maxLimit,
          remaining: Math.max(0, maxLimit - count),
          current: count,
        };
      }
    } catch (err) {
      console.warn('[CALL RATE LIMITER] Redis check failed:', err.message);
      if (isStrict) {
        throw new Error('REDIS_UNAVAILABLE: Rate limiting infrastructure is unavailable.');
      }
    }

    if (isStrict) {
      throw new Error('REDIS_UNAVAILABLE: Rate limiting infrastructure is unavailable.');
    }

    // Fallback in-memory limiter for standalone local dev tests
    const now = Date.now();
    let entry = this.memoryFallback.get(key);
    if (!entry || now - entry.windowStart > windowSeconds * 1000) {
      entry = { windowStart: now, count: 0 };
      this.memoryFallback.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= maxLimit,
      remaining: Math.max(0, maxLimit - entry.count),
      current: entry.count,
    };
  }

  /**
   * Check Call Initiation limit (Max 5/min per caller)
   */
  async checkCallInitiation(callerId) {
    return this.checkRateLimit(`call:rl:init:${callerId}`, 5, 60);
  }

  /**
   * Check Targeted Call Initiation limit (Max 3/min per caller-receiver pair)
   */
  async checkTargetedInitiation(callerId, receiverId) {
    return this.checkRateLimit(`call:rl:target:${callerId}:${receiverId}`, 3, 60);
  }

  /**
   * Check SDP Offer limit (Max 10/min per participant/call)
   */
  async checkSdpOffer(callId, participantId) {
    return this.checkRateLimit(`call:rl:offer:${callId}:${participantId}`, 10, 60);
  }

  /**
   * Check SDP Answer limit (Max 10/min per participant/call)
   */
  async checkSdpAnswer(callId, participantId) {
    return this.checkRateLimit(`call:rl:answer:${callId}:${participantId}`, 10, 60);
  }

  /**
   * Check ICE Candidate limit (Max 120/min per participant/call)
   */
  async checkIceCandidate(callId, participantId) {
    return this.checkRateLimit(`call:rl:ice:${callId}:${participantId}`, 120, 60);
  }

  /**
   * Check Invalid Event attempts limit (Max 20/min per user)
   */
  async checkInvalidAttempts(userId) {
    return this.checkRateLimit(`call:rl:invalid:${userId}`, 20, 60);
  }

  /**
   * Check Call State mutation limit (Max 30/min per call)
   */
  async checkStateMutation(callId) {
    return this.checkRateLimit(`call:rl:mutation:${callId}`, 30, 60);
  }
}

const callRateLimiter = new CallRateLimiter();

module.exports = callRateLimiter;
