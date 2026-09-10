const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const Profile = require('../models/Profile');
const OutboxEvent = require('../models/OutboxEvent');
const {
  WalletStatuses,
  LedgerEntryTypes,
  LedgerTransactionTypes,
  OutboxStatuses,
} = require('../models/enums');

class WalletError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Idempotently get or create wallet for user
 */
async function getOrCreateWallet(userId, session = null) {
  if (!userId) {
    throw new WalletError('USER_ID_REQUIRED', 'User ID is required', 400);
  }

  const query = Wallet.findOne({ userId });
  if (session) query.session(session);
  let wallet = await query;

  if (!wallet) {
    try {
      const createOptions = session ? { session } : {};
      const created = await Wallet.create(
        [
          {
            userId,
            availableBalance: 0,
            lifetimeEarned: 0,
            lifetimeSpent: 0,
            status: WalletStatuses.ACTIVE,
            version: 0,
          },
        ],
        createOptions
      );
      wallet = created[0];
    } catch (err) {
      // Handle potential race condition on unique index
      if (err.code === 11000) {
        const retryQuery = Wallet.findOne({ userId });
        if (session) retryQuery.session(session);
        wallet = await retryQuery;
      } else {
        throw err;
      }
    }
  }

  return wallet;
}

/**
 * Retrieve verified wallet balance and stats
 */
async function getWalletBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  return {
    userId: wallet.userId.toString(),
    availableBalance: wallet.availableBalance,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeSpent: wallet.lifetimeSpent,
    status: wallet.status,
    updatedAt: wallet.updatedAt,
  };
}

/**
 * Retrieve paginated, sanitized transaction history for user
 */
async function getUserTransactions(userId, { limit = 20, page = 1, cursor = null } = {}) {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const query = { userId };

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const skip = cursor ? 0 : (Math.max(parseInt(page, 10) || 1, 1) - 1) * parsedLimit;

  const [ledgerEntries, totalCount] = await Promise.all([
    WalletLedger.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    WalletLedger.countDocuments({ userId }),
  ]);

  // Extract unique counterparties to fetch public profiles
  const counterpartyIds = [
    ...new Set(
      ledgerEntries
        .filter((entry) => entry.counterpartyUserId)
        .map((entry) => entry.counterpartyUserId.toString())
    ),
  ];

  const profiles = await Profile.find({ user: { $in: counterpartyIds } })
    .select('user displayName avatarUri username')
    .lean();

  const profileMap = new Map();
  profiles.forEach((p) => {
    profileMap.set(p.user.toString(), {
      userId: p.user.toString(),
      displayName: p.displayName || 'Rubaru Member',
      avatarUri: p.avatarUri || null,
      username: p.username || null,
    });
  });

  const formattedTransactions = ledgerEntries.map((entry) => {
    const counterpartySummary = entry.counterpartyUserId
      ? profileMap.get(entry.counterpartyUserId.toString()) || {
          userId: entry.counterpartyUserId.toString(),
          displayName: 'Rubaru Member',
          avatarUri: null,
        }
      : null;

    return {
      transactionId: entry.transactionId,
      sessionId: entry.sessionId,
      minuteIndex: entry.minuteIndex,
      entryType: entry.entryType,
      transactionType: entry.transactionType,
      communicationType: entry.communicationType,
      amount: entry.amount,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      counterparty: counterpartySummary,
      createdAt: entry.createdAt,
    };
  });

  const nextCursor =
    ledgerEntries.length === parsedLimit
      ? ledgerEntries[ledgerEntries.length - 1].createdAt.toISOString()
      : null;

  return {
    transactions: formattedTransactions,
    pagination: {
      totalCount,
      limit: parsedLimit,
      page: cursor ? null : Math.max(parseInt(page, 10) || 1, 1),
      nextCursor,
    },
  };
}

/**
 * Execute a transaction operation with exponential backoff retry for transient MongoDB errors
 */
async function runWithTransactionRetry(fn, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    attempt++;
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      const isTransient =
        err.hasErrorLabel &&
        (err.hasErrorLabel('TransientTransactionError') ||
          err.hasErrorLabel('UnknownTransactionCommitResult'));
      if (isTransient && attempt < maxRetries) {
        console.warn(`[WALLET TRANSACTION RETRY] Transient error on attempt ${attempt}, retrying...`, err.message);
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 50));
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

/**
 * Atomic communication minute charging inside a MongoDB transaction with concurrency hardening
 */
async function executeCommunicationCharge({ sessionDoc, minuteIndex, externalSession = null }) {
  if (!sessionDoc) {
    throw new WalletError('SESSION_REQUIRED', 'Paid communication session is required', 400);
  }

  const rate = sessionDoc.ratePerMinuteSnapshot;
  if (!rate || rate <= 0 || !Number.isInteger(rate)) {
    throw new WalletError('INVALID_RATE', 'Session rate is invalid', 400);
  }

  const performCharge = async (session) => {
    // 1. Check idempotency: Has this minute already been billed?
    const existingDebit = await WalletLedger.findOne({
      sessionId: sessionDoc.sessionId,
      minuteIndex,
      entryType: LedgerEntryTypes.DEBIT,
    }).session(session);

    if (existingDebit) {
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: existingDebit.transactionId,
        minuteIndex,
        amount: existingDebit.amount,
      };
    }

    // 2. Load and verify Initiator Wallet with conditional balance check
    const initiatorWallet = await getOrCreateWallet(sessionDoc.initiatorId, session);
    if (initiatorWallet.status !== WalletStatuses.ACTIVE) {
      throw new WalletError('WALLET_NOT_ACTIVE', `Initiator wallet is ${initiatorWallet.status}`, 403);
    }

    if (initiatorWallet.availableBalance < rate) {
      throw new WalletError(
        'INSUFFICIENT_BALANCE',
        `Initiator balance (${initiatorWallet.availableBalance}) is insufficient for minute rate (${rate})`,
        402
      );
    }

    // 3. Load Receiver Wallet with lock/session
    const receiverWallet = await getOrCreateWallet(sessionDoc.receiverId, session);
    if (receiverWallet.status !== WalletStatuses.ACTIVE) {
      throw new WalletError('WALLET_NOT_ACTIVE', `Receiver wallet is ${receiverWallet.status}`, 403);
    }

    // 4. Compute balance changes
    const transactionId = uuidv4();
    const initBalanceBefore = initiatorWallet.availableBalance;
    const initBalanceAfter = initBalanceBefore - rate;

    if (initBalanceAfter < 0) {
      throw new WalletError('NEGATIVE_BALANCE_PREVENTED', 'Debit would result in illegal negative balance', 400);
    }

    const recvBalanceBefore = receiverWallet.availableBalance;
    const recvBalanceAfter = recvBalanceBefore + rate;

    // 5. Update Initiator Wallet atomically with conditional check
    initiatorWallet.availableBalance = initBalanceAfter;
    initiatorWallet.lifetimeSpent += rate;
    initiatorWallet.version += 1;
    await initiatorWallet.save({ session });

    // 6. Update Receiver Wallet atomically
    receiverWallet.availableBalance = recvBalanceAfter;
    receiverWallet.lifetimeEarned += rate;
    receiverWallet.version += 1;
    await receiverWallet.save({ session });

    // 7. Write Debit Ledger Entry
    const debitKey = `communication-charge:${sessionDoc.sessionId}:${minuteIndex}:DEBIT`;
    const debitEntry = new WalletLedger({
      transactionId,
      walletId: initiatorWallet._id,
      userId: sessionDoc.initiatorId,
      sessionId: sessionDoc.sessionId,
      minuteIndex,
      entryType: LedgerEntryTypes.DEBIT,
      transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
      communicationType: sessionDoc.communicationType,
      amount: rate,
      balanceBefore: initBalanceBefore,
      balanceAfter: initBalanceAfter,
      counterpartyUserId: sessionDoc.receiverId,
      idempotencyKey: debitKey,
      metadata: {
        configurationVersion: sessionDoc.configurationVersion,
      },
    });
    await debitEntry.save({ session });

    // 8. Write Credit Ledger Entry
    const creditKey = `communication-charge:${sessionDoc.sessionId}:${minuteIndex}:CREDIT`;
    const creditEntry = new WalletLedger({
      transactionId,
      walletId: receiverWallet._id,
      userId: sessionDoc.receiverId,
      sessionId: sessionDoc.sessionId,
      minuteIndex,
      entryType: LedgerEntryTypes.CREDIT,
      transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
      communicationType: sessionDoc.communicationType,
      amount: rate,
      balanceBefore: recvBalanceBefore,
      balanceAfter: recvBalanceAfter,
      counterpartyUserId: sessionDoc.initiatorId,
      idempotencyKey: creditKey,
      metadata: {
        configurationVersion: sessionDoc.configurationVersion,
      },
    });
    await creditEntry.save({ session });

    // 9. Update Session state
    sessionDoc.billedMinutes = minuteIndex;
    sessionDoc.totalCoinsCharged += rate;
    sessionDoc.totalCoinsEarned += rate;
    const incrementSec = sessionDoc.billingIncrementSecondsSnapshot || 60;
    const baseTime = sessionDoc.connectedAt ? sessionDoc.connectedAt.getTime() : Date.now();
    sessionDoc.nextChargeAt = new Date(baseTime + minuteIndex * incrementSec * 1000);
    sessionDoc.latestBillingError = null;
    await sessionDoc.save({ session });

    // 10. Enqueue Outbox Events for real-time and distributed delivery
    const outboxEvents = [
      {
        eventType: 'paid_session.minute_charged',
        aggregateType: 'PAID_SESSION',
        aggregateId: sessionDoc.sessionId,
        payload: {
          sessionId: sessionDoc.sessionId,
          minuteIndex,
          amount: rate,
          initiatorId: sessionDoc.initiatorId.toString(),
          receiverId: sessionDoc.receiverId.toString(),
          communicationType: sessionDoc.communicationType,
          initiatorBalance: initBalanceAfter,
          receiverBalance: recvBalanceAfter,
        },
        payloadSchemaVersion: '1.0',
        deduplicationKey: `outbox:minute-charged:${sessionDoc.sessionId}:${minuteIndex}`,
        status: OutboxStatuses.PENDING,
      },
      {
        eventType: 'wallet.balance_updated',
        aggregateType: 'WALLET',
        aggregateId: initiatorWallet._id.toString(),
        payload: {
          userId: sessionDoc.initiatorId.toString(),
          availableBalance: initBalanceAfter,
          lifetimeSpent: initiatorWallet.lifetimeSpent,
        },
        payloadSchemaVersion: '1.0',
        deduplicationKey: `outbox:wallet-balance:${sessionDoc.initiatorId}:${transactionId}`,
        status: OutboxStatuses.PENDING,
      },
      {
        eventType: 'wallet.balance_updated',
        aggregateType: 'WALLET',
        aggregateId: receiverWallet._id.toString(),
        payload: {
          userId: sessionDoc.receiverId.toString(),
          availableBalance: recvBalanceAfter,
          lifetimeEarned: receiverWallet.lifetimeEarned,
        },
        payloadSchemaVersion: '1.0',
        deduplicationKey: `outbox:wallet-balance:${sessionDoc.receiverId}:${transactionId}`,
        status: OutboxStatuses.PENDING,
      },
    ];

    await OutboxEvent.insertMany(outboxEvents, { session });

    return {
      success: true,
      alreadyProcessed: false,
      transactionId,
      minuteIndex,
      amount: rate,
      initiatorBalance: initBalanceAfter,
      receiverBalance: recvBalanceAfter,
    };
  };

  if (externalSession) {
    return await performCharge(externalSession);
  }

  return await runWithTransactionRetry(performCharge);
}

module.exports = {
  getOrCreateWallet,
  getWalletBalance,
  getUserTransactions,
  executeCommunicationCharge,
  runWithTransactionRetry,
  WalletError,
};
