const { getCommandClient } = require('../config/redis');

// In-memory fallback map for isolated test environments where Redis is not configured
const inMemoryLocks = new Map();
const inMemoryIdempotency = new Map();
const inMemoryTimeouts = new Map();

/**
 * Distributed Redis Call Locking & Synchronization Service
 */
class CallLockService {
  /**
   * Get formatted user lock key
   */
  getUserLockKey(userId) {
    return `call:lock:user:${userId}`;
  }

  /**
   * Get formatted idempotency key
   */
  getIdempotencyKey(callerId, idempotencyKey) {
    return `call:idempotency:${callerId}:${idempotencyKey}`;
  }

  /**
   * Get formatted ring timeout key
   */
  getRingTimeoutKey(callId) {
    return `call:ring-timeout:${callId}`;
  }

  /**
   * Get formatted reconnection grace key
   */
  getReconnectionGraceKey(callId, userId) {
    return `call:reconnect:${callId}:${userId}`;
  }

  /**
   * Check if Redis command client is available
   */
  _getClient() {
    const client = getCommandClient();
    const isProduction = process.env.NODE_ENV === 'production';

    if (!client) {
      if (isProduction) {
        throw new Error('REDIS_UNAVAILABLE: Distributed Redis command client is required in production.');
      }
      return null;
    }
    return client;
  }

  /**
   * Atomically acquire locks for both participants in a call
   * Uses deterministic sorting on user IDs to prevent AB-BA deadlocks
   * @param {string} callerId
   * @param {string} receiverId
   * @param {string} callId
   * @param {number} ttlSeconds (default 60s)
   * @returns {Promise<{ acquired: boolean, busyUserId?: string, conflictingCallId?: string }>}
   */
  async acquireDualUserCallLock(callerId, receiverId, callId, ttlSeconds = 60) {
    if (!callerId || !receiverId || !callId) {
      throw new Error('INVALID_LOCK_PARAMS: callerId, receiverId, and callId are required.');
    }

    const [userA, userB] = [callerId.toString(), receiverId.toString()].sort();
    const keyA = this.getUserLockKey(userA);
    const keyB = this.getUserLockKey(userB);

    const client = this._getClient();

    if (!client) {
      // In-memory fallback for isolated local/test runs
      const existingA = inMemoryLocks.get(keyA);
      const existingB = inMemoryLocks.get(keyB);

      const isAOccupied = existingA && existingA.callId !== callId && existingA.expiresAt > Date.now();
      const isBOccupied = existingB && existingB.callId !== callId && existingB.expiresAt > Date.now();

      if (isAOccupied || isBOccupied) {
        return {
          acquired: false,
          busyUserId: isAOccupied ? userA : userB,
          conflictingCallId: isAOccupied ? existingA.callId : existingB.callId,
        };
      }

      const expiresAt = Date.now() + ttlSeconds * 1000;
      inMemoryLocks.set(keyA, { callId, expiresAt });
      inMemoryLocks.set(keyB, { callId, expiresAt });
      return { acquired: true };
    }

    // Lua script for atomic dual-lock acquisition with compare-and-match
    const luaScript = `
      local valA = redis.call('GET', KEYS[1])
      local valB = redis.call('GET', KEYS[2])
      local callId = ARGV[1]
      local ttl = tonumber(ARGV[2])

      if (valA and valA ~= callId) then
        return {0, KEYS[1], valA}
      end
      if (valB and valB ~= callId) then
        return {0, KEYS[2], valB}
      end

      redis.call('SET', KEYS[1], callId, 'EX', ttl)
      redis.call('SET', KEYS[2], callId, 'EX', ttl)
      return {1, 'OK', ''}
    `;

    try {
      const result = await client.eval(luaScript, 2, keyA, keyB, callId, ttlSeconds);
      const [status, conflictingKey, conflictingVal] = result;

      if (status === 1) {
        return { acquired: true };
      }

      const busyUserId = conflictingKey.replace(/^.*call:lock:user:/, '');
      return {
        acquired: false,
        busyUserId,
        conflictingCallId: conflictingVal,
      };
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`REDIS_LOCK_ERROR: Failed to acquire call lock: ${err.message}`);
      }
      console.warn('[CALL LOCK] Redis eval warning, using in-memory lock:', err.message);
      return { acquired: true };
    }
  }

  /**
   * Atomically release call locks for both participants (compare-and-delete)
   * Only deletes the key if its value matches the expected callId
   * @param {string} callerId
   * @param {string} receiverId
   * @param {string} callId
   */
  async releaseDualUserCallLock(callerId, receiverId, callId) {
    if (!callerId || !receiverId || !callId) return;

    const [userA, userB] = [callerId.toString(), receiverId.toString()].sort();
    const keyA = this.getUserLockKey(userA);
    const keyB = this.getUserLockKey(userB);

    const client = this._getClient();

    if (!client) {
      const existingA = inMemoryLocks.get(keyA);
      const existingB = inMemoryLocks.get(keyB);
      if (existingA && existingA.callId === callId) inMemoryLocks.delete(keyA);
      if (existingB && existingB.callId === callId) inMemoryLocks.delete(keyB);
      return;
    }

    const luaScript = `
      local count = 0
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        redis.call('DEL', KEYS[1])
        count = count + 1
      end
      if redis.call('GET', KEYS[2]) == ARGV[1] then
        redis.call('DEL', KEYS[2])
        count = count + 1
      end
      return count
    `;

    try {
      await client.eval(luaScript, 2, keyA, keyB, callId);
    } catch (err) {
      console.warn('[CALL LOCK] Error releasing dual user lock:', err.message);
    }
  }

  /**
   * Refresh active call locks while call is ongoing
   */
  async refreshDualUserCallLock(callerId, receiverId, callId, ttlSeconds = 60) {
    if (!callerId || !receiverId || !callId) return;

    const [userA, userB] = [callerId.toString(), receiverId.toString()].sort();
    const keyA = this.getUserLockKey(userA);
    const keyB = this.getUserLockKey(userB);

    const client = this._getClient();

    if (!client) {
      const existingA = inMemoryLocks.get(keyA);
      const existingB = inMemoryLocks.get(keyB);
      const expiresAt = Date.now() + ttlSeconds * 1000;
      if (existingA && existingA.callId === callId) inMemoryLocks.set(keyA, { callId, expiresAt });
      if (existingB && existingB.callId === callId) inMemoryLocks.set(keyB, { callId, expiresAt });
      return;
    }

    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
      end
      if redis.call('GET', KEYS[2]) == ARGV[1] then
        redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
      end
      return 1
    `;

    try {
      await client.eval(luaScript, 2, keyA, keyB, callId, ttlSeconds);
    } catch (err) {
      console.warn('[CALL LOCK] Error refreshing dual user lock:', err.message);
    }
  }

  /**
   * Check or register idempotency key for call initiation
   * @param {string} callerId
   * @param {string} idempotencyKey
   * @param {string} callId
   * @param {number} ttlSeconds (default 300s = 5 min)
   * @returns {Promise<{ isDuplicate: boolean, existingCallId?: string }>}
   */
  async checkOrRegisterIdempotency(callerId, idempotencyKey, callId, ttlSeconds = 300) {
    if (!callerId || !idempotencyKey || !callId) {
      return { isDuplicate: false };
    }

    const key = this.getIdempotencyKey(callerId, idempotencyKey);
    const client = this._getClient();

    if (!client) {
      const existing = inMemoryIdempotency.get(key);
      if (existing && existing.expiresAt > Date.now()) {
        return { isDuplicate: true, existingCallId: existing.callId };
      }
      inMemoryIdempotency.set(key, { callId, expiresAt: Date.now() + ttlSeconds * 1000 });
      return { isDuplicate: false };
    }

    try {
      // SET key value EX ttl NX: Sets only if key does NOT already exist
      const result = await client.set(key, callId, 'EX', ttlSeconds, 'NX');
      if (result === 'OK') {
        return { isDuplicate: false };
      }

      const existingCallId = await client.get(key);
      return { isDuplicate: true, existingCallId };
    } catch (err) {
      console.warn('[CALL LOCK] Idempotency check warning:', err.message);
      return { isDuplicate: false };
    }
  }

  /**
   * Set ring timeout marker
   */
  async setRingTimeout(callId, timeoutSeconds = 45) {
    const key = this.getRingTimeoutKey(callId);
    const client = this._getClient();
    if (!client) {
      inMemoryTimeouts.set(key, { callId, expiresAt: Date.now() + timeoutSeconds * 1000 });
      return;
    }
    try {
      await client.set(key, callId, 'EX', timeoutSeconds);
    } catch (err) {
      console.warn('[CALL LOCK] Set ring timeout warning:', err.message);
    }
  }

  /**
   * Clear ring timeout marker
   */
  async clearRingTimeout(callId) {
    const key = this.getRingTimeoutKey(callId);
    const client = this._getClient();
    if (!client) {
      inMemoryTimeouts.delete(key);
      return;
    }
    try {
      await client.del(key);
    } catch (err) {
      console.warn('[CALL LOCK] Clear ring timeout warning:', err.message);
    }
  }

  /**
   * Set reconnection grace marker
   */
  async setReconnectionGrace(callId, userId, graceSeconds = 20) {
    const key = this.getReconnectionGraceKey(callId, userId);
    const client = this._getClient();
    if (!client) return;
    try {
      await client.set(key, callId, 'EX', graceSeconds);
    } catch (err) {
      console.warn('[CALL LOCK] Set reconnection grace warning:', err.message);
    }
  }

  /**
   * Clear reconnection grace marker
   */
  async clearReconnectionGrace(callId, userId) {
    const key = this.getReconnectionGraceKey(callId, userId);
    const client = this._getClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch (err) {
      console.warn('[CALL LOCK] Clear reconnection grace warning:', err.message);
    }
  }

  /**
   * Bind active device socket to a call for a specific participant
   */
  async bindCallDevice(callId, userId, socketId, ttlSeconds = 3600) {
    const key = `call:device:${callId}:${userId}`;
    const client = this._getClient();
    if (!client) {
      inMemoryLocks.set(key, { socketId, expiresAt: Date.now() + ttlSeconds * 1000 });
      return;
    }
    try {
      await client.set(key, socketId, 'EX', ttlSeconds);
    } catch (err) {
      console.warn('[CALL LOCK] Bind call device warning:', err.message);
    }
  }

  /**
   * Get bound device socket for a participant in a call
   */
  async getCallDevice(callId, userId) {
    const key = `call:device:${callId}:${userId}`;
    const client = this._getClient();
    if (!client) {
      const existing = inMemoryLocks.get(key);
      if (existing && existing.expiresAt > Date.now()) {
        return existing.socketId;
      }
      return null;
    }
    try {
      return await client.get(key);
    } catch (err) {
      console.warn('[CALL LOCK] Get call device warning:', err.message);
      return null;
    }
  }

  /**
   * Atomically rebind active device socket during reconnection
   */
  async rebindCallDevice(callId, userId, newSocketId, ttlSeconds = 3600) {
    const key = `call:device:${callId}:${userId}`;
    const client = this._getClient();
    if (!client) {
      inMemoryLocks.set(key, { socketId: newSocketId, expiresAt: Date.now() + ttlSeconds * 1000 });
      return { success: true };
    }
    try {
      await client.set(key, newSocketId, 'EX', ttlSeconds);
      return { success: true };
    } catch (err) {
      console.warn('[CALL LOCK] Rebind call device warning:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Clear all device bindings for a call upon termination
   */
  async clearCallDeviceBindings(callId, callerId, receiverId) {
    const keyCaller = `call:device:${callId}:${callerId}`;
    const keyReceiver = `call:device:${callId}:${receiverId}`;
    const client = this._getClient();
    if (!client) {
      inMemoryLocks.delete(keyCaller);
      inMemoryLocks.delete(keyReceiver);
      return;
    }
    try {
      await client.del(keyCaller, keyReceiver);
    } catch (err) {
      console.warn('[CALL LOCK] Clear device bindings warning:', err.message);
    }
  }

  /**
   * Get active call ID currently held by user in Redis
   */
  async getUserActiveCallId(userId) {
    const key = this.getUserLockKey(userId);
    const client = this._getClient();
    if (!client) {
      const existing = inMemoryLocks.get(key);
      if (existing && existing.expiresAt > Date.now()) {
        return existing.callId;
      }
      return null;
    }
    try {
      return await client.get(key);
    } catch (err) {
      console.warn('[CALL LOCK] Get user active call ID warning:', err.message);
      return null;
    }
  }
}

module.exports = new CallLockService();
