const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const { LedgerEntryTypes, CallStatuses, PaidSessionStatuses } = require('../models/enums');

class CallBillingReconciliationService {
  /**
   * Run read-only reconciliation scan on call billing data
   */
  async runReconciliationScan({ limit = 1000, sinceDate = null } = {}) {
    const query = {};
    if (sinceDate) {
      query.createdAt = { $gte: new Date(sinceDate) };
    }

    const sessions = await PaidCommunicationSession.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    let totalChecked = 0;
    let reconciledCount = 0;
    let discrepancyCount = 0;
    const discrepancies = [];

    for (const session of sessions) {
      totalChecked++;
      const sessionId = session.sessionId || session.callId;

      // Find ledger deductions for this session
      const ledgerEntries = await WalletLedger.find({
        $or: [
          { sessionId },
          { 'metadata.sessionId': sessionId },
        ],
        entryType: { $in: [LedgerEntryTypes.DEBIT, LedgerEntryTypes.CREDIT] },
      });

      const debitEntries = ledgerEntries.filter((e) => e.entryType === LedgerEntryTypes.DEBIT);
      const creditEntries = ledgerEntries.filter((e) => e.entryType === LedgerEntryTypes.CREDIT);

      const totalDebitDeducted = debitEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      const totalCreditAdded = creditEntries.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
      const sessionCharged = session.totalCoinsCharged || session.coinsCharged || 0;

      const isNonConnected = [
        CallStatuses.REJECTED,
        CallStatuses.CANCELLED,
        CallStatuses.MISSED,
        CallStatuses.FAILED,
        'REJECTED',
        'CANCELLED',
        'MISSED',
        'FAILED',
      ].includes(session.status);

      let hasIssue = false;
      let issueDetails = [];

      // Check 1: Non-connected call must have 0 charges
      if (isNonConnected && (sessionCharged > 0 || totalDebitDeducted > 0)) {
        hasIssue = true;
        issueDetails.push(`Non-connected call has non-zero charges (Session: ${sessionCharged}, Ledger Debit: ${totalDebitDeducted})`);
      }

      // Check 2: Connected call session charged matches ledger debit deductions
      if (!isNonConnected && sessionCharged !== totalDebitDeducted) {
        hasIssue = true;
        issueDetails.push(`Session totalCoinsCharged (${sessionCharged}) does not equal Ledger Debit total (${totalDebitDeducted})`);
      }

      // Check 3: Dual-entry parity: Debits must equal Credits in 100% payout model
      if (totalDebitDeducted !== totalCreditAdded) {
        hasIssue = true;
        issueDetails.push(`Dual-entry mismatch: Ledger Debits (${totalDebitDeducted}) does not equal Ledger Credits (${totalCreditAdded})`);
      }

      if (hasIssue) {
        discrepancyCount++;
        discrepancies.push({
          sessionId,
          status: session.status,
          durationSeconds: session.durationSeconds,
          billedMinutes: session.billedMinutes,
          sessionCharged,
          totalLedgerDeducted,
          issues: issueDetails,
        });
      } else {
        reconciledCount++;
      }
    }

    return {
      totalChecked,
      reconciledCount,
      discrepancyCount,
      isFullyReconciled: discrepancyCount === 0,
      discrepancies,
      scannedAt: new Date().toISOString(),
    };
  }
}

module.exports = new CallBillingReconciliationService();
