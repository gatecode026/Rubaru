import api from './api';
import { getSocket } from './socket';

class MessagingService {
  /**
   * List conversations (direct and groups)
   * @param {Object} options { cursor, limit, status, type }
   */
  async listConversations(options = {}) {
    const params = new URLSearchParams();
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('limit', options.limit);
    if (options.status) params.append('status', options.status);
    if (options.type) params.append('type', options.type);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/v1/conversations${queryStr}`);
    return res.data;
  }

  /**
   * Get single conversation details
   */
  async getConversation(conversationId) {
    const res = await api.get(`/v1/conversations/${conversationId}`);
    return res.data;
  }

  /**
   * Ensure an active direct match conversation
   */
  async ensureDirectMatch(matchId) {
    const res = await api.post('/v1/conversations/ensure-direct', { matchId });
    return res.data;
  }

  /**
   * Create a new Group conversation
   */
  async createGroup({ groupName, groupAvatar = '', memberUserIds = [] }) {
    const res = await api.post('/v1/conversations', {
      name: groupName,
      avatarUri: groupAvatar,
      memberUserIds,
    });
    return res.data;
  }

  /**
   * Update Group Metadata
   */
  async updateGroup(conversationId, { groupName, groupAvatar }) {
    const res = await api.patch(`/v1/conversations/${conversationId}`, {
      name: groupName,
      avatarUri: groupAvatar,
    });
    return res.data;
  }

  /**
   * Get Group Members
   */
  async getGroupMembers(conversationId) {
    const res = await api.get(`/v1/conversations/${conversationId}/members`);
    return res.data;
  }

  /**
   * Add Members to Group
   */
  async addGroupMembers(conversationId, memberUserIds = []) {
    const res = await api.post(`/v1/conversations/${conversationId}/members`, {
      memberUserIds,
    });
    return res.data;
  }

  /**
   * Remove Member from Group
   */
  async removeGroupMember(conversationId, targetUserId) {
    const res = await api.delete(`/v1/conversations/${conversationId}/members/${targetUserId}`);
    return res.data;
  }

  /**
   * Update Member Role in Group
   */
  async updateMemberRole(conversationId, targetUserId, role) {
    const res = await api.patch(`/v1/conversations/${conversationId}/members/${targetUserId}/role`, {
      role,
    });
    return res.data;
  }

  /**
   * Leave Group
   */
  async leaveGroup(conversationId) {
    const res = await api.post(`/v1/conversations/${conversationId}/leave`);
    return res.data;
  }

  /**
   * Transfer Group Ownership
   */
  async transferOwnership(conversationId, targetUserId) {
    const res = await api.post(`/v1/conversations/${conversationId}/transfer-ownership`, {
      targetUserId,
    });
    return res.data;
  }

  /**
   * Forward Catch-Up Synchronization of Messages
   */
  async syncMessages(conversationId, { sinceSequence = 0, limit = 50 } = {}) {
    const params = new URLSearchParams({
      sinceSequence: String(sinceSequence),
      limit: String(limit),
    });
    const res = await api.get(`/v1/conversations/${conversationId}/messages/sync?${params.toString()}`);
    return res.data;
  }

  /**
   * Send a message inside a conversation (REST fallback)
   */
  async sendMessage(conversationId, payload = {}) {
    const res = await api.post(`/v1/conversations/${conversationId}/messages`, payload);
    return res.data;
  }

  /**
   * Unsend a message
   */
  async unsendMessage(conversationId, messageId) {
    const res = await api.delete(`/v1/conversations/${conversationId}/messages/${messageId}`);
    return res.data;
  }

  /**
   * Advance Delivered Receipt Watermark
   */
  async markDelivered(conversationId, watermark) {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('receipt.delivered', { conversationId, watermark });
    }
    const res = await api.post(`/v1/conversations/${conversationId}/receipts/delivered`, { watermark });
    return res.data;
  }

  /**
   * Advance Read Receipt Watermark
   */
  async markRead(conversationId, watermark) {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('receipt.read', { conversationId, watermark });
    }
    const res = await api.post(`/v1/conversations/${conversationId}/receipts/read`, { watermark });
    return res.data;
  }

  /**
   * Set Reaction on Message
   */
  async setReaction(conversationId, messageId, emoji) {
    const res = await api.put(`/v1/conversations/${conversationId}/messages/${messageId}/reaction`, { emoji });
    return res.data;
  }

  /**
   * Remove Reaction from Message
   */
  async removeReaction(conversationId, messageId) {
    const res = await api.delete(`/v1/conversations/${conversationId}/messages/${messageId}/reaction`);
    return res.data;
  }

  /**
   * Vote in Poll
   */
  async votePoll(conversationId, pollId, optionId) {
    const res = await api.put(`/v1/conversations/${conversationId}/polls/${pollId}/vote`, { optionId });
    return res.data;
  }

  /**
   * Close Poll
   */
  async closePoll(conversationId, pollId) {
    const res = await api.post(`/v1/conversations/${conversationId}/polls/${pollId}/close`);
    return res.data;
  }
}

export const messagingService = new MessagingService();
export default messagingService;
