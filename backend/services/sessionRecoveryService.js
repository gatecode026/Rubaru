const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const OutboxEvent = require('../models/OutboxEvent');
const { PaidSessionStatuses, PaidSessionEndReasons, OutboxStatuses } = require('../models/enums');

/**
 * Startup and Crash Recovery Service for Paid Communication Sessions
 */
class SessionRecoveryService {
  /**
   * Run startup reconciliation across all in-flight session states
   */
  async runStartupRecovery() {
    console.log('[SESSION RECOVERY] Running startup session recovery and lease reconciliation...');
    const now = new Date();
    const config = await PaidCommunicationConfig.getActiveConfig();
    const heartbeatTimeoutMs = (config.heartbeatTimeoutSeconds + config.connectionGraceSeconds) * 1000;

    let recoveredCount = 0;
    let expiredPendingCount = 0;
    let terminatedStaleCount = 0;
    let clearedLeasesCount = 0;

    // 1. Recover stale worker leases across all active sessions
    const staleLeasedSessions = await PaidCommunicationSession.find({
      billingLeaseExpiresAt: { $ne: null },
    });

    for (const session of staleLeasedSessions) {
      session.billingLeaseExpiresAt = null;
      session.billingLeaseOwner = null;
      await session.save();
      clearedLeasesCount++;
    }

    // 2. Expire outdated PENDING requests
    const expiredPending = await PaidCommunicationSession.find({
      status: PaidSessionStatuses.PENDING,
      requestExpiresAt: { $lte: now },
    });

    for (const session of expiredPending) {
      session.status = PaidSessionStatuses.EXPIRED;
      session.endedAt = now;
      session.endReason = PaidSessionEndReasons.EXPIRED;
      await session.save();

      await OutboxEvent.create({
        eventType: 'paid_session.ended',
        aggregateType: 'PAID_SESSION',
        aggregateId: session.sessionId,
        payload: {
          sessionId: session.sessionId,
          initiatorId: session.initiatorId.toString(),
          receiverId: session.receiverId.toString(),
          endReason: session.endReason,
          recoveryReason: 'STARTUP_PENDING_EXPIRED',
        },
        payloadSchemaVersion: '1.0',
        deduplicationKey: `outbox:recovery-expired:${session.sessionId}`,
        status: OutboxStatuses.PENDING,
      });

      expiredPendingCount++;
    }

    // 3. Clean up stale ACCEPTED or CONNECTING sessions that never established media connection
    const unjoinedSessions = await PaidCommunicationSession.find({
      status: { $in: [PaidSessionStatuses.ACCEPTED, PaidSessionStatuses.CONNECTING] },
      updatedAt: { $lt: new Date(now.getTime() - heartbeatTimeoutMs) },
    });

    for (const session of unjoinedSessions) {
      session.status = PaidSessionStatuses.ENDED;
      session.endedAt = now;
      session.endReason = PaidSessionEndReasons.CALL_MISSED;
      await session.save();

      await OutboxEvent.create({
        eventType: 'paid_session.ended',
        aggregateType: 'PAID_SESSION',
        aggregateId: session.sessionId,
        payload: {
          sessionId: session.sessionId,
          initiatorId: session.initiatorId.toString(),
          receiverId: session.receiverId.toString(),
          endReason: session.endReason,
          recoveryReason: 'STARTUP_UNJOINED_TIMEOUT',
        },
        payloadSchemaVersion: '1.0',
        deduplicationKey: `outbox:recovery-unjoined:${session.sessionId}`,
        status: OutboxStatuses.PENDING,
      });

      terminatedStaleCount++;
    }

    // 4. Terminate ACTIVE sessions with dead heartbeats from before the restart
    const deadActiveSessions = await PaidCommunicationSession.find({
      status: PaidSessionStatuses.ACTIVE,
      $or: [
        { lastInitiatorHeartbeatAt: { $lt: new Date(now.getTime() - heartbeatTimeoutMs) } },
        { lastReceiverHeartbeatAt: { $lt: new Date(now.getTime() - heartbeatTimeoutMs) } },
      ],
    });

    for (const session of deadActiveSessions) {
      session.status = PaidSessionStatuses.ENDED;
      session.endedAt = now;
      session.endReason = PaidSessionEndReasons.HEARTBEAT_TIMEOUT;
      await session.save();

      await OutboxEvent.create({
        eventType: 'paid_session.ended',
        aggregateType: 'PAID_SESSION',
        aggregateId: session.sessionId,
        payload: {
          sessionId: session.sessionId,
          initiatorId: session.initiatorId.toString(),
          receiverId: session.receiverId.toString(),
          billedMinutes: session.billedMinutes,
          totalCoinsCharged: session.totalCoinsCharged,
          endReason: session.endReason,
          recoveryReason: 'STARTUP_HEARTBEAT_TIMEOUT',
        },
        payloadSchemaVersion: '1.0',
        deduplicationKey: `outbox:recovery-heartbeat:${session.sessionId}`,
        status: OutboxStatuses.PENDING,
      });

      terminatedStaleCount++;
    }

    // 5. Ensure ENDING sessions are transitioned to ENDED
    const endingSessions = await PaidCommunicationSession.find({
      status: PaidSessionStatuses.ENDING,
    });

    for (const session of endingSessions) {
      session.status = PaidSessionStatuses.ENDED;
      session.endedAt = session.endedAt || now;
      await session.save();
      recoveredCount++;
    }

    console.log(
      `[SESSION RECOVERY COMPLETE] Cleared leases: ${clearedLeasesCount}, Expired pending: ${expiredPendingCount}, Stale terminated: ${terminatedStaleCount}, Ending resolved: ${recoveredCount}`
    );

    return {
      clearedLeasesCount,
      expiredPendingCount,
      terminatedStaleCount,
      recoveredCount,
      timestamp: now,
    };
  }
}

const sessionRecoveryService = new SessionRecoveryService();

module.exports = sessionRecoveryService;
