import api from './api';
import { getSocket } from './socket';

/**
 * Frontend Paid Communication Service Client
 * Authoritative integration with Rubaru Backend V1 APIs & Sockets
 */
class PaidCommunicationClient {
  /**
   * Fetch active rate configuration from server
   */
  async getRates() {
    try {
      const res = await api.get('/v1/paid-communication/rates');
      return res.data?.data || { MESSAGE: 1, AUDIO: 5, VIDEO: 10 };
    } catch (err) {
      console.warn('[PAID COMM] Failed to fetch rates:', err.message);
      return { MESSAGE: 1, AUDIO: 5, VIDEO: 10 };
    }
  }

  /**
   * Initiate a new paid communication session
   * @param {string} receiverId - Counterparty user ID
   * @param {'MESSAGE' | 'AUDIO' | 'VIDEO'} communicationType
   * @param {string} [conversationId]
   */
  async initiateSession({ receiverId, communicationType, conversationId }) {
    const res = await api.post('/v1/paid-communication/sessions', {
      receiverId,
      communicationType,
      conversationId,
    });
    return res.data?.data;
  }

  /**
   * Accept an incoming paid session
   * @param {string} sessionId
   */
  async acceptSession(sessionId) {
    const res = await api.post(`/v1/paid-communication/sessions/${sessionId}/accept`);
    return res.data?.data;
  }

  /**
   * Decline an incoming paid session
   * @param {string} sessionId
   * @param {string} [reason]
   */
  async declineSession(sessionId, reason = 'DECLINED_BY_RECEIVER') {
    const res = await api.post(`/v1/paid-communication/sessions/${sessionId}/decline`, { reason });
    return res.data?.data;
  }

  /**
   * Cancel an outgoing pending paid session
   * @param {string} sessionId
   */
  async cancelSession(sessionId) {
    const res = await api.post(`/v1/paid-communication/sessions/${sessionId}/cancel`);
    return res.data?.data;
  }

  /**
   * Send authenticated participant connection readiness
   * @param {string} sessionId
   */
  async markConnected(sessionId) {
    const res = await api.post(`/v1/paid-communication/sessions/${sessionId}/connected`);
    return res.data?.data;
  }

  /**
   * Send session heartbeat to keep billing lease alive
   * @param {string} sessionId
   */
  async sendHeartbeat(sessionId) {
    try {
      const res = await api.post(`/v1/paid-communication/sessions/${sessionId}/heartbeat`);
      return res.data?.data;
    } catch (err) {
      console.warn('[PAID COMM] Heartbeat error:', err.message);
    }
  }

  /**
   * Terminate active paid session
   * @param {string} sessionId
   * @param {string} [endReason]
   */
  async endSession(sessionId, endReason = 'NORMAL_COMPLETION') {
    const res = await api.post(`/v1/paid-communication/sessions/${sessionId}/end`, { endReason });
    return res.data?.data;
  }

  /**
   * Fetch current session details
   * @param {string} sessionId
   */
  async getSession(sessionId) {
    const res = await api.get(`/v1/paid-communication/sessions/${sessionId}`);
    return res.data?.data;
  }
}

export const paidCommunicationClient = new PaidCommunicationClient();
export default paidCommunicationClient;
