const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const AdminAuditLog = require('../models/AdminAuditLog');
const { LedgerEntryTypes, LedgerTransactionTypes, PaidSessionStatuses } = require('../models/enums');

/**
 * Enterprise Audit & Reconciliation Service for Rubaru Double-Entry Financial Records
 * Strictly read-only by default; safe repairs require explicit authorized admin action.
 * Never silently rewrites, deletes, or fabricates financial history.
 */
class ReconciliationService {
  /**
   * 1. Check double-entry equality (Debit sum == Credit sum per transactionId)
   * 2. Detect single-sided transfers
   * 3. Detect mismatched debit and credit amounts
   */
  async reconcileDoubleEntryLedger(options = {}) {
    const issues = [];
    const matchStage = {};
    if (options.userIds && options.userIds.length > 0) {
      matchStage.userId = { $in: options.userIds };
    }
    const pipeline = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    pipeline.push({
      $group: {
        _id: '$transactionId',
        entriesCount: { $sum: 1 },
        debitCount: {
          $sum: { $cond: [{ $eq: ['$entryType', LedgerEntryTypes.DEBIT] }, 1, 0] },
        },
        creditCount: {
          $sum: { $cond: [{ $eq: ['$entryType', LedgerEntryTypes.CREDIT] }, 1, 0] },
        },
        debitSum: {
          $sum: { $cond: [{ $eq: ['$entryType', LedgerEntryTypes.DEBIT] }, '$amount', 0] },
        },
        creditSum: {
          $sum: { $cond: [{ $eq: ['$entryType', LedgerEntryTypes.CREDIT] }, '$amount', 0] },
        },
        types: { $push: '$transactionType' },
        sessionIds: { $addToSet: '$sessionId' },
      },
    });

    const grouped = await WalletLedger.aggregate(pipeline);

    for (const group of grouped) {
      const isSingleSidedAllowed =
        group.types.includes('INITIAL_MIGRATION') ||
        group.types.includes('DEPOSIT') ||
        group.types.includes('ADMIN_ADJUSTMENT');

      if (isSingleSidedAllowed) {
        continue;
      }

      // Check 1: Debit without matching credit
      if (group.debitCount > 0 && group.creditCount === 0) {
        issues.push({
          type: 'DEBIT_WITHOUT_MATCHING_CREDIT',
          severity: 'CRITICAL',
          transactionId: group._id,
          debitSum: group.debitSum,
          creditSum: 0,
        });
      }

      // Check 2: Credit without matching debit
      if (group.creditCount > 0 && group.debitCount === 0) {
        issues.push({
          type: 'CREDIT_WITHOUT_MATCHING_DEBIT',
          severity: 'CRITICAL',
          transactionId: group._id,
          debitSum: 0,
          creditSum: group.creditSum,
        });
      }

      // Check 3: Mismatched debit and credit amounts
      if (group.debitSum !== group.creditSum) {
        issues.push({
          type: 'MISMATCHED_DEBIT_CREDIT_AMOUNTS',
          severity: 'CRITICAL',
          transactionId: group._id,
          debitSum: group.debitSum,
          creditSum: group.creditSum,
          difference: group.debitSum - group.creditSum,
        });
      }

      // Check 4: Missing second leg for communication transfer
      if (group.entriesCount < 2 && !isSingleSidedAllowed) {
        issues.push({
          type: 'SINGLE_SIDED_COMMUNICATION_TRANSFER',
          severity: 'HIGH',
          transactionId: group._id,
          entriesCount: group.entriesCount,
        });
      }
    }

    return {
      passed: issues.length === 0,
      totalTransactionsAudited: grouped.length,
      issuesCount: issues.length,
      issues,
    };
  }

  /**
   * 4. Detect duplicate session-minute charges
   * 5. Detect missing session charge records
   * 6. Detect session totals differing from ledger totals
   * 7. Detect charges against non-active / terminated sessions
   * 8. Detect charges before genuine connection
   * 9. Detect incorrect rate snapshots
   */
  async reconcileSessionTotals(options = {}) {
    const issues = [];
    const query = {};
    if (options.sessionIds && options.sessionIds.length > 0) {
      query.sessionId = { $in: options.sessionIds };
    } else if (options.userIds && options.userIds.length > 0) {
      query.$or = [{ initiatorId: { $in: options.userIds } }, { receiverId: { $in: options.userIds } }];
    }

    const sessions = await PaidCommunicationSession.find(query).lean();

    for (const session of sessions) {
      const ledgerEntries = await WalletLedger.find({ sessionId: session.sessionId }).lean();
      const debits = ledgerEntries.filter((e) => e.entryType === LedgerEntryTypes.DEBIT);
      const credits = ledgerEntries.filter((e) => e.entryType === LedgerEntryTypes.CREDIT);

      const ledgerDebitSum = debits.reduce((acc, curr) => acc + curr.amount, 0);
      const ledgerCreditSum = credits.reduce((acc, curr) => acc + curr.amount, 0);

      // Check: Session totals differ from ledger totals
      if (session.totalCoinsCharged !== ledgerDebitSum) {
        issues.push({
          type: 'SESSION_TOTAL_MISMATCH',
          severity: 'HIGH',
          sessionId: session.sessionId,
          sessionRecordedTotal: session.totalCoinsCharged,
          ledgerDebitTotal: ledgerDebitSum,
          difference: session.totalCoinsCharged - ledgerDebitSum,
        });
      }

      // Check: Duplicate minute charges
      const minuteDebitCounts = {};
      for (const debit of debits) {
        const m = debit.minuteIndex;
        minuteDebitCounts[m] = (minuteDebitCounts[m] || 0) + 1;
        if (minuteDebitCounts[m] > 1) {
          issues.push({
            type: 'DUPLICATE_SESSION_MINUTE_CHARGE',
            severity: 'CRITICAL',
            sessionId: session.sessionId,
            minuteIndex: m,
            occurrences: minuteDebitCounts[m],
          });
        }
      }

      // Check: Missing session charge records
      if (session.billedMinutes > 0 && debits.length < session.billedMinutes) {
        issues.push({
          type: 'MISSING_SESSION_CHARGE_RECORDS',
          severity: 'HIGH',
          sessionId: session.sessionId,
          billedMinutes: session.billedMinutes,
          recordedDebitsCount: debits.length,
          missingCount: session.billedMinutes - debits.length,
        });
      }

      // Check: Charges before genuine connection
      if (session.connectedAt) {
        const prematureDebits = debits.filter((d) => d.createdAt < session.connectedAt);
        if (prematureDebits.length > 0) {
          issues.push({
            type: 'CHARGE_BEFORE_GENUINE_CONNECTION',
            severity: 'CRITICAL',
            sessionId: session.sessionId,
            connectedAt: session.connectedAt,
            prematureCount: prematureDebits.length,
          });
        }
      } else if (debits.length > 0) {
        issues.push({
          type: 'CHARGE_ON_UNCONNECTED_SESSION',
          severity: 'CRITICAL',
          sessionId: session.sessionId,
          debitsCount: debits.length,
        });
      }

      // Check: Charges after session termination
      if (session.endedAt) {
        const postEndDebits = debits.filter((d) => d.createdAt > new Date(session.endedAt.getTime() + 1000));
        if (postEndDebits.length > 0) {
          issues.push({
            type: 'CHARGE_AFTER_SESSION_TERMINATION',
            severity: 'CRITICAL',
            sessionId: session.sessionId,
            endedAt: session.endedAt,
            postEndCount: postEndDebits.length,
          });
        }
      }

      // Check: Incorrect rate snapshot
      for (const debit of debits) {
        if (session.ratePerMinuteSnapshot && debit.amount !== session.ratePerMinuteSnapshot) {
          issues.push({
            type: 'INCORRECT_RATE_SNAPSHOT',
            severity: 'HIGH',
            sessionId: session.sessionId,
            minuteIndex: debit.minuteIndex,
            expectedRate: session.ratePerMinuteSnapshot,
            actualAmount: debit.amount,
          });
        }
      }
    }

    return {
      passed: issues.length === 0,
      totalSessionsAudited: sessions.length,
      issuesCount: issues.length,
      issues,
    };
  }

  /**
   * 10. Detect wallet totals differing from ledger-derived balances
   * 11. Detect illegal negative balances
   * 12. Detect missing idempotency keys
   * 13. Detect orphaned ledger entries
   */
  async reconcileWalletBalances(options = {}) {
    const issues = [];
    const query = {};
    if (options.userIds && options.userIds.length > 0) {
      query.userId = { $in: options.userIds };
    }
    const wallets = await Wallet.find(query).lean();

    for (const wallet of wallets) {
      // Check: Illegal negative balance
      if (wallet.availableBalance < 0) {
        issues.push({
          type: 'ILLEGAL_NEGATIVE_BALANCE',
          severity: 'CRITICAL',
          userId: wallet.userId.toString(),
          availableBalance: wallet.availableBalance,
        });
      }

      const [ledgerCredits, ledgerDebits] = await Promise.all([
        WalletLedger.aggregate([
          { $match: { userId: wallet.userId, entryType: LedgerEntryTypes.CREDIT } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        WalletLedger.aggregate([
          { $match: { userId: wallet.userId, entryType: LedgerEntryTypes.DEBIT } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
      ]);

      const totalCredits = ledgerCredits.length > 0 ? ledgerCredits[0].total : 0;
      const totalDebits = ledgerDebits.length > 0 ? ledgerDebits[0].total : 0;

      if (totalCredits === 0 && totalDebits === 0 && !options.userIds) {
        continue;
      }

      const expectedBalance = totalCredits - totalDebits;

      // Check: Wallet totals differ from ledger-derived balances
      if (wallet.availableBalance !== expectedBalance) {
        issues.push({
          type: 'WALLET_LEDGER_DRIFT',
          severity: 'HIGH',
          userId: wallet.userId.toString(),
          walletBalance: wallet.availableBalance,
          expectedLedgerBalance: expectedBalance,
          drift: wallet.availableBalance - expectedBalance,
        });
      }
    }

    // Check: Missing idempotency keys on ledger entries
    const missingIdempotencyCount = await WalletLedger.countDocuments({
      $or: [{ idempotencyKey: null }, { idempotencyKey: '' }, { idempotencyKey: { $exists: false } }],
    });

    if (missingIdempotencyCount > 0) {
      issues.push({
        type: 'MISSING_IDEMPOTENCY_KEYS',
        severity: 'MEDIUM',
        count: missingIdempotencyCount,
      });
    }

    // Check: Orphaned ledger entries (entries referencing deleted/nonexistent wallets)
    const ledgerUserIds = await WalletLedger.distinct('userId');
    const existingWalletUserIds = (await Wallet.distinct('userId')).map((id) => id.toString());
    const orphanedUserIds = ledgerUserIds.filter((id) => id && !existingWalletUserIds.includes(id.toString()));

    if (orphanedUserIds.length > 0) {
      issues.push({
        type: 'ORPHANED_LEDGER_ENTRIES',
        severity: 'CRITICAL',
        orphanedUserIds,
        count: orphanedUserIds.length,
      });
    }

    return {
      passed: issues.length === 0,
      totalWalletsAudited: wallets.length,
      issuesCount: issues.length,
      issues,
    };
  }

  /**
   * 14. Detect stale processing leases & sessions stuck in non-terminal states
   */
  async reconcileStaleSessions(options = {}) {
    const issues = [];
    const now = new Date();
    const staleLeaseCutoff = new Date(now.getTime() - 60000); // 1 minute
    const stuckStateCutoff = new Date(now.getTime() - 300000); // 5 minutes

    // Stale leases
    const staleLeaseSessions = await PaidCommunicationSession.find({
      billingLeaseExpiresAt: { $lt: staleLeaseCutoff, $ne: null },
      status: PaidSessionStatuses.ACTIVE,
    }).lean();

    for (const session of staleLeaseSessions) {
      issues.push({
        type: 'STALE_PROCESSING_LEASE',
        severity: 'MEDIUM',
        sessionId: session.sessionId,
        leaseOwner: session.billingLeaseOwner,
        leaseExpiresAt: session.billingLeaseExpiresAt,
      });
    }

    // Stuck non-terminal sessions
    const stuckSessions = await PaidCommunicationSession.find({
      status: {
        $in: [
          PaidSessionStatuses.PENDING,
          PaidSessionStatuses.ACCEPTED,
          PaidSessionStatuses.CONNECTING,
          PaidSessionStatuses.ENDING,
        ],
      },
      updatedAt: { $lt: stuckStateCutoff },
    }).lean();

    for (const session of stuckSessions) {
      issues.push({
        type: 'SESSION_STUCK_IN_NON_TERMINAL_STATE',
        severity: 'MEDIUM',
        sessionId: session.sessionId,
        status: session.status,
        updatedAt: session.updatedAt,
      });
    }

    return {
      passed: issues.length === 0,
      totalStaleIssues: issues.length,
      issues,
    };
  }

  /**
   * Run full comprehensive reconciliation suite across all 15 audit dimensions
   */
  async runFullReconciliation(options = {}) {
    const checkedAt = new Date();
    const [doubleEntry, sessionTotals, walletBalances, staleSessions] = await Promise.all([
      this.reconcileDoubleEntryLedger(options),
      this.reconcileSessionTotals(options),
      this.reconcileWalletBalances(options),
      this.reconcileStaleSessions(options),
    ]);

    const allIssues = [
      ...doubleEntry.issues,
      ...sessionTotals.issues,
      ...walletBalances.issues,
      ...staleSessions.issues,
    ];

    const criticalCount = allIssues.filter((i) => i.severity === 'CRITICAL').length;
    const highCount = allIssues.filter((i) => i.severity === 'HIGH').length;
    const mediumCount = allIssues.filter((i) => i.severity === 'MEDIUM').length;

    const isHealthy = allIssues.length === 0;

    return {
      isHealthy,
      checkedAt,
      summary: {
        totalIssues: allIssues.length,
        criticalCount,
        highCount,
        mediumCount,
        doubleEntryStatus: doubleEntry.passed ? 'HEALTHY' : 'IMBALANCE_DETECTED',
        sessionTotalsStatus: sessionTotals.passed ? 'HEALTHY' : 'MISMATCH_DETECTED',
        walletBalancesStatus: walletBalances.passed ? 'HEALTHY' : 'DRIFT_DETECTED',
        staleSessionsStatus: staleSessions.passed ? 'HEALTHY' : 'STALE_ITEMS_DETECTED',
      },
      details: {
        doubleEntry,
        sessionTotals,
        walletBalances,
        staleSessions,
      },
      allIssues,
    };
  }

  /**
   * Safe, Audited Admin Repair Workflow
   * Never mutates or deletes historical ledger entries.
   * Creates explicit compensating adjustment ledger records with full audit trail.
   */
  async executeSafeRepair({ adminUserId, issueType, targetId, reason, ipAddress }) {
    if (!adminUserId) {
      throw new Error('ADMIN_USER_REQUIRED: Authorized admin user ID is required for repair operations.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('REASON_REQUIRED: Explicit substantive reason is required for repair.');
    }

    const session = await mongoose.startSession();
    try {
      let repairResult = null;
      await session.withTransaction(async () => {
        if (issueType === 'STALE_PROCESSING_LEASE') {
          const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: targetId }).session(session);
          if (!sessionDoc) throw new Error(`Session ${targetId} not found`);

          sessionDoc.billingLeaseExpiresAt = null;
          sessionDoc.billingLeaseOwner = null;
          await sessionDoc.save({ session });

          repairResult = { action: 'LEASE_CLEARED', sessionId: targetId };
        } else if (issueType === 'SESSION_STUCK_IN_NON_TERMINAL_STATE') {
          const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: targetId }).session(session);
          if (!sessionDoc) throw new Error(`Session ${targetId} not found`);

          sessionDoc.status = PaidSessionStatuses.ENDED;
          sessionDoc.endedAt = new Date();
          sessionDoc.endReason = 'ADMIN_RECONCILIATION_TERMINATION';
          await sessionDoc.save({ session });

          repairResult = { action: 'SESSION_TERMINATED', sessionId: targetId };
        } else if (issueType === 'WALLET_LEDGER_DRIFT') {
          const wallet = await Wallet.findOne({ userId: targetId }).session(session);
          if (!wallet) throw new Error(`Wallet for user ${targetId} not found`);

          const [credits, debits] = await Promise.all([
            WalletLedger.aggregate([
              { $match: { userId: wallet.userId, entryType: LedgerEntryTypes.CREDIT } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]).session(session),
            WalletLedger.aggregate([
              { $match: { userId: wallet.userId, entryType: LedgerEntryTypes.DEBIT } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ]).session(session),
          ]);

          const totalCredits = credits.length > 0 ? credits[0].total : 0;
          const totalDebits = debits.length > 0 ? debits[0].total : 0;
          const trueLedgerBalance = totalCredits - totalDebits;

          const drift = wallet.availableBalance - trueLedgerBalance;
          if (drift === 0) {
            repairResult = { action: 'NO_DRIFT_DETECTED', userId: targetId };
            return;
          }

          const balanceBefore = wallet.availableBalance;
          wallet.availableBalance = trueLedgerBalance;
          wallet.version += 1;
          await wallet.save({ session });

          const repairTxId = uuidv4();
          const compensatingEntry = new WalletLedger({
            transactionId: repairTxId,
            walletId: wallet._id,
            userId: wallet.userId,
            entryType: drift > 0 ? LedgerEntryTypes.DEBIT : LedgerEntryTypes.CREDIT,
            transactionType: LedgerTransactionTypes.ADMIN_ADJUSTMENT,
            amount: Math.abs(drift),
            balanceBefore,
            balanceAfter: trueLedgerBalance,
            idempotencyKey: `reconciliation-repair:${repairTxId}`,
            metadata: {
              repairedByAdminId: adminUserId,
              reason: `Reconciliation drift compensation: ${reason}`,
            },
          });
          await compensatingEntry.save({ session });

          repairResult = {
            action: 'WALLET_BALANCE_RECONCILED',
            userId: targetId,
            balanceBefore,
            balanceAfter: trueLedgerBalance,
            compensatingTransactionId: repairTxId,
          };
        } else {
          throw new Error(`Unsupported issue repair type: ${issueType}`);
        }

        await AdminAuditLog.create(
          [
            {
              adminUserId,
              action: 'RECONCILIATION_SAFE_REPAIR',
              targetType: 'RECONCILIATION',
              targetId,
              changes: repairResult,
              reason,
              ipAddress: ipAddress || null,
            },
          ],
          { session }
        );
      });

      return { ok: true, repairResult };
    } finally {
      await session.endSession();
    }
  }
}

const reconciliationService = new ReconciliationService();

module.exports = reconciliationService;
