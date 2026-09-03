/**
 * Centralized Socket.io Messaging and Real-Time Event Registry
 */
const SocketEvents = Object.freeze({
  // Client-to-Server Messaging Commands
  CONVERSATION_SUBSCRIBE: 'conversation.subscribe',
  CONVERSATION_UNSUBSCRIBE: 'conversation.unsubscribe',
  MESSAGE_SEND: 'message.send',
  RECEIPT_DELIVERED: 'receipt.delivered',
  RECEIPT_READ: 'receipt.read',
  CONVERSATION_SYNC: 'conversation.sync',
  PRESENCE_HEARTBEAT: 'presence.heartbeat',
  PRESENCE_SNAPSHOT: 'presence.snapshot',
  TYPING_START: 'typing.start',
  TYPING_STOP: 'typing.stop',
  MESSAGE_REACTION_SET: 'message.reaction.set',
  MESSAGE_REACTION_REMOVE: 'message.reaction.remove',
  POLL_VOTE_SET: 'poll.vote.set',
  POLL_VOTE_REMOVE: 'poll.vote.remove',
  POLL_CLOSE: 'poll.close',

  // Server-to-Client Messaging Events
  CONVERSATION_SUBSCRIBED: 'conversation.subscribed',
  MESSAGE_CREATED: 'message.created',
  RECEIPT_WATERMARK_UPDATED: 'conversation.receipt_watermark.updated',
  CONVERSATION_REVOKED: 'conversation.revoked',
  MESSAGING_ERROR: 'messaging.error',
  PRESENCE_UPDATED: 'presence.updated',
  TYPING_UPDATED: 'typing.updated',
  MESSAGE_REACTION_UPDATED: 'message.reaction.updated',
  POLL_VOTE_UPDATED: 'poll.vote.updated',
  POLL_CLOSED: 'poll.closed',

  // Legacy Compatibility Event Names
  LEGACY_JOIN_CHAT: 'join_chat',
  LEGACY_LEAVE_CHAT: 'leave_chat',
  LEGACY_SEND_MESSAGE: 'send_message',
  LEGACY_RECEIVE_MESSAGE: 'receive_message',
  LEGACY_ERROR_MESSAGE: 'error_message',
  LEGACY_MESSAGE_DELIVERED: 'message_delivered',
  LEGACY_MESSAGE_READ: 'message_read',
  LEGACY_TYPING_START: 'typing_start',
  LEGACY_TYPING_STOP: 'typing_stop',
  LEGACY_USER_TYPING: 'user_typing',
  LEGACY_PRESENCE_UPDATED: 'presence_updated',

  // Calling & WebRTC Signaling Events
  CALL_USER: 'call_user',
  INCOMING_CALL: 'incoming_call',
  CALL_ACCEPTED: 'call_accepted',
  CALL_CONNECTED: 'call_connected',
  CALL_REJECTED: 'call_rejected',
  CALL_DECLINED: 'call_declined',
  CALL_ENDED: 'call_ended',
  CALL_HUNGUP: 'call_hungup',
  CALL_FAILED: 'call_failed',
  SEND_WEBRTC_SIGNAL: 'send_webrtc_signal',
  RECEIVE_WEBRTC_SIGNAL: 'receive_webrtc_signal',
});

module.exports = SocketEvents;
