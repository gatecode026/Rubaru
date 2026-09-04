const crypto = require('crypto');

const CALL_SECRET = process.env.CALL_SIGNING_SECRET || process.env.JWT_SECRET || 'rubaru_secure_call_signing_key_2026';

/**
 * Creates a minimal, versioned, cryptographically signed incoming-call push payload
 */
function createIncomingCallPayload({
  sessionId,
  caller,
  callType,
  ratePerMinute,
  expiresInSeconds = 60,
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
  const actionNonce = crypto.randomBytes(16).toString('hex');

  const dataToSign = `${sessionId}:${actionNonce}:${expiresAt.toISOString()}`;
  const signature = crypto.createHmac('sha256', CALL_SECRET).update(dataToSign).digest('hex');

  return {
    eventVersion: '1.0',
    eventType: 'INCOMING_CALL',
    sessionId,
    caller: {
      id: caller.id || caller._id?.toString(),
      displayName: caller.displayName || caller.name || caller.email || 'Rubaru User',
      avatarUrl: caller.avatarUrl || caller.profilePhoto || null,
    },
    callType: callType.toUpperCase(),
    ratePerMinute,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    actionNonce,
    signature,
  };
}

/**
 * Verifies the authenticity and expiration of an incoming call payload action
 */
function verifyCallActionToken({ sessionId, actionNonce, expiresAt, signature }) {
  if (!sessionId || !actionNonce || !expiresAt || !signature) {
    return { valid: false, error: 'MISSING_SIGNATURE_FIELDS' };
  }

  const expirationDate = new Date(expiresAt);
  if (isNaN(expirationDate.getTime()) || new Date() > expirationDate) {
    return { valid: false, error: 'ACTION_EXPIRED' };
  }

  const expectedData = `${sessionId}:${actionNonce}:${expirationDate.toISOString()}`;
  const expectedSignature = crypto.createHmac('sha256', CALL_SECRET).update(expectedData).digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  return { valid: true, sessionId, actionNonce, expiresAt };
}

module.exports = {
  createIncomingCallPayload,
  verifyCallActionToken,
};
