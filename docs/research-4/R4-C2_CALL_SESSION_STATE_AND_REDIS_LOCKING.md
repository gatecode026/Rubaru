# ROOBARU CALLING — R4-C2: AUTHORITATIVE CALL SESSION, STATE MACHINE & REDIS LOCKING
**Status:** IMPLEMENTED & VALIDATED  
**Phase:** R4-C2  
**Date:** September 2026  

---

## 1. Executive Summary & Authoritative Model Decision

In Phase R4-C2, we built the server-authoritative backend foundation for 1-on-1 audio and video calling in Roobaru. 

### Final Model Decision: Single Unified Session Model
Rather than introducing a fragmented parallel database model that would split call states between legacy paid communication and native calling, **`PaidCommunicationSession` was extended and hardened to serve as the unified authoritative call session model**.
- **Model Aliases:** `CallSession` is provided as a direct schema alias pointing to `PaidCommunicationSession`.
- **Zero Schema Fragmentation:** Fields `callId` (aliased to `sessionId`), `caller` (aliased to `initiatorId`), and `receiver` (aliased to `receiverId`) allow unified queries and domain operations across both calling and billing subsystems.
- **Single Source of Truth:** Lifecycle state, timestamps, media confirmation flags, rates, billing leases, and audit trails exist in one single MongoDB collection (`paidcommunicationsessions`).

---

## 2. Reused Existing Components

We preserved and integrated existing production infrastructure without duplication:
- **`backend/models/PaidCommunicationConfig.js`:** Rate snapshots (5 coins/min audio, 10 coins/min video), minimum balance requirements, and grace periods.
- **`backend/services/walletService.js` & `backend/models/WalletLedger.js`:** ACID multi-document MongoDB transactions for coin deductions, escrow holds, and ledger accounting.
- **`backend/services/paidBillingWorker.js`:** Continuous background billing worker extended with `recoverStaleCalls()` to sweep ring timeouts and expired reconnection states.
- **`backend/models/Match.js` & `backend/models/Block.js`:** Canonical mutual match validation and bilateral block checks.
- **`backend/models/User.js`:** User lifecycle validation (preventing banned, suspended, or deleted accounts from initiating or receiving calls).
- **`backend/models/OutboxEvent.js`:** Transactional outbox event publishing for domain events.
- **`backend/config/redis.js`:** Dual Redis command and subscriber clients with fallback safety in standalone test runners.

---

## 3. Files Created & Modified

### Files Created
1. `backend/services/callLockService.js`: Distributed Redis locking service with Lua scripts for atomic dual-user lock acquisition, compare-and-delete release, lock refresh, and ring/reconnection timeouts.
2. `backend/services/callService.js`: Authoritative call domain service managing the 12-state lifecycle, server timestamps, media confirmations, eligibility, and reconciliation.
3. `backend/models/CallSession.js`: Schema alias exporting `PaidCommunicationSession`.
4. `backend/test/c2_call_session_and_redis_locking_tests.js`: Comprehensive 13-test suite covering state machine transitions, eligibility, dual-user locking, idempotency, media confirmation, and billing.
5. `docs/research-4/R4-C2_CALL_SESSION_STATE_AND_REDIS_LOCKING.md`: Architectural documentation and specification.

### Files Modified
1. `backend/models/enums.js`: Added `CallStatuses`, `CallEndReasons`, `CallDomainErrors`, and expanded `PaidSessionStatuses` & `PaidSessionEndReasons` to full 12-state machine.
2. `backend/models/PaidCommunicationSession.js`: Added explicit 12-state transition matrix (`canTransitionTo`), server timestamps (`ringingAt`, `connectingAt`, `reconnectingAt`, `reconnectionDeadline`), `idempotencyKey`, and `durationSeconds`.
3. `backend/models/OutboxEvent.js`: Added `'CALL_SESSION'` to `aggregateType` enum.
4. `backend/config/redis.js`: Exported `getCommandClient: getRedisClient` alias for clean client retrieval.
5. `backend/services/paidBillingWorker.js`: Added automatic invocation of `callService.recoverStaleCalls()` on every worker sweep cycle.

---

## 4. State Machine & Transition Matrix

The authoritative session supports 12 explicit states:
- **Active / Pending States:** `INITIATED`, `RINGING`, `ACCEPTED`, `CONNECTING`, `ACTIVE`, `RECONNECTING`.
- **Terminal States:** `REJECTED`, `CANCELLED`, `MISSED`, `BUSY`, `FAILED`, `ENDED`.

### Explicit Transition Table
| From State | Allowed Target States | Trigger / Actor |
|---|---|---|
| `INITIATED` | `RINGING`, `CANCELLED`, `FAILED` | Server signaling / Caller cancel / Network error |
| `RINGING` | `ACCEPTED`, `REJECTED`, `CANCELLED`, `MISSED`, `BUSY` | Receiver accept / Receiver decline / Caller cancel / 45s ring timeout / Concurrency lock |
| `ACCEPTED` | `CONNECTING`, `CANCELLED`, `FAILED` | WebRTC negotiation initiation / Caller abort / Ice failure |
| `CONNECTING` | `ACTIVE`, `FAILED`, `CANCELLED` | Dual-peer media confirmation / Handshake failure / User drop |
| `ACTIVE` | `RECONNECTING`, `ENDED`, `FAILED` | Transient network drop / Normal hangup / Unrecoverable error |
| `RECONNECTING` | `ACTIVE`, `ENDED`, `FAILED` | WebRTC reconnect restored / 20s grace expired / Handshake failed |
| *Terminal States* | *None (Immutable)* | State transitions out of terminal states return `CALL_ALREADY_TERMINAL` |

---

## 5. Distributed Redis Locking Specification

### Key Namespaces & TTLs
| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `call:lock:user:{userId}` | String | 60s (Auto-refreshed) | Prevents user from participating in multiple simultaneous calls. Value: `callId`. |
| `call:session:{callId}` | Hash | 3600s | Fast session metadata cache and heartbeat registry. |
| `call:idempotency:{callerId}:{idempotencyKey}` | String | 120s | Idempotent initiation cache returning cached `callId`. |
| `call:ring-timeout:{callId}` | String | 45s | Server-side ring expiration tracking. |
| `call:reconnect:{callId}:{userId}` | String | 20s | Reconnection grace deadline tracking. |

### Atomic Multi-User Acquisition via Lua
To eliminate deadlocks and partial acquisitions:
1. `callerId` and `receiverId` are sorted lexicographically before acquisition.
2. A single atomic Lua script tests whether both keys are unset:
   - If both are free, it sets both keys with `callId` and returns `1`.
   - If either key is locked, it aborts without setting anything and returns `0`.
3. Compare-and-delete Lua script ensures that releasing a lock removes the key **only if** its value matches the current `callId`, preventing a stale call from releasing a newer call's lock.

---

## 6. Call Eligibility Rules

Authoritative method: `callService.assertCanStartCall({ callerId, receiverId, callType })`
All eligibility checks execute server-side:
1. **Self-Call Prevention:** `callerId !== receiverId`.
2. **Account Status:** Both users must exist and not be `banned`, `suspended`, or `deleted`.
3. **Mutual Match:** An active `Match` document must exist between both users.
4. **Bilateral Block Check:** Neither caller has blocked receiver, nor receiver has blocked caller.
5. **Supported Call Type:** `callType` must be `AUDIO` or `VIDEO`.
6. **Minimum Balance Affordability:** Caller must hold at least 1 billable minute worth of coins (5 coins for AUDIO, 10 coins for VIDEO).
7. **Rate Limiting / Velocity Check:** Max 5 initiation requests/minute per caller.
8. **Distributed Lock Check:** Neither user can hold an active call lock in Redis.

---

## 7. Idempotency & Concurrency Guarantees

- Callers supply a client-generated UUID `idempotencyKey`.
- `call:idempotency:{callerId}:{idempotencyKey}` stores the created `callId`.
- Duplicate initiation requests within 120 seconds return the existing session safely without double-charging or duplicate session creation.
- Conflicting reuse of an idempotency key with a different receiver or call type raises `IDEMPOTENCY_CONFLICT`.
- Database uniqueness is enforced by compound index: `{ initiatorId: 1, idempotencyKey: 1 }`.

---

## 8. Ring Timeout & Stale Session Sweep

- Calls in `INITIATED` or `RINGING` have a strict **45-second ring deadline** stored in `ringDeadline` on MongoDB and `call:ring-timeout:{callId}` in Redis.
- If the receiver does not accept within 45 seconds, the call transitions atomically to `MISSED`.
- Both Redis locks are immediately released, and zero coins are charged.
- Background worker `paidBillingWorker` runs `callService.recoverStaleCalls()` on each pass to clean up missed calls and expired reconnection sessions across server restarts.

---

## 9. Media Connection Confirmation & Billing Activation

A call is **not billable** while `INITIATED`, `RINGING`, `ACCEPTED`, or `CONNECTING`.
1. Once both participants accept and complete ICE/WebRTC peer connection, both devices report `markMediaConnected`.
2. `peerReadyFlags` tracks caller and receiver readiness independently.
3. The session transitions to `ACTIVE` **only when both flags are true**.
4. The server assigns `connectedAt = new Date()`, starts the billing timer, and records the initial minute snapshot.
5. Calls that terminate before reaching `ACTIVE` (e.g., rejected, missed, cancelled, or handshake failed) **cost exactly zero coins**.

---

## 10. Reconnection Lifecycle

1. If a participant temporarily disconnects from Socket.IO or WebRTC during an `ACTIVE` call, `callService.markReconnecting()` transitions the call to `RECONNECTING`.
2. A strict **20-second grace deadline** is recorded (`reconnectionDeadline = new Date(Date.now() + 20000)`).
3. Both participant locks are retained during the grace window.
4. If the peer reconnects before 20 seconds, `callService.restoreActiveCall()` returns the session to `ACTIVE`.
5. If the 20-second deadline expires without reconnection, the call transitions to `ENDED` with reason `NETWORK_FAILURE` / `CONNECTION_TIMEOUT`, stopping billing and releasing locks.

---

## 11. Billing Integration & Accounting Rules

- **Audio Rate:** 5 Rubaru coins per started billable minute.
- **Video Rate:** 10 Rubaru coins per started billable minute.
- **Snapshot Rate:** Configured rates are snapshotted into `ratePerMinute` upon initiation and cannot be tampered with by clients.
- **Server Derived Duration:** Duration is strictly computed from `(endedAt - connectedAt) / 1000`. Client-provided durations or rates are ignored.
- **Rounding Rule:** `Math.ceil(billableSeconds / 60)` ensures any started minute is billed accurately.
- **Ledger Invariance:** All coin movements utilize `walletService.executePaidTransfer` with immutable `WalletLedger` entries.

---

## 12. Test Execution & Validation Summary

All three core calling and billing test suites were executed and validated against MongoDB and Redis:

| Test Suite | Command | Result | Pass Count | Fail Count |
|---|---|---|---|---|
| **R4-C2 Call Session & Redis Locking** | `node test/c2_call_session_and_redis_locking_tests.js` | **PASSED** | 13 | 0 |
| **Paid Communication Core & Billing** | `node test/paid_communication_tests.js` | **PASSED** | 30 | 0 |
| **PC-09 Native Background Calling & Push** | `node test/pc09_native_background_calling_tests.js` | **PASSED** | 30 | 0 |
| **Total** | | **100% PASSED** | **73** | **0** |

---

## 13. Remaining Blockers & Next Phase Recommendations

### Remaining Blockers
- **None.** All authoritative state transitions, Redis locking mechanisms, eligibility validations, and billing boundaries are verified and operational.

### Recommended Next Phase: R4-C3 (Production Socket.IO Signaling & WebRTC Relay)
Now that the authoritative session engine, state machine, and dual-user locking are solidified:
1. Update `backend/socket/callingSocketHandler.js` to dispatch events through `callService`.
2. Connect signaling events (`call:initiate`, `call:ringing`, `call:accept`, `call:reject`, `call:media-ready`, `call:end`) to the authoritative state machine.
3. Relay SDP Offer / Answer and ICE candidate exchanges securely between validated participants.

---
**Verdict:** `READY_FOR_R4_C3`
