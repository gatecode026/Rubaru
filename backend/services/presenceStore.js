/**
 * Ephemeral Distributed Presence and Typing Store Abstraction
 * R3-08-REQ-001, R3-08-REQ-002, R3-08-REQ-005, R3-08-REQ-014, R3-08-REQ-017
 */

const DEFAULT_PRESENCE_LEASE_TTL_MS = 60 * 1000; // 60 seconds connection lease
const DEFAULT_TYPING_LEASE_TTL_MS = 5 * 1000;    // 5 seconds typing lease

class PresenceStore {
  async registerConnection(userId, connectionId, metadata = {}) { throw new Error('Not implemented'); }
  async refreshConnection(userId, connectionId) { throw new Error('Not implemented'); }
  async removeConnection(userId, connectionId) { throw new Error('Not implemented'); }
  async expireStaleConnections() { throw new Error('Not implemented'); }
  async getUserPresence(userId) { throw new Error('Not implemented'); }
  async getMultipleUsersPresence(userIds) { throw new Error('Not implemented'); }
  async getLastSeen(userId) { throw new Error('Not implemented'); }
  async setLastSeen(userId, timestamp) { throw new Error('Not implemented'); }
  async startTyping(conversationId, userId, connectionId) { throw new Error('Not implemented'); }
  async refreshTyping(conversationId, userId, connectionId) { throw new Error('Not implemented'); }
  async stopTyping(conversationId, userId, connectionId) { throw new Error('Not implemented'); }
  async expireTypingLeases() { throw new Error('Not implemented'); }
  async getTypingUsers(conversationId) { throw new Error('Not implemented'); }
  async clearConversationTyping(conversationId, userId = null) { throw new Error('Not implemented'); }
  async clearSocketTyping(connectionId) { throw new Error('Not implemented'); }
}

/**
 * InMemoryPresenceStore
 * Safe, atomic in-process store for development, testing, and single-instance runtime
 */
class InMemoryPresenceStore extends PresenceStore {
  constructor(options = {}) {
    super();
    this.presenceTtlMs = options.presenceTtlMs || DEFAULT_PRESENCE_LEASE_TTL_MS;
    this.typingTtlMs = options.typingTtlMs || DEFAULT_TYPING_LEASE_TTL_MS;

    // userConnections: Map<userIdStr, Map<connectionId, { expiresAt, metadata }>>
    this.userConnections = new Map();
    // connectionToUser: Map<connectionId, userIdStr>
    this.connectionToUser = new Map();

    // typingLeases: Map<conversationIdStr, Map<userIdStr, Map<connectionId, expiresAt>>>
    this.typingLeases = new Map();
    // socketTypingIndex: Map<connectionId, Set<{ conversationId, userId }>>
    this.socketTypingIndex = new Map();

    // lastSeenMap: Map<userIdStr, Date>
    this.lastSeenMap = new Map();

    // Store health flag
    this.isDegraded = false;
  }

  setDegraded(flag) {
    this.isDegraded = !!flag;
  }

  isHealthy() {
    return !this.isDegraded;
  }

  reset() {
    this.userConnections.clear();
    this.connectionToUser.clear();
    this.typingLeases.clear();
    this.socketTypingIndex.clear();
    this.lastSeenMap.clear();
    this.isDegraded = false;
  }

  // --- PRESENCE LIFECYCLE ---

  async registerConnection(userId, connectionId, metadata = {}) {
    if (this.isDegraded) {
      return { ok: false, degraded: true, isFirstConnection: false, totalConnections: 0 };
    }

    const uId = userId.toString();
    const connId = connectionId.toString();
    const now = Date.now();
    const expiresAt = now + this.presenceTtlMs;

    let userConns = this.userConnections.get(uId);
    let isFirstConnection = false;

    if (!userConns) {
      userConns = new Map();
      this.userConnections.set(uId, userConns);
      isFirstConnection = true;
    } else {
      // Purge any expired connections in place before counting
      for (const [existingConnId, record] of userConns.entries()) {
        if (record.expiresAt <= now) {
          userConns.delete(existingConnId);
          this.connectionToUser.delete(existingConnId);
        }
      }
      if (userConns.size === 0) {
        isFirstConnection = true;
      }
    }

    userConns.set(connId, { expiresAt, metadata, lastHeartbeat: now });
    this.connectionToUser.set(connId, uId);

    return {
      ok: true,
      degraded: false,
      isFirstConnection,
      totalConnections: userConns.size,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async refreshConnection(userId, connectionId) {
    if (this.isDegraded) {
      return { ok: false, degraded: true, refreshed: false };
    }

    const uId = userId.toString();
    const connId = connectionId.toString();
    const now = Date.now();

    const userConns = this.userConnections.get(uId);
    if (!userConns || !userConns.has(connId)) {
      return { ok: false, refreshed: false, notFound: true };
    }

    const record = userConns.get(connId);
    record.expiresAt = now + this.presenceTtlMs;
    record.lastHeartbeat = now;

    return {
      ok: true,
      refreshed: true,
      expiresAt: new Date(record.expiresAt).toISOString(),
    };
  }

  async removeConnection(userId, connectionId) {
    if (this.isDegraded) {
      return { ok: false, degraded: true, isLastDisconnect: false, remainingConnections: 0 };
    }

    const uId = userId.toString();
    const connId = connectionId.toString();
    const now = Date.now();

    const userConns = this.userConnections.get(uId);
    this.connectionToUser.delete(connId);

    if (!userConns) {
      return { ok: true, isLastDisconnect: false, remainingConnections: 0 };
    }

    userConns.delete(connId);

    // Clean up expired remaining connections
    for (const [existingConnId, record] of userConns.entries()) {
      if (record.expiresAt <= now) {
        userConns.delete(existingConnId);
        this.connectionToUser.delete(existingConnId);
      }
    }

    const remainingConnections = userConns.size;
    let isLastDisconnect = false;

    if (remainingConnections === 0) {
      this.userConnections.delete(uId);
      isLastDisconnect = true;
    }

    return {
      ok: true,
      isLastDisconnect,
      remainingConnections,
    };
  }

  async expireStaleConnections() {
    if (this.isDegraded) return [];

    const now = Date.now();
    const expiredUsers = [];

    for (const [uId, userConns] of this.userConnections.entries()) {
      for (const [connId, record] of userConns.entries()) {
        if (record.expiresAt <= now) {
          userConns.delete(connId);
          this.connectionToUser.delete(connId);
        }
      }

      if (userConns.size === 0) {
        this.userConnections.delete(uId);
        expiredUsers.push(uId);
      }
    }

    return expiredUsers;
  }

  async getUserPresence(userId) {
    if (this.isDegraded) {
      return { state: 'UNKNOWN', lastSeenAt: null, activeConnections: 0 };
    }

    const uId = userId.toString();
    const now = Date.now();
    const userConns = this.userConnections.get(uId);

    if (!userConns) {
      const lastSeenAt = this.lastSeenMap.get(uId) || null;
      return {
        state: 'OFFLINE',
        lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
        activeConnections: 0,
      };
    }

    // Filter valid active leases
    let validCount = 0;
    for (const [connId, record] of userConns.entries()) {
      if (record.expiresAt > now) {
        validCount++;
      } else {
        userConns.delete(connId);
        this.connectionToUser.delete(connId);
      }
    }

    if (validCount === 0) {
      this.userConnections.delete(uId);
      const lastSeenAt = this.lastSeenMap.get(uId) || null;
      return {
        state: 'OFFLINE',
        lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
        activeConnections: 0,
      };
    }

    return {
      state: 'ONLINE',
      lastSeenAt: null,
      activeConnections: validCount,
    };
  }

  async getMultipleUsersPresence(userIds) {
    const results = {};
    for (const uId of userIds) {
      results[uId.toString()] = await this.getUserPresence(uId);
    }
    return results;
  }

  async setLastSeen(userId, timestamp = new Date()) {
    const uId = userId.toString();
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    this.lastSeenMap.set(uId, d);
  }

  async getLastSeen(userId) {
    const uId = userId.toString();
    return this.lastSeenMap.get(uId) || null;
  }

  // --- TYPING LIFECYCLE ---

  async startTyping(conversationId, userId, connectionId) {
    if (this.isDegraded) {
      return { ok: false, degraded: true, isEffectiveTransition: false, activeTypersCount: 0 };
    }

    const convId = conversationId.toString();
    const uId = userId.toString();
    const connId = connectionId.toString();
    const now = Date.now();
    const expiresAt = now + this.typingTtlMs;

    let convTypers = this.typingLeases.get(convId);
    if (!convTypers) {
      convTypers = new Map();
      this.typingLeases.set(convId, convTypers);
    }

    let userTypingConns = convTypers.get(uId);
    let isEffectiveTransition = false;

    if (!userTypingConns) {
      userTypingConns = new Map();
      convTypers.set(uId, userTypingConns);
      isEffectiveTransition = true; // User was not typing previously in this conversation
    } else {
      // Purge expired leases for this user
      for (const [cId, exp] of userTypingConns.entries()) {
        if (exp <= now) {
          userTypingConns.delete(cId);
        }
      }
      if (userTypingConns.size === 0) {
        isEffectiveTransition = true;
      }
    }

    userTypingConns.set(connId, expiresAt);

    // Track in reverse index for socket disconnect cleanup
    let sockIndex = this.socketTypingIndex.get(connId);
    if (!sockIndex) {
      sockIndex = new Set();
      this.socketTypingIndex.set(connId, sockIndex);
    }
    sockIndex.add(`${convId}:::${uId}`);

    return {
      ok: true,
      isEffectiveTransition,
      expiresAt: new Date(expiresAt).toISOString(),
      activeTypersCount: convTypers.size,
    };
  }

  async refreshTyping(conversationId, userId, connectionId) {
    return this.startTyping(conversationId, userId, connectionId);
  }

  async stopTyping(conversationId, userId, connectionId) {
    if (this.isDegraded) {
      return { ok: false, degraded: true, isEffectiveTransition: false, remainingTypersCount: 0 };
    }

    const convId = conversationId.toString();
    const uId = userId.toString();
    const connId = connectionId.toString();
    const now = Date.now();

    const convTypers = this.typingLeases.get(convId);
    if (!convTypers) {
      return { ok: true, isEffectiveTransition: false, remainingTypersCount: 0 };
    }

    const userTypingConns = convTypers.get(uId);
    if (!userTypingConns) {
      return { ok: true, isEffectiveTransition: false, remainingTypersCount: convTypers.size };
    }

    userTypingConns.delete(connId);

    // Purge expired remaining leases
    for (const [cId, exp] of userTypingConns.entries()) {
      if (exp <= now) {
        userTypingConns.delete(cId);
      }
    }

    let isEffectiveTransition = false;
    if (userTypingConns.size === 0) {
      convTypers.delete(uId);
      isEffectiveTransition = true; // User stopped typing on all devices
    }

    if (convTypers.size === 0) {
      this.typingLeases.delete(convId);
    }

    // Clean up reverse index
    const sockIndex = this.socketTypingIndex.get(connId);
    if (sockIndex) {
      sockIndex.delete(`${convId}:::${uId}`);
      if (sockIndex.size === 0) {
        this.socketTypingIndex.delete(connId);
      }
    }

    return {
      ok: true,
      isEffectiveTransition,
      remainingTypersCount: convTypers.size,
    };
  }

  async expireTypingLeases() {
    if (this.isDegraded) return [];

    const now = Date.now();
    const expiredEvents = []; // Array of { conversationId, userId }

    for (const [convId, convTypers] of this.typingLeases.entries()) {
      for (const [uId, userTypingConns] of convTypers.entries()) {
        for (const [connId, exp] of userTypingConns.entries()) {
          if (exp <= now) {
            userTypingConns.delete(connId);
          }
        }

        if (userTypingConns.size === 0) {
          convTypers.delete(uId);
          expiredEvents.push({ conversationId: convId, userId: uId });
        }
      }

      if (convTypers.size === 0) {
        this.typingLeases.delete(convId);
      }
    }

    return expiredEvents;
  }

  async getTypingUsers(conversationId) {
    if (this.isDegraded) return [];

    const convId = conversationId.toString();
    const now = Date.now();
    const convTypers = this.typingLeases.get(convId);

    if (!convTypers) return [];

    const activeUserIds = [];
    for (const [uId, userTypingConns] of convTypers.entries()) {
      let hasActive = false;
      for (const [connId, exp] of userTypingConns.entries()) {
        if (exp > now) {
          hasActive = true;
          break;
        } else {
          userTypingConns.delete(connId);
        }
      }

      if (hasActive) {
        activeUserIds.push(uId);
      } else {
        convTypers.delete(uId);
      }
    }

    if (convTypers.size === 0) {
      this.typingLeases.delete(convId);
    }

    return activeUserIds;
  }

  async clearConversationTyping(conversationId, userId = null) {
    const convId = conversationId.toString();
    const convTypers = this.typingLeases.get(convId);
    if (!convTypers) return [];

    const clearedUsers = [];
    if (userId) {
      const uId = userId.toString();
      if (convTypers.has(uId)) {
        convTypers.delete(uId);
        clearedUsers.push(uId);
      }
    } else {
      for (const uId of convTypers.keys()) {
        clearedUsers.push(uId);
      }
      this.typingLeases.delete(convId);
    }

    return clearedUsers;
  }

  async clearSocketTyping(connectionId) {
    const connId = connectionId.toString();
    const sockIndex = this.socketTypingIndex.get(connId);
    if (!sockIndex) return [];

    const stoppedEvents = [];
    for (const item of sockIndex) {
      const [convId, uId] = item.split(':::');
      const stopRes = await this.stopTyping(convId, uId, connId);
      if (stopRes.isEffectiveTransition) {
        stoppedEvents.push({ conversationId: convId, userId: uId });
      }
    }

    this.socketTypingIndex.delete(connId);
    return stoppedEvents;
  }
}

/**
 * Singleton / Driver Manager
 */
let currentPresenceStore = new InMemoryPresenceStore();

function getPresenceStore() {
  return currentPresenceStore;
}

function setPresenceStore(store) {
  currentPresenceStore = store;
}

module.exports = {
  PresenceStore,
  InMemoryPresenceStore,
  getPresenceStore,
  setPresenceStore,
  DEFAULT_PRESENCE_LEASE_TTL_MS,
  DEFAULT_TYPING_LEASE_TTL_MS,
};
