const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const AdminAuditLog = require('../models/AdminAuditLog');
const { PaidSessionStatuses, LedgerEntryTypes } = require('../models/enums');

/**
 * Enterprise Fraud and Abuse Protection Service for Rubaru Paid Communications
 */
class FraudProtectionService {
  constructor(options = {}) {
    // Configurable thresholds
    const isProd = process.env.NODE_ENV === 'production';
    this.maxInitiationsPerMinute = options.maxInitiationsPerMinute || 5;
    this.maxConcurrentActiveSessions = options.maxConcurrentActiveSessions || 10;
    this.dailySpendThresholdCoins = options.dailySpendThresholdCoins || 50000;
    this.dailyEarningThresholdCoins = options.dailyEarningThresholdCoins || 50000;
    this.shortSessionThresholdSeconds = options.shortSessionThresholdSeconds || 10;
    this.repeatedPairVelocityLimitPerHour = options.repeatedPairVelocityLimitPerHour || 10;
  }

  /**
   * Pre-initiation fraud and safety checks
   */
  async validateSessionInitiation({ initiatorId, receiverId }) {
    if (initiatorId.toString() === receiverId.toString()) {
      return { allowed: false, code: 'SELF_COMMUNICATION_PROHIBITED', message: 'Cannot initiate session with yourself.' };
    }

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneDayAgo = new Date(now.getTime() - 86400000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // 1. Session Initiation Rate Limit (Per-Minute Velocity)
    const recentInitiationsCount = await PaidCommunicationSession.countDocuments({
      initiatorId,
      createdAt: { $gte: oneMinuteAgo },
    });

    if (recentInitiationsCount >= this.maxInitiationsPerMinute) {
      return {
        allowed: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many session requests. Maximum ${this.maxInitiationsPerMinute} requests per minute.`,
      };
    }

    // 2. Concurrent Active Session Limit
    const activeSessionsCount = await PaidCommunicationSession.countDocuments({
      $or: [{ initiatorId }, { receiverId: initiatorId }],
      status: {
        $in: [
          PaidSessionStatuses.PENDING,
          PaidSessionStatuses.ACCEPTED,
          PaidSessionStatuses.CONNECTING,
          PaidSessionStatuses.ACTIVE,
        ],
      },
    });

    if (activeSessionsCount >= this.maxConcurrentActiveSessions) {
      return {
        allowed: false,
        code: 'CONCURRENT_SESSION_LIMIT',
        message: 'You already have an active or pending communication session.',
      };
    }

    // 3. Repeated Pair Velocity Limit (e.g. repeated spam against same target)
    const pairSessionsLastHour = await PaidCommunicationSession.countDocuments({
      initiatorId,
      receiverId,
      createdAt: { $gte: oneHourAgo },
    });

    if (pairSessionsLastHour >= this.repeatedPairVelocityLimitPerHour) {
      return {
        allowed: false,
        code: 'PAIR_VELOCITY_EXCEEDED',
        message: 'Session velocity limit reached for this participant pair. Please try again later.',
      };
    }

    // 4. Daily Spend Threshold Check
    const dailyDebits = await WalletLedger.aggregate([
      {
        $match: {
          userId: initiatorId,
          entryType: LedgerEntryTypes.DEBIT,
          createdAt: { $gte: oneDayAgo },
        },
      },
      { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
    ]);

    const spentToday = dailyDebits.length > 0 ? dailyDebits[0].totalSpent : 0;
    if (spentToday >= this.dailySpendThresholdCoins) {
      return {
        allowed: false,
        code: 'DAILY_SPEND_THRESHOLD_REACHED',
        message: 'Daily coin spend threshold reached. Contact support for limit adjustments.',
      };
    }

    // 5. Daily Earning Threshold Check on Receiver
    const dailyCredits = await WalletLedger.aggregate([
      {
        $match: {
          userId: receiverId,
          entryType: LedgerEntryTypes.CREDIT,
          createdAt: { $gte: oneDayAgo },
        },
      },
      { $group: { _id: null, totalEarned: { $sum: '$amount' } } },
    ]);

    const earnedToday = dailyCredits.length > 0 ? dailyCredits[0].totalEarned : 0;
    if (earnedToday >= this.dailyEarningThresholdCoins) {
      return {
        allowed: false,
        code: 'DAILY_EARNING_THRESHOLD_REACHED',
        message: 'Receiver has reached maximum daily earning threshold.',
      };
    }

    return { allowed: true };
  }

  /**
   * Post-session anomaly detection (e.g. collusive loops, repeated short sessions)
   */
  async analyzeSessionAnomaly(sessionDoc) {
    if (!sessionDoc || !sessionDoc.connectedAt || !sessionDoc.endedAt) return null;

    const durationSeconds = Math.floor((sessionDoc.endedAt.getTime() - sessionDoc.connectedAt.getTime()) / 1000);
    const flags = [];

    // Check for rapid loop / artificial coin transfer
    if (durationSeconds < this.shortSessionThresholdSeconds) {
      const oneHourAgo = new Date(Date.now() - 3600000);
      const recentShortSessions = await PaidCommunicationSession.countDocuments({
        initiatorId: sessionDoc.initiatorId,
        receiverId: sessionDoc.receiverId,
        createdAt: { $gte: oneHourAgo },
        status: PaidSessionStatuses.ENDED,
      });

      if (recentShortSessions >= 5) {
        flags.push('REPEATED_SHORT_SESSIONS_COLLUSION_PATTERN');
      }
    }

    if (flags.length > 0) {
      console.warn(`[FRAUD ALERT] Session ${sessionDoc.sessionId} flagged with risk flags: ${flags.join(', ')}`);
    }

    return flags;
  }
}

const fraudProtectionService = new FraudProtectionService();

module.exports = fraudProtectionService;
