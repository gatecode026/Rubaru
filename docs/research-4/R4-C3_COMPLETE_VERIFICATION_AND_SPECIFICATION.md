# ROOBARU CALLING — R4-C3 & R4-C3V: COMPLETE SPECIFICATION & FINAL VERIFICATION REPORT
**Status:** VALIDATED & PRODUCTION-READY  
**Phase:** R4-C3 / R4-C3V (Secure Socket.IO Signaling, WebRTC Relay & Multi-Instance Verification)  
**Date:** September 2026  
**Final Verdict:** `READY_FOR_R4_C4`

---

## 1. Executive Summary & Audit Findings

Phase R4-C3 & R4-C3V builds the complete, production-ready Socket.IO signaling layer and WebRTC relay for 1-on-1 Roobaru audio and video calls. It connects client real-time events to the authoritative `callService` (implemented in R4-C2), applies distributed Redis rate limits, validates SDP/ICE structures, enforces strict selected-device media isolation, and supports multi-device synchronization and multi-instance scaling via the Socket.IO Redis adapter.

### Missing Safeguards Remediated in R4-C3V:
1. **Selected-Device Media Socket Binding:** Bound the winning socket on acceptance (`call:device:${callId}:${userId}`) so that unselected secondary devices belonging to the same user cannot send parallel SDP offers, answers, or ICE candidates.
2. **Atomic Device Rebinding on Reconnection:** Added authenticated atomic rebinding on `call:reconnected` allowing a reconnecting participant on a new socket to resume signaling without restarting billing.
3. **Fail-Closed Redis Behavior:** Configured rate limiting and lock services to fail closed with retryable errors (`REDIS_UNAVAILABLE` / `SERVICE_UNAVAILABLE`) in production or strict mode.
4. **Disabled Unsafe Generic Relays:** Deprecated and disabled `send_webrtc_signal` to prevent unvalidated relay bypasses.
5. **Observability & Metrics:** Integrated low-cardinality counters in `callMetrics.js` for initiation, validation errors, rate limits, active calls, and terminal reasons.
6. **Multi-Instance Verification:** Proved cross-node signaling, multi-device acceptance races, and billing idempotency across distinct Socket.IO instances using `@socket.io/redis-adapter`.

> [!IMPORTANT]
> Socket.IO carries **signaling events only** (SDP offers, SDP answers, ICE candidates, call state events). Real-time media (audio and video streams) is transmitted peer-to-peer via WebRTC and is never routed through Socket.IO.

---

## 2. Canonical Socket Event Registry

Centralized in [`backend/socket/socketEvents.js`](file:///r:/Rubaru/backend/socket/socketEvents.js):

### 2.1 Client → Server Events
| Event Name | Purpose | Acknowledgement Response |
|---|---|---|
| `call:initiate` | Caller initiates an audio or video call | Authoritative Session DTO |
| `call:accept` | Receiver accepts the incoming call | Authoritative Session DTO |
| `call:reject` | Receiver declines the incoming call | Authoritative Session DTO |
| `call:cancel` | Caller cancels before connection becomes active | Authoritative Session DTO |
| `call:signal:offer` | Relays WebRTC SDP Offer to peer | `{ callId, relayed: true }` |
| `call:signal:answer` | Relays WebRTC SDP Answer to peer | `{ callId, relayed: true }` |
| `call:signal:ice` | Relays WebRTC ICE Candidate to peer | `{ callId, relayed: true }` |
| `call:media-ready` | Confirms peer media transport readiness | Authoritative Session DTO |
| `call:reconnecting` | Signals temporary transport disconnect | Authoritative Session DTO |
| `call:reconnected` | Signals successful restoration to active | Authoritative Session DTO |
| `call:end` | Explicitly hangs up a call | Sanitized Session Summary DTO |
| `call:sync` | Queries current active call state on reconnect | `{ hasActiveCall, call }` |

### 2.2 Server → Client Events
| Event Name | Target Room | Payload Summary |
|---|---|---|
| `call:incoming` | `user:${recipientId}` | `{ callId, caller: { id, displayName, avatarUrl }, callType, ratePerMinute, expiresAt }` |
| `call:ringing` | `user:${callerId}` | `{ callId, status: 'RINGING', recipientId }` |
| `call:accepted` | `user:${callerId}` | `{ callId, receiverId, acceptedAt }` |
| `call:rejected` | Both user rooms | `{ callId, reason }` |
| `call:cancelled` | Both user rooms | `{ callId, reason }` |
| `call:busy` | `user:${callerId}` | `{ recipientId, code: 'USER_BUSY' }` |
| `call:signal:offer` | `user:${peerId}` | `{ callId, senderId, sdp }` |
| `call:signal:answer` | `user:${peerId}` | `{ callId, senderId, sdp }` |
| `call:signal:ice` | `user:${peerId}` | `{ callId, senderId, candidate }` |
| `call:connecting` | Both user rooms | `{ callId, status: 'CONNECTING' }` |
| `call:connected` | Both user rooms | `{ callId, status: 'ACTIVE', connectedAt }` |
| `call:reconnecting` | `user:${peerId}` | `{ callId, status: 'RECONNECTING', reconnectionDeadline }` |
| `call:reconnected` | Both user rooms | `{ callId, status: 'ACTIVE' }` |
| `call:ended` | Both user rooms | `{ callId, status, endReason, durationSeconds, billedMinutes, coinsCharged, endedAt }` |
| `call:sync` | `user:${userId}` | `{ hasActiveCall, call }` |
| `call:error` | `user:${userId}` | `{ code, message, retryable }` |

---

## 3. Acknowledgement Contract & Error Protocol

All client-to-server invocations return standardized Socket.IO acknowledgements (`CallAck<T>`):

```typescript
type CallAck<T = unknown> =
  | {
      ok: true;
      requestId: string;
      data: T;
    }
  | {
      ok: false;
      requestId: string;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };
```

---

## 4. Authentication, Authorization & Security Architecture

1. **Strict Identity Derivation:** Sockets derive caller and actor identities exclusively from `socket.data.userId` verified during handshake JWT authentication. Any client-supplied `callerId`, `senderId`, `userId`, `initiatorId`, or `endedBy` in event payloads is completely ignored.
2. **Authoritative Peer Routing:** When relaying SDP offers, answers, or ICE candidates, the server resolves `session.callerId` and `session.receiverId` directly from the database session. Client-supplied `recipientId` is ignored to eliminate signal redirection attacks.
3. **Selected-Device Media Socket Enforcement:**
   - On initiation and acceptance, the winning socket is bound in Redis (`call:device:${callId}:${userId}`).
   - Signaling events (`offer`, `answer`, `ice`, `media-ready`) verify that `socket.id` matches the bound media device. Unselected secondary devices receive `DEVICE_NOT_SELECTED`.
4. **Payload Sanitization & Protection:**
   - Object validation strips/rejects prototype pollution keys (`__proto__`, `constructor`, `prototype`).
   - String length limits: `callId` (128 chars), `requestId` (128 chars), `idempotencyKey` (128 chars).
   - SDP Validation: Maximum 64 KB, syntax validation (`v=0`, `m=`) via `turnService.validateSdp()`. Complete SDP is never logged.
   - ICE Candidate Validation: Maximum 2 KB, structure validation (`candidate`, `sdpMid`, `sdpMLineIndex`).

---

## 5. Distributed Redis Rate Limiting

Implemented in [`backend/services/callRateLimiter.js`](file:///r:/Rubaru/backend/services/callRateLimiter.js) using atomic Redis `INCR` and `EXPIRE` counters:

| Action | Limit | Window | Redis Key Pattern |
|---|---|---|---|
| Call Initiation | 5 requests | 60s | `call:rl:init:{callerId}` |
| Targeted Initiation | 3 requests | 60s | `call:rl:target:{callerId}:{receiverId}` |
| SDP Offer Relay | 10 requests | 60s | `call:rl:offer:{callId}:{participantId}` |
| SDP Answer Relay | 10 requests | 60s | `call:rl:answer:{callId}:{participantId}` |
| ICE Candidates | 120 requests | 60s | `call:rl:ice:{callId}:{participantId}` |
| Invalid Event Attempts | 20 requests | 60s | `call:rl:invalid:{userId}` |
| Call State Mutations | 30 requests | 60s | `call:rl:mutation:{callId}` |

---

## 6. Multi-Device Synchronization & Single Winner

- **Simultaneous Ringing:** Incoming call notifications (`call:incoming`) broadcast to `user:${recipientId}`, reaching all online devices and sockets for that user.
- **First-Device Acceptance:** The first receiver device to emit `call:accept` wins acceptance and binds its socket in Redis (`call:device:${callId}:${userId}`).
- **Dismissal Sync:** Other receiver devices receive a `call:sync` event with `{ handledByOtherDevice: true }`, cleanly dismissing the incoming call UI without triggering billing or cancellation errors.

---

## 7. Dual Media Readiness & Billing Activation

1. Client reports peer readiness via `call:media-ready`.
2. `callService.markMediaConnected()` records `initiatorConnectedAt` and `receiverConnectedAt`.
3. The session transitions to `ACTIVE` **only when both parties have confirmed peer connection**.
4. The server emits `call:connected` with `connectedAt = new Date()` and deducts Minute 1 billing.
5. Single-party confirmations keep the session in `CONNECTING` with zero coin charges.
6. Non-connected calls (cancelled, rejected, missed, failed before active) cost exactly 0 coins.
7. Duplicate `call:media-ready` events from either participant are completely idempotent and do not double charge.

---

## 8. Server-Originated Terminal Transitions

Background workers (`paidBillingWorker` and `callService.recoverStaleCalls()`) transition calls when deadlines expire without live socket events:
- **45s Ring Timeout:** Transitions to `MISSED`, broadcasts `call:ended` with `reason: RING_TIMEOUT`.
- **20s Reconnect Grace Expiration:** Transitions to `FAILED`, broadcasts `call:ended` with `failureCode: RECONNECT_TIMEOUT`, `reason: NETWORK_FAILURE`.
- **Insufficient Next-Minute Balance:** Transitions to `ENDED`, broadcasts `call:ended` with `reason: INSUFFICIENT_FUNDS`.

---

## 9. Legacy Event Compatibility & Security Table

| Legacy Event | Status | Authoritative Routing Action |
|---|---|---|
| `call_user` | Supported (Deprecated) | Routes through `callService.initiateCall`, validates match & balance |
| `call_accepted` | Supported (Deprecated) | Routes through `callService.acceptCall`, binds device |
| `call_rejected` | Supported (Deprecated) | Routes through `callService.rejectCall`, clears device binding |
| `call_ended` | Supported (Deprecated) | Routes through `callService.endCall`, clears device binding |
| `call.offer` | Supported (Deprecated) | Validates SDP, routes to authoritative peer from DB session |
| `call.answer` | Supported (Deprecated) | Validates SDP, routes to authoritative peer from DB session |
| `call.ice_candidate` | Supported (Deprecated) | Validates candidate, routes to authoritative peer from DB session |
| `send_webrtc_signal` | **Disabled (Rejected)** | Returns `DEPRECATED_UNSAFE_RELAY` to prevent security bypass |
| `incoming_call` | Server-Only | Emitted to client; rejected if sent by client |
| `call_connected` | Server-Only | Emitted to client; rejected if sent by client |
| `call_declined` | Server-Only | Emitted to client; rejected if sent by client |
| `call_hungup` | Server-Only | Emitted to client; rejected if sent by client |

---

## 10. Automated Test Execution & Verification Evidence

All 5 calling, locking, and billing test suites were executed against live MongoDB and Redis instances with **96 Passed, 0 Failed (100% Success Rate)**:

| Test Suite | Command | Coverage | Result |
|---|---|---|:---:|
| **R4-C3V Multi-Instance & Final Verification** | `node test/c3v_final_verification_tests.js` | Cross-node signaling, device binding, atomic rebinding, billing idempotency, legacy security | **7 / 7 PASSED** |
| **R4-C3 Secure Socket Signaling & Relay** | `node test/c3_secure_signaling_webrtc_relay_tests.js` | Ack contracts, identity spoofing, SDP/ICE validation, dual media-ready, multi-device, rate limiting, legacy routing | **16 / 16 PASSED** |
| **R4-C2 Call Session & Locking** | `node test/c2_call_session_and_redis_locking_tests.js` | 12-state transitions, dual-user Redis locking, eligibility, 0-cost boundary, reconnection | **13 / 13 PASSED** |
| **Paid Communication Core & Billing** | `node test/paid_communication_tests.js` | Wallet balances, ledger invariance, minute deductions, worker sweeps, heartbeat expiration | **30 / 30 PASSED** |
| **PC-09 Native Background Calling & Push** | `node test/pc09_native_background_calling_tests.js` | APNs/FCM device tokens, cryptographic payloads, multi-device push, background actions | **30 / 30 PASSED** |
| **Total Verified** | | | **96 / 96 PASSED** |

---

## 11. Complete Files Summary

| File | Status | Purpose |
|---|---|---|
| [`backend/socket/socketEvents.js`](file:///r:/Rubaru/backend/socket/socketEvents.js) | Modified | Centralized canonical calling and signaling event registry |
| [`backend/socket/callingSocketHandler.js`](file:///r:/Rubaru/backend/socket/callingSocketHandler.js) | Modified | Authoritative Socket.IO signaling router with selected-device checks |
| [`backend/socket/callSocketUtils.js`](file:///r:/Rubaru/backend/socket/callSocketUtils.js) | Created | `CallAck` formatting, payload schema & security validators |
| [`backend/services/callRateLimiter.js`](file:///r:/Rubaru/backend/services/callRateLimiter.js) | Created | Multi-instance Redis distributed rate limiting with fail-closed mode |
| [`backend/services/callLockService.js`](file:///r:/Rubaru/backend/services/callLockService.js) | Modified | Added device socket binding, lookup, and atomic rebinding |
| [`backend/services/callMetrics.js`](file:///r:/Rubaru/backend/services/callMetrics.js) | Created | Low-cardinality calling and signaling observability counters |
| [`backend/services/callService.js`](file:///r:/Rubaru/backend/services/callService.js) | Modified | Added server-originated socket broadcasts on timeouts |
| [`backend/test/c3v_final_verification_tests.js`](file:///r:/Rubaru/backend/test/c3v_final_verification_tests.js) | Created | 7-test multi-instance, device binding, and rebinding integration suite |
| [`backend/test/c3_secure_signaling_webrtc_relay_tests.js`](file:///r:/Rubaru/backend/test/c3_secure_signaling_webrtc_relay_tests.js) | Created | 16-test comprehensive Socket.IO signaling integration suite |
| [`docs/research-4/R4-C3_SECURE_SOCKET_SIGNALING_AND_WEBRTC_RELAY.md`](file:///r:/Rubaru/docs/research-4/R4-C3_SECURE_SOCKET_SIGNALING_AND_WEBRTC_RELAY.md) | Updated | Complete architectural documentation |
| [`docs/research-4/R4-C3_COMPLETE_VERIFICATION_AND_SPECIFICATION.md`](file:///r:/Rubaru/docs/research-4/R4-C3_COMPLETE_VERIFICATION_AND_SPECIFICATION.md) | Updated | All-in-one comprehensive specification & verification report |

---

## 12. Final Verdict

```
READY_FOR_R4_C4
```
