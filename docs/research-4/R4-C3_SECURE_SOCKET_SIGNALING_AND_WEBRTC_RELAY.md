# ROOBARU CALLING — R4-C3: SECURE SOCKET.IO SIGNALING & WEBRTC RELAY
**Status:** IMPLEMENTED & VALIDATED  
**Phase:** R4-C3  
**Date:** September 2026  

---

## 1. Executive Summary

Phase R4-C3 implements the production-ready, secure Socket.IO signaling layer and WebRTC relay for 1-on-1 Roobaru audio and video calls. It connects client real-time events to the authoritative `callService` (implemented in R4-C2), applies distributed Redis rate limits, validates SDP/ICE structures, enforces strict participant isolation, and supports multi-device synchronization and multi-instance scaling via the Socket.IO Redis adapter.

> [!IMPORTANT]
> Socket.IO carries **signaling and state events only**. Audio and video media streams are transmitted directly peer-to-peer via WebRTC and never routed through Socket.IO.

---

## 2. Canonical Event Registry

Centralized in [`backend/socket/socketEvents.js`](file:///r:/Rubaru/backend/socket/socketEvents.js):

### Client → Server Events
| Event Name | Purpose | Acknowledgement Data |
|---|---|---|
| `call:initiate` | Caller initiates an audio or video call | Authoritative session DTO |
| `call:accept` | Receiver accepts the incoming call | Authoritative session DTO |
| `call:reject` | Receiver declines the incoming call | Authoritative session DTO |
| `call:cancel` | Caller cancels before active connection | Authoritative session DTO |
| `call:signal:offer` | Relays WebRTC SDP Offer to peer | `{ callId, relayed: true }` |
| `call:signal:answer` | Relays WebRTC SDP Answer to peer | `{ callId, relayed: true }` |
| `call:signal:ice` | Relays WebRTC ICE Candidate to peer | `{ callId, relayed: true }` |
| `call:media-ready` | Confirms peer connection media readiness | Authoritative session DTO |
| `call:reconnecting` | Signals temporary transport disconnect | Authoritative session DTO |
| `call:reconnected` | Signals successful reconnection | Authoritative session DTO |
| `call:end` | Explicitly hangs up an active call | Sanitized summary DTO |
| `call:sync` | Retrieves current active call state | `{ hasActiveCall, call }` |

### Server → Client Events
| Event Name | Target Room | Content |
|---|---|---|
| `call:incoming` | `user:${recipientId}` | Sanitized caller info, callType, rate, expiration |
| `call:ringing` | `user:${callerId}` | Call ID, status `RINGING` |
| `call:accepted` | `user:${callerId}` | Call ID, receiverId, acceptedAt |
| `call:rejected` | Both user rooms | Call ID, endReason |
| `call:cancelled` | Both user rooms | Call ID, endReason |
| `call:busy` | `user:${callerId}` | Call ID, error code `USER_BUSY` |
| `call:signal:offer` | `user:${peerId}` | Sender ID, SDP offer payload |
| `call:signal:answer` | `user:${peerId}` | Sender ID, SDP answer payload |
| `call:signal:ice` | `user:${peerId}` | Sender ID, ICE candidate object |
| `call:connecting` | Both user rooms | Call ID, status `CONNECTING` |
| `call:connected` | Both user rooms | Call ID, status `ACTIVE`, server `connectedAt` |
| `call:reconnecting` | `user:${peerId}` | Call ID, reconnectionDeadline (20s grace) |
| `call:reconnected` | Both user rooms | Call ID, status `ACTIVE` |
| `call:ended` | Both user rooms | Call ID, duration, billedMinutes, coinsCharged |
| `call:sync` | `user:${userId}` | Active call state or dismissal indicator |
| `call:error` | `user:${userId}` | Sanitized error code & retryable status |

---

## 3. Acknowledgement Contract & Error Mapping

Every client-to-server event strictly returns the standardized `CallAck<T>` response shape:

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

- **Zero Unhandled Exceptions:** All errors are caught and returned in structured acks.
- **Privacy Preservation:** MongoDB internals, duplicate key errors (`E11000`), and Redis keys are mapped to `SERVICE_UNAVAILABLE` or deterministic domain error codes.

---

## 4. Authentication & Security Controls

1. **Strict Identity Derivation:** Sockets derive identity exclusively from `socket.data.userId` (authenticated via handshake JWT middleware). Any client-supplied `callerId`, `senderId`, `userId`, `initiatorId`, or `endedBy` in payloads is ignored.
2. **Authoritative Peer Routing:** When relaying SDP offers, answers, or ICE candidates, the server resolves `session.callerId` and `session.receiverId` from the database. Client-supplied `recipientId` is completely ignored to prevent signal interception or reflection attacks.
3. **Payload Sanitization & Protection:**
   - Object validation rejects prototype pollution keys (`__proto__`, `constructor`, `prototype`).
   - String length limits: `callId` (128), `requestId` (128), `idempotencyKey` (128).
   - SDP Validation: Maximum 64 KB, syntax check (`v=0`, `m=`) via `turnService.validateSdp()`. Full SDP is never logged.
   - ICE Candidate Validation: Maximum 2 KB, candidate string and structure validation via `turnService.validateIceCandidate()`.

---

## 5. Distributed Redis Rate Limiting

Implemented in [`backend/services/callRateLimiter.js`](file:///r:/Rubaru/backend/services/callRateLimiter.js) using atomic Redis `INCR` and `EXPIRE` counters:

| Action | Limit | Window | Key Pattern |
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

- **Incoming Ringing:** Emitted to `user:${recipientId}`, delivering `call:incoming` simultaneously across all active sockets and devices for that user.
- **First-Device Acceptance:** The first receiver device to emit `call:accept` wins acceptance, and its socket ID is bound via `callLockService.bindCallDevice(callId, userId, socket.id)`.
- **Dismissal Sync:** Losing receiver devices receive a `call:sync` event with `{ handledByOtherDevice: true }`, automatically dismissing the incoming call screen without triggering billing or rejection errors.

---

## 7. Dual Media Readiness Confirmation & Billing Activation

1. Client reports readiness via `call:media-ready`.
2. `callService.markMediaConnected()` records `initiatorConnectedAt` and `receiverConnectedAt`.
3. The call transitions to `ACTIVE` **only when both parties have confirmed peer connection**.
4. The server emits `call:connected` with `connectedAt` and triggers Minute 1 billing deduction.
5. Single-party confirmations keep the session in `CONNECTING` with zero coin charges.

---

## 8. Server-Originated Terminal Events

Background workers (e.g. `paidBillingWorker` and `recoverStaleCalls()`) transition calls when deadlines expire without live socket events:
- **45s Ring Timeout:** Transitions to `MISSED`, broadcasts `call:ended` with `reason: RING_TIMEOUT`.
- **20s Reconnect Grace Expiration:** Transitions to `FAILED`, broadcasts `call:ended` with `failureCode: RECONNECT_TIMEOUT`, `reason: NETWORK_FAILURE`.
- **Insufficient Next-Minute Balance:** Transitions to `ENDED`, broadcasts `call:ended` with `reason: INSUFFICIENT_FUNDS`.

---

## 9. Legacy Event Compatibility

Legacy event handlers remain supported while routing securely through `callService`:
- `call_user` → routes to `callService.initiateCall` (validates match, balance, blocks).
- `call_accepted` → routes to `callService.acceptCall`.
- `call_rejected` → routes to `callService.rejectCall`.
- `call_ended` → routes to `callService.endCall`.
- `call.offer`, `call.answer`, `call.ice_candidate` → validates SDP/ICE and routes to authoritative peer from DB session.
- `send_webrtc_signal` → resolves peer from authoritative call session.

*Deprecation Plan:* Legacy calling event names will be retired in Phase R4-C6 once mobile clients migrate to the canonical `call:*` namespace.

---

## 10. Files Created & Modified

### Files Created
1. `backend/services/callRateLimiter.js`: Multi-instance Redis-backed distributed rate limiter.
2. `backend/socket/callSocketUtils.js`: Acknowledgement formatters, input sanitizers, and schema validators.
3. `backend/test/c3_secure_signaling_webrtc_relay_tests.js`: Comprehensive 16-test integration suite for Socket.IO signaling.
4. `docs/research-4/R4-C3_SECURE_SOCKET_SIGNALING_AND_WEBRTC_RELAY.md`: Architectural specification and implementation documentation.

### Files Modified
1. `backend/socket/socketEvents.js`: Added all canonical client-to-server and server-to-client calling events.
2. `backend/socket/callingSocketHandler.js`: Complete rewrite with authoritative event handlers, input validation, multi-device sync, and legacy compatibility.
3. `backend/services/callLockService.js`: Added device binding and active call lookup helpers (`bindCallDevice`, `getCallDevice`, `getUserActiveCallId`).
4. `backend/services/callService.js`: Enhanced `markMissed`, `markBusy`, and `failCall` to broadcast canonical server-originated events via `getSocketIO()`.

---

## 11. Test Results Summary

All test suites executed against live MongoDB and Redis instances with **0 failures**:

| Test Suite | File | Tests Passed | Tests Failed |
|---|---|:---:|:---:|
| **R4-C3 Secure Socket Signaling & Relay** | `c3_secure_signaling_webrtc_relay_tests.js` | **16** | **0** |
| **R4-C2 Call Session & Locking** | `c2_call_session_and_redis_locking_tests.js` | **13** | **0** |
| **Paid Communication Core & Billing** | `paid_communication_tests.js` | **30** | **0** |
| **PC-09 Native Background Calling & Push** | `pc09_native_background_calling_tests.js` | **30** | **0** |
| **Total** | | **89** | **0** |

---

## 12. Recommended Next Phase: R4-C4 (React Native WebRTC Client Integration)
With the backend state machine (R4-C2) and secure signaling relay (R4-C3) fully verified:
1. Integrate `react-native-webrtc` into the mobile client app.
2. Build peer connection management, SDP offer/answer exchange, and ICE candidate gathering.
3. Wire media streams to UI components (`RTCView`, microphone, camera toggle, speakerphone routing).

---
**Verdict:** `READY_FOR_R4_C4`
