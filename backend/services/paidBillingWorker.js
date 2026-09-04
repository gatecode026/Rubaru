const { v4: uuidv4 } = require('uuid');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const Wallet = require('../models/Wallet');
const walletService = require('./walletService');
const paidCommunicationService = require('./paidCommunicationService');
const {
  PaidSessionStatuses,
  PaidSessionEndReasons,
} = require('../models/enums');

class PaidBillingWorker {
  constructor(options = {}) {
    this.workerId = options.workerId || `worker-${uuidv4()}`;
    this.pollIntervalMs = options.pollIntervalMs || 2000;
    this.leaseDurationMs = options.leaseDurationMs || 10000; // 10s lease
    this.isRunning = false;
    this.timer = null;
  }

  /**
   * Start worker background loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[PAID BILLING WORKER] Started billing worker ${this.workerId}`);
    this.scheduleNextTick();
  }

  /**
   * Stop worker background loop
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log(`[PAID BILLING WORKER] Stopped billing worker ${this.workerId}`);
  }

  scheduleNextTick() {
    if (!this.isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        await this.runBillingPass();
      } catch (err) {
        console.error('[PAID BILLING WORKER] Error during pass:', err.message);
      } finally {
        if (this.isRunning) {
          this.scheduleNextTick();
        }
      }
    }, this.pollIntervalMs);
  }

  /**
   * Run a single pass across active sessions and expired pending requests
   */
  async runBillingPass() {
    const now = new Date();

    // 1. Expire unaccepted pending sessions
    try {
      await paidCommunicationService.expirePendingSessions();
    } catch (expErr) {
      console.warn('[PAID BILLING WORKER] Expire pending error:', expErr.message);
    }

    // 2. Load active configuration for timing parameters
    let config;
    try {
      config = await PaidCommunicationConfig.getActiveConfig();
    } catch (cfgErr) {
      console.warn('[PAID BILLING WORKER] Config load error:', cfgErr.message);
      return { processed: 0, errors: 1 };
    }

    const heartbeatTimeoutMs = (config.heartbeatTimeoutSeconds + config.connectionGraceSeconds) * 1000;

    // 3. Find ACTIVE sessions needing charging or heartbeat reconciliation
    // Lease condition: billingLeaseExpiresAt is null or in the past
    const candidateSessions = await PaidCommunicationSession.find({
      status: PaidSessionStatuses.ACTIVE,
      $or: [
        { nextChargeAt: { $lte: now } },
        {
          lastInitiatorHeartbeatAt: { $lt: new Date(now.getTime() - heartbeatTimeoutMs) },
        },
        {
          lastReceiverHeartbeatAt: { $lt: new Date(now.getTime() - heartbeatTimeoutMs) },
        },
      ],
      $and: [
        {
          $or: [
            { billingLeaseExpiresAt: null },
            { billingLeaseExpiresAt: { $lte: now } },
          ],
        },
      ],
    }).limit(50);

    let processedCount = 0;
    let errorCount = 0;

    for (const candidate of candidateSessions) {
      // 4. Atomically claim lease on the candidate session
      const leaseExpiresAt = new Date(Date.now() + this.leaseDurationMs);
      const claimedSession = await PaidCommunicationSession.findOneAndUpdate(
        {
          _id: candidate._id,
          status: PaidSessionStatuses.ACTIVE,
          $or: [
            { billingLeaseExpiresAt: null },
            { billingLeaseExpiresAt: { $lte: now } },
          ],
        },
        {
          $set: {
            billingLeaseOwner: this.workerId,
            billingLeaseExpiresAt: leaseExpiresAt,
          },
        },
        { new: true }
      );

      if (!claimedSession) {
        // Lost lease race to another worker instance
        continue;
      }

      try {
        await this.processActiveSession(claimedSession, config, heartbeatTimeoutMs);
        processedCount++;
      } catch (procErr) {
        errorCount++;
        console.error(`[PAID BILLING WORKER] Failed processing session ${claimedSession.sessionId}:`, procErr.message);
        claimedSession.latestBillingError = procErr.message;
        claimedSession.billingLeaseExpiresAt = null;
        await claimedSession.save();
      }
    }

    return { processed: processedCount, errors: errorCount };
  }

  /**
   * Process a claimed active session (heartbeat checks, balance checks, minute charges)
   */
  async processActiveSession(sessionDoc, config, heartbeatTimeoutMs) {
    const now = new Date();

    // 1. Heartbeat Timeout Check
    const initHeartbeat = sessionDoc.lastInitiatorHeartbeatAt
      ? sessionDoc.lastInitiatorHeartbeatAt.getTime()
      : (sessionDoc.connectedAt ? sessionDoc.connectedAt.getTime() : 0);
    const recvHeartbeat = sessionDoc.lastReceiverHeartbeatAt
      ? sessionDoc.lastReceiverHeartbeatAt.getTime()
      : (sessionDoc.connectedAt ? sessionDoc.connectedAt.getTime() : 0);

    const isInitiatorDead = now.getTime() - initHeartbeat > heartbeatTimeoutMs;
    const isReceiverDead = now.getTime() - recvHeartbeat > heartbeatTimeoutMs;

    if (isInitiatorDead || isReceiverDead) {
      console.log(`[PAID BILLING WORKER] Session ${sessionDoc.sessionId} timed out due to missing heartbeats.`);
      sessionDoc.billingLeaseExpiresAt = null;
      await sessionDoc.save();
      await paidCommunicationService.endPaidSession({
        actorUserId: 'SYSTEM',
        sessionId: sessionDoc.sessionId,
        endReason: PaidSessionEndReasons.HEARTBEAT_TIMEOUT,
      });
      return;
    }

    // 2. Due Minute Charging
    if (sessionDoc.nextChargeAt && sessionDoc.nextChargeAt <= now) {
      const nextMinuteIndex = sessionDoc.billedMinutes + 1;
      const rate = sessionDoc.ratePerMinuteSnapshot;

      // Pre-check Initiator Wallet balance before starting this new minute
      const initiatorWallet = await Wallet.findOne({ userId: sessionDoc.initiatorId });
      if (!initiatorWallet || initiatorWallet.availableBalance < rate) {
        console.log(`[PAID BILLING WORKER] Session ${sessionDoc.sessionId} ended at minute boundary due to insufficient balance.`);
        sessionDoc.billingLeaseExpiresAt = null;
        await sessionDoc.save();
        await paidCommunicationService.endPaidSession({
          actorUserId: 'SYSTEM',
          sessionId: sessionDoc.sessionId,
          endReason: PaidSessionEndReasons.INSUFFICIENT_BALANCE,
        });
        return;
      }

      // Atomically charge the minute
      await walletService.executeCommunicationCharge({
        sessionDoc,
        minuteIndex: nextMinuteIndex,
      });
    }

    // 3. Release lease
    sessionDoc.billingLeaseExpiresAt = null;
    sessionDoc.billingLeaseOwner = null;
    await sessionDoc.save();
  }
}

const defaultWorker = new PaidBillingWorker();

module.exports = {
  PaidBillingWorker,
  defaultWorker,
};
