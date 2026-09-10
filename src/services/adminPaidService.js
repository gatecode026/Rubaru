import api from './api';

/**
 * Admin Paid Communication Service
 * Centralized authenticated SDK for administrative financial operations.
 */
class AdminPaidService {
  /**
   * 1. Overview & Metrics
   */
  async getOverview({ timeframe = '7d', startDate = null, endDate = null } = {}) {
    const params = {};
    if (timeframe) params.timeframe = timeframe;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await api.get('/v1/admin/paid-communication/overview', { params });
    return response.data?.data || response.data;
  }

  /**
   * 2. Rates & Configuration
   */
  async getRates() {
    const response = await api.get('/v1/admin/paid-communication/rates');
    return response.data?.data || response.data;
  }

  async updateRates({ rates, billingIncrementSeconds, connectionGraceSeconds, heartbeatTimeoutSeconds, requestExpirationSeconds, enabled, reason }) {
    const response = await api.post('/v1/admin/paid-communication/rates', {
      rates,
      billingIncrementSeconds,
      connectionGraceSeconds,
      heartbeatTimeoutSeconds,
      requestExpirationSeconds,
      enabled,
      reason,
    });
    return response.data;
  }

  /**
   * 3. Sessions
   */
  async getSessions({ status, communicationType, userId, limit = 50, cursor = null, page = 1 } = {}) {
    const params = { limit, page };
    if (status) params.status = status;
    if (communicationType) params.communicationType = communicationType;
    if (userId) params.userId = userId;
    if (cursor) params.cursor = cursor;

    const response = await api.get('/v1/admin/paid-communication/sessions', { params });
    return response.data;
  }

  async getSessionDetail(sessionId) {
    const response = await api.get(`/v1/admin/paid-communication/sessions/${sessionId}`);
    return response.data?.data || response.data;
  }

  async endSession(sessionId, reason) {
    const response = await api.post(`/v1/admin/paid-communication/sessions/${sessionId}/end`, { reason });
    return response.data;
  }

  /**
   * 4. Wallets
   */
  async getWallets({ userId, status, limit = 50, page = 1 } = {}) {
    const params = { limit, page };
    if (userId) params.userId = userId;
    if (status) params.status = status;

    const response = await api.get('/v1/admin/paid-communication/wallets', { params });
    return response.data;
  }

  async getWalletDetail(userId) {
    const response = await api.get(`/v1/admin/paid-communication/wallets/${userId}`);
    return response.data?.data || response.data;
  }

  async freezeWallet(userId, reason) {
    const response = await api.post(`/v1/admin/paid-communication/wallets/${userId}/freeze`, { reason });
    return response.data;
  }

  async unfreezeWallet(userId, reason) {
    const response = await api.post(`/v1/admin/paid-communication/wallets/${userId}/unfreeze`, { reason });
    return response.data;
  }

  async adjustWallet(userId, { amount, type = 'CREDIT', reason, idempotencyKey = null }) {
    const response = await api.post(`/v1/admin/paid-communication/wallets/${userId}/adjust`, {
      amount,
      type,
      reason,
      idempotencyKey,
    });
    return response.data;
  }

  /**
   * 5. Ledger Explorer
   */
  async getLedger({ userId, sessionId, transactionId, entryType, transactionType, limit = 50, cursor = null, page = 1, format = null } = {}) {
    const params = { limit, page };
    if (userId) params.userId = userId;
    if (sessionId) params.sessionId = sessionId;
    if (transactionId) params.transactionId = transactionId;
    if (entryType) params.entryType = entryType;
    if (transactionType) params.transactionType = transactionType;
    if (cursor) params.cursor = cursor;
    if (format) params.format = format;

    const response = await api.get('/v1/admin/paid-communication/ledger', { params });
    return response.data;
  }

  /**
   * 6. Reconciliation
   */
  async getReconciliation() {
    const response = await api.get('/v1/admin/paid-communication/reconciliation');
    return response.data?.data || response.data;
  }

  async runReconciliation(reason = 'Admin triggered run') {
    const response = await api.post('/v1/admin/paid-communication/reconciliation/run', { reason });
    return response.data?.data || response.data;
  }

  async repairReconciliation({ issueType, targetId, reason }) {
    const response = await api.post('/v1/admin/paid-communication/reconciliation/repair', {
      issueType,
      targetId,
      reason,
    });
    return response.data;
  }

  /**
   * 7. Risk & Abuse
   */
  async getRiskAlerts() {
    const response = await api.get('/v1/admin/paid-communication/risk');
    return response.data?.data || response.data;
  }

  async executeRiskAction({ alertId, action, reason }) {
    const response = await api.post('/v1/admin/paid-communication/risk/action', {
      alertId,
      action,
      reason,
    });
    return response.data;
  }

  /**
   * 8. Workers & Operations
   */
  async getWorkerHealth() {
    const response = await api.get('/v1/admin/paid-communication/workers');
    return response.data?.data || response.data;
  }

  /**
   * 9. Feature Flags
   */
  async getFeatureFlags() {
    const response = await api.get('/v1/admin/paid-communication/flags');
    return response.data?.data || response.data;
  }

  async updateFeatureFlags({ flags, rolloutStage, reason }) {
    const response = await api.put('/v1/admin/paid-communication/feature-flags', {
      flags,
      rolloutStage,
      reason,
    });
    return response.data;
  }

  /**
   * 10. Audit Log
   */
  async getAuditLogs({ targetType, targetId, limit = 50, page = 1 } = {}) {
    const params = { limit, page };
    if (targetType) params.targetType = targetType;
    if (targetId) params.targetId = targetId;

    const response = await api.get('/v1/admin/paid-communication/audit-log', { params });
    return response.data;
  }
}

export const adminPaidService = new AdminPaidService();
export default adminPaidService;
