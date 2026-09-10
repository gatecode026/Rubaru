const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const WalletLedger = require('../models/WalletLedger');
const reconciliationService = require('./reconciliationService');
const { PaidSessionStatuses, LedgerTransactionTypes } = require('../models/enums');

/**
 * Structured Production Telemetry & Observability Service
 * Tracks metrics and structured alerts without leaking private messages, SDPs, or keys.
 */
class TelemetryService {
  constructor() {
    this.inMemoryMetrics = {
      duplicateChargePreventedCount: 0,
      insufficientBalanceEndings: 0,
      turnFailures: 0,
      pushDeliveryFailures: 0,
      suspiciousActivityFlags: 0,
    };
  }

  recordEvent(eventType, count = 1) {
    if (this.inMemoryMetrics[eventType] !== undefined) {
      this.inMemoryMetrics[eventType] += count;
    }
  }

  /**
   * Aggregate operational metrics across the paid communication system
   */
  async getMetricsSummary() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const [
      totalSessionsLast24h,
      activeSessionsCount,
      endedSessionsLast24h,
      declinedSessionsLast24h,
      expiredSessionsLast24h,
      totalDebitsLast24h,
    ] = await Promise.all([
      PaidCommunicationSession.countDocuments({ createdAt: { $gte: oneDayAgo } }),
      PaidCommunicationSession.countDocuments({ status: PaidSessionStatuses.ACTIVE }),
      PaidCommunicationSession.countDocuments({ status: PaidSessionStatuses.ENDED, createdAt: { $gte: oneDayAgo } }),
      PaidCommunicationSession.countDocuments({ status: PaidSessionStatuses.DECLINED, createdAt: { $gte: oneDayAgo } }),
      PaidCommunicationSession.countDocuments({ status: PaidSessionStatuses.EXPIRED, createdAt: { $gte: oneDayAgo } }),
      WalletLedger.countDocuments({
        transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
        createdAt: { $gte: oneDayAgo },
      }),
    ]);

    const acceptanceRate =
      totalSessionsLast24h > 0
        ? (((totalSessionsLast24h - declinedSessionsLast24h - expiredSessionsLast24h) / totalSessionsLast24h) * 100).toFixed(2)
        : '100.00';

    return {
      timestamp: now,
      window: '24h',
      sessions: {
        totalLast24h: totalSessionsLast24h,
        currentlyActive: activeSessionsCount,
        ended: endedSessionsLast24h,
        declined: declinedSessionsLast24h,
        expired: expiredSessionsLast24h,
        acceptanceRatePercent: parseFloat(acceptanceRate),
      },
      billing: {
        totalDebitsRecordedLast24h: totalDebitsLast24h,
        duplicateChargePreventedCount: this.inMemoryMetrics.duplicateChargePreventedCount,
        insufficientBalanceEndings: this.inMemoryMetrics.insufficientBalanceEndings,
      },
      infrastructure: {
        turnFailures: this.inMemoryMetrics.turnFailures,
        pushDeliveryFailures: this.inMemoryMetrics.pushDeliveryFailures,
        suspiciousActivityFlags: this.inMemoryMetrics.suspiciousActivityFlags,
      },
    };
  }

  /**
   * Health and alert status check
   */
  async getHealthStatus() {
    const reconReport = await reconciliationService.runFullReconciliation();

    const activeAlerts = [];
    if (!reconReport.isHealthy) {
      activeAlerts.push({
        severity: 'CRITICAL',
        name: 'RECONCILIATION_INCONSISTENCY_DETECTED',
        details: reconReport.summary,
      });
    }

    return {
      status: reconReport.isHealthy ? 'HEALTHY' : 'DEGRADED',
      checkedAt: new Date(),
      alerts: activeAlerts,
      reconciliationSummary: reconReport.summary,
    };
  }
}

const telemetryService = new TelemetryService();

module.exports = telemetryService;
