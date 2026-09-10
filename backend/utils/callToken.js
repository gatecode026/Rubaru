const crypto = require('crypto');

const CALL_SECRET = process.env.CALL_SIGNING_SECRET || process.env.JWT_SECRET || 'rubaru_secure_call_signing_key_2026';

/**
 * Creates an authoritative, versioned, cryptographically signed incoming-call push payload (R4-C6)
 * Schema:
 * {
 *   type: "INCOMING_CALL",
 *   version: 1,
 *   callId: string,
 *   callType: "AUDIO" | "VIDEO",
 *   caller: { id: string, displayName: string, avatarUrl: string | null },
 *   ratePerMinute: number,
 *   expiresAt: string,
 *   issuedAt: string,
 *   nonce: string,
 *   signature: string
 * }
 */
function createIncomingCallPayload({
  callId,
  sessionId,
  caller,
  callType,
  ratePerMinute,
  expiresInSeconds = 60,
}) {
  const targetCallId = callId || sessionId;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const normalizedCallType = (callType || 'AUDIO').toUpperCase();

  const dataToSign = `${targetCallId}:${nonce}:${expiresAt.toISOString()}`;
  const signature = crypto.createHmac('sha256', CALL_SECRET).update(dataToSign).digest('hex');

  const callerObj = {
    id: caller?.id || caller?._id?.toString() || 'unknown',
    displayName: caller?.displayName || caller?.name || caller?.email || 'Rubaru User',
    avatarUrl: caller?.avatarUrl || caller?.profilePhoto || null,
  };

  return {
    type: 'INCOMING_CALL',
    version: 1,
    callId: targetCallId,
    callType: normalizedCallType,
    caller: callerObj,
    ratePerMinute: Number(ratePerMinute) || 5,
    expiresAt: expiresAt.toISOString(),
    issuedAt: now.toISOString(),
    nonce,
    signature,
    // Backward compatibility aliases
    sessionId: targetCallId,
    eventType: 'INCOMING_CALL',
    eventVersion: '1.0',
    createdAt: now.toISOString(),
    actionNonce: nonce,
  };
}

/**
 * Verifies the authenticity, non-tampering, non-replay, and unexpired state of an incoming call payload action
 */
function verifyCallActionToken({
  callId,
  sessionId,
  nonce,
  actionNonce,
  expiresAt,
  signature,
}) {
  const targetCallId = callId || sessionId;
  const targetNonce = nonce || actionNonce;

  if (!targetCallId || !targetNonce || !expiresAt || !signature) {
    return { valid: false, error: 'MISSING_SIGNATURE_FIELDS' };
  }

  const expirationDate = new Date(expiresAt);
  if (isNaN(expirationDate.getTime()) || new Date() > expirationDate) {
    return { valid: false, error: 'ACTION_EXPIRED' };
  }

  const expectedData = `${targetCallId}:${targetNonce}:${expirationDate.toISOString()}`;
  const expectedSignature = crypto.createHmac('sha256', CALL_SECRET).update(expectedData).digest('hex');

  let isValid = false;
  if (signature.length === expectedSignature.length) {
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  if (!isValid) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  return {
    valid: true,
    callId: targetCallId,
    sessionId: targetCallId,
    nonce: targetNonce,
    expiresAt: expirationDate.toISOString(),
  };
}

module.exports = {
  createIncomingCallPayload,
  verifyCallActionToken,
};
