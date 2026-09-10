const turnService = require('../services/turnService');
const { CallEndReasons, CallDomainErrors } = require('../models/enums');

/**
 * Utility functions and schema validators for Call Socket.io events
 */

/**
 * Standard Success Acknowledgement Response
 */
function formatAckSuccess(requestId, data = {}) {
  return {
    ok: true,
    requestId: requestId || `req_${Date.now()}`,
    data,
  };
}

/**
 * Standard Error Acknowledgement Response
 */
function formatAckError(requestId, err, retryable = false) {
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let isRetryable = retryable;

  if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    code = err.code || (err.name === 'CallDomainError' ? err.code : 'CALL_ERROR');
    message = err.message || 'Call operation failed';
    if (err.statusCode === 503 || err.code === 'REDIS_UNAVAILABLE' || err.code === 'NETWORK_ERROR') {
      isRetryable = true;
    }
  }

  // Prevent leaking internal DB / Redis details
  if (message.includes('Mongo') || message.includes('E11000') || message.includes('Redis')) {
    code = 'SERVICE_UNAVAILABLE';
    message = 'Service temporarily unavailable. Please retry.';
    isRetryable = true;
  }

  return {
    ok: false,
    requestId: requestId || `req_${Date.now()}`,
    error: {
      code,
      message,
      retryable: isRetryable,
    },
  };
}

/**
 * Validate object against prototype pollution
 */
function isCleanObject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return false;
  if (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
    Object.prototype.hasOwnProperty.call(obj, 'prototype')
  ) {
    return false;
  }
  return true;
}

/**
 * Sanitize bounded string
 */
function sanitizeString(str, maxLen = 128) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

/**
 * Validate call:initiate payload
 */
function validateInitiatePayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const recipientId = sanitizeString(payload.recipientId, 128);
  if (!recipientId) {
    return { valid: false, error: 'recipientId is required and must not exceed 128 characters' };
  }
  const callType = sanitizeString(payload.callType, 16);
  if (!callType || !['AUDIO', 'VIDEO'].includes(callType.toUpperCase())) {
    return { valid: false, error: 'callType must be AUDIO or VIDEO' };
  }
  const idempotencyKey = sanitizeString(payload.idempotencyKey, 128);
  if (!idempotencyKey) {
    return { valid: false, error: 'idempotencyKey is required' };
  }
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: {
      recipientId,
      callType: callType.toUpperCase(),
      idempotencyKey,
      requestId,
    },
  };
}

/**
 * Validate call:accept payload
 */
function validateAcceptPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.callSessionId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: { callId, requestId },
  };
}

/**
 * Validate call:reject payload
 */
function validateRejectPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.callSessionId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const reason = sanitizeString(payload.reason, 64) || CallEndReasons.RECEIVER_REJECTED;
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: { callId, reason, requestId },
  };
}

/**
 * Validate call:cancel payload
 */
function validateCancelPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.callSessionId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const reason = sanitizeString(payload.reason, 64) || CallEndReasons.CALLER_CANCELLED;
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: { callId, reason, requestId },
  };
}

/**
 * Validate call:signal:offer payload
 */
function validateOfferPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const rawSdp = typeof payload.sdp === 'object' && payload.sdp ? payload.sdp.sdp : payload.sdp;
  if (!rawSdp || typeof rawSdp !== 'string') {
    return { valid: false, error: 'sdp string is required' };
  }
  const sdpValidation = turnService.validateSdp(rawSdp);
  if (!sdpValidation.valid) {
    return { valid: false, error: sdpValidation.error };
  }
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: {
      callId,
      sdp: typeof payload.sdp === 'object' ? payload.sdp : { type: 'offer', sdp: rawSdp },
      requestId,
    },
  };
}

/**
 * Validate call:signal:answer payload
 */
function validateAnswerPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const rawSdp = typeof payload.sdp === 'object' && payload.sdp ? payload.sdp.sdp : payload.sdp;
  if (!rawSdp || typeof rawSdp !== 'string') {
    return { valid: false, error: 'sdp string is required' };
  }
  const sdpValidation = turnService.validateSdp(rawSdp);
  if (!sdpValidation.valid) {
    return { valid: false, error: sdpValidation.error };
  }
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: {
      callId,
      sdp: typeof payload.sdp === 'object' ? payload.sdp : { type: 'answer', sdp: rawSdp },
      requestId,
    },
  };
}

/**
 * Validate call:signal:ice payload
 */
function validateIcePayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const candidateObj = payload.candidate;
  const iceValidation = turnService.validateIceCandidate(candidateObj);
  if (!iceValidation.valid) {
    return { valid: false, error: iceValidation.error };
  }
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: {
      callId,
      candidate: {
        candidate: candidateObj.candidate,
        sdpMid: sanitizeString(candidateObj.sdpMid, 256) || null,
        sdpMLineIndex: typeof candidateObj.sdpMLineIndex === 'number' ? candidateObj.sdpMLineIndex : null,
      },
      requestId,
    },
  };
}

/**
 * Validate call:media-ready payload
 */
function validateMediaReadyPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: { callId, requestId },
  };
}

/**
 * Validate call:end payload
 */
function validateEndPayload(payload) {
  if (!isCleanObject(payload)) {
    return { valid: false, error: 'Payload must be a valid JSON object' };
  }
  const callId = sanitizeString(payload.callId || payload.sessionId, 128);
  if (!callId) {
    return { valid: false, error: 'callId is required' };
  }
  const reason = sanitizeString(payload.reason, 64) || CallEndReasons.COMPLETED;
  const requestId = sanitizeString(payload.requestId, 128) || `req_${Date.now()}`;

  return {
    valid: true,
    data: { callId, reason, requestId },
  };
}

module.exports = {
  formatAckSuccess,
  formatAckError,
  isCleanObject,
  sanitizeString,
  validateInitiatePayload,
  validateAcceptPayload,
  validateRejectPayload,
  validateCancelPayload,
  validateOfferPayload,
  validateAnswerPayload,
  validateIcePayload,
  validateMediaReadyPayload,
  validateEndPayload,
};
