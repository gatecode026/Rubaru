# Rubaru Research 3 — Prompt R3-08: Typing Indicators and Real-Time Presence

**Document Version:** `1.0.0` (Authoritative)  
**Phase:** `Research 3 — Real-Time Messaging Architecture`  
**Execution Timestamp:** `2026-09-03`  
**Status:** `COMPLETED`  
**System Verdict:** `READY_FOR_R3_09`

---

## 1. Executive Summary

This document specifies, tests, and certifies the implementation of **Research 3 — R3-08: Typing Indicators and Real-Time Presence** for the Rubaru backend.

R3-08 introduces:
1. **Ephemeral Presence Store & Lifecycle Engine**: Account-level presence tracking supporting multi-device aggregation (1+ connections = `ONLINE`, 0 connections = `OFFLINE`), heartbeat lease renewals, flapping debounce, and zero MongoDB write overhead on heartbeats.
2. **Authorized Ephemeral Typing Indicators**: Real-time typing indicators (`typing.start`, `typing.stop`) with automatic TTL expiration, multi-device aggregation per conversation, deduplication to prevent event storms, and zero persistence in MongoDB or transactional outbox.
3. **Privacy and Safety Integration**: Presence and typing indicators are visible strictly to authorized active conversation participants, with immediate lease revocation and event suppression upon block or unmatch.
4. **Resilient Multi-Instance Architecture**: Distributed presence store abstraction designed for Redis-backed deployments with graceful degradation to `UNKNOWN` states during store outages.

---

## 2. Scope and Explicit Exclusions

### In Scope:
- Ephemeral presence-store abstraction (`InMemoryPresenceStore` & `RedisPresenceStore`).
- Server-derived authenticated connection registration and disconnect cleanup.
- Account-level multi-device presence aggregation.
- Heartbeat lease extension without persistent database writes.
- First-connect (`ONLINE`) and last-disconnect (`OFFLINE`) state transitions.
- Authorized presence snapshot REST endpoint (`GET /v1/conversations/:conversationId/presence`) and Socket command (`presence.snapshot`).
- Ephemeral typing-store abstraction with TTL-backed automatic lease expiration.
- Authorized `typing.start` and `typing.stop` socket commands with membership validation and `SEND_MESSAGE` permission verification.
- Multi-device typing aggregation per user per conversation.
- Typing broadcast deduplication (suppressing duplicate broadcasts on repeated keypresses).
- Symmetrical block/unmatch typing lease eviction and room revocation.
- Complete privacy protection (payload minimization without draft text, socket IDs, or device metadata).
- Offline-synchronization isolation (zero presence or typing events in Outbox or catch-up history).
- 33 test suites with 1044 passing automated assertions across Research 1, 2, and 3.

### Explicitly Excluded (Scheduled for Later Phases):
- Message reactions, threaded replies, and in-chat polls ($\rightarrow$ R3-09)
- Group conversation administration and member roles ($\rightarrow$ R3-10)
- Push notifications and notification delivery preferences ($\rightarrow$ R3-11)
- React Native / Expo UI components and Redux presence reducers ($\rightarrow$ R3-14)

---

## 3. Prerequisite Verification

- **Prerequisite Gate Document**: [`docs/research-3/R3-07_OFFLINE_SYNCHRONIZATION_AND_CATCH_UP.md`](file:///c:/Users/Shubh/Desktop/Rubaru/docs/research-3/R3-07_OFFLINE_SYNCHRONIZATION_AND_CATCH_UP.md)
- **Prerequisite Verdict**: `READY_FOR_R3_08`
- **Confirmation**: R3-07 offline sync verified, 32/32 test suites passed, 993/993 assertions passed with 0 blockers.

---

## 4. Existing Architecture Audit & Files Modified

### Modified Files:
1. [`backend/socket/socketEvents.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/socketEvents.js):
   - Registered `PRESENCE_HEARTBEAT`, `PRESENCE_SNAPSHOT`, `PRESENCE_UPDATED`, `TYPING_START`, `TYPING_STOP`, `TYPING_UPDATED`, and legacy event aliases.
2. [`backend/socket/socketHandler.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/socketHandler.js):
   - Integrated presence connection lease registration on connect, disconnect removal, and socket typing lease eviction.
3. [`backend/socket/messagingSocketHandler.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/messagingSocketHandler.js):
   - Handled `presence.heartbeat`, `presence.snapshot`, `typing.start`, and `typing.stop` with rate limiting and centralized authorization.
4. [`backend/routes/conversationRoutes.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/routes/conversationRoutes.js):
   - Mounted `GET /:conversationId/presence` endpoint.
5. [`backend/services/safetyService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/safetyService.js):
   - Integrated immediate ephemeral typing eviction on unmatch and block.
6. [`backend/test/run_all_tests.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/test/run_all_tests.js):
   - Registered `test/presence_typing_tests.js` in master runner (33 suites).

### Created Files:
1. [`backend/services/presenceStore.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/presenceStore.js):
   - Ephemeral presence and typing store abstraction with TTL lease management, reverse indexes, and multi-device aggregation.
2. [`backend/services/presenceService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/presenceService.js):
   - Presence domain service managing connection lifecycle, snapshots, and room fan-outs.
3. [`backend/services/typingService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/typingService.js):
   - Typing domain service enforcing `SEND_MESSAGE` authorization, deduplication, and broadcast fan-outs.
4. [`backend/controllers/presenceController.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/controllers/presenceController.js):
   - REST controller for authorized presence snapshot.
5. [`backend/test/presence_typing_tests.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/test/presence_typing_tests.js):
   - 51 automated assertions testing all R3-08 requirements.
6. [`docs/research-3/R3-08_TYPING_INDICATORS_AND_REAL_TIME_PRESENCE.md`](file:///c:/Users/Shubh/Desktop/Rubaru/docs/research-3/R3-08_TYPING_INDICATORS_AND_REAL_TIME_PRESENCE.md):
   - Authoritative architectural documentation.

---

## 5. Presence Architecture & Contracts

### 5.1. Presence Canonical States
- `ONLINE`: At least one authenticated active connection lease exists.
- `OFFLINE`: No active connection leases remain.
- `UNKNOWN`: Distributed presence store is unreachable or degraded.
- `UNAVAILABLE`: Privacy settings or relationship status conceals presence.

### 5.2. Presence Snapshot Contract (`GET /v1/conversations/:conversationId/presence`)
```json
{
  "success": true,
  "data": {
    "version": 1,
    "conversationId": "6a98fc6c9b22f55151870fcf",
    "members": [
      {
        "userId": "6a98fc6c9b22f55151870fcf",
        "state": "ONLINE",
        "lastSeenAt": null
      },
      {
        "userId": "6a98fc6c9b22f55151870fd2",
        "state": "OFFLINE",
        "lastSeenAt": "2026-09-03T04:50:00.000Z"
      }
    ],
    "generatedAt": "2026-09-03T04:50:05.000Z"
  }
}
```

### 5.3. Versioned Presence Updated Event (`presence.updated`)
Dispatched to conversation rooms upon meaningful account-level transition:
```json
{
  "version": 1,
  "userId": "6a98fc6c9b22f55151870fcf",
  "state": "OFFLINE",
  "changedAt": "2026-09-03T04:50:00.000Z",
  "lastSeenAt": "2026-09-03T04:50:00.000Z"
}
```

---

## 6. Typing Indicators Architecture & Contracts

### 6.1. Typing Start / Stop Commands
- `typing.start`: `{ "conversationId": "..." }`
- `typing.stop`: `{ "conversationId": "..." }`

### 6.2. Typing Updated Event (`typing.updated`)
Dispatched only on effective transition (first start or final stop across devices):
```json
{
  "version": 1,
  "conversationId": "6a98fc6c9b22f55151870fcf",
  "userId": "6a98fc6c9b22f55151870fcf",
  "isTyping": true,
  "expiresAt": "2026-09-03T04:50:10.000Z"
}
```

---

## 7. Requirement Traceability Matrix

| Requirement ID | Implementation Files & Symbols | Tests | Evidence | Status |
| -------------- | ------------------------------ | ----- | -------- | ------ |
| `R3-08-REQ-001` | `presenceStore.js` (`PresenceStore`, `InMemoryPresenceStore`) | `test/presence_typing_tests.js` Sec 1 | Registered & managed lease state | **PASS** |
| `R3-08-REQ-002` | `presenceStore.js` (`PresenceStore` adapter contract) | `test/presence_typing_tests.js` Sec 1, 8 | TTL lease & key design | **PASS** |
| `R3-08-REQ-003` | `socketHandler.js`, `socketAuth.js` | `test/presence_typing_tests.js` Sec 2 | Server-derived user ID presence | **PASS** |
| `R3-08-REQ-004` | `presenceStore.js` (`userConnections` multi-device map) | `test/presence_typing_tests.js` Sec 1, 2 | Account-level aggregation | **PASS** |
| `R3-08-REQ-005` | `messagingSocketHandler.js` (`handlePresenceHeartbeat`) | `test/presence_typing_tests.js` Sec 1, 2 | Heartbeat refreshes TTL; 0 DB writes | **PASS** |
| `R3-08-REQ-006` | `presenceService.js` (`broadcastPresenceUpdated`) | `test/presence_typing_tests.js` Sec 2 | 1st connect -> ONLINE, last disc -> OFFLINE | **PASS** |
| `R3-08-REQ-007` | `presenceStore.js` (lease grace & atomic checks) | `test/presence_typing_tests.js` Sec 1, 2 | Flapping protection verified | **PASS** |
| `R3-08-REQ-008` | `presenceService.js` (`getAuthorizedPresenceSnapshot`) | `test/presence_typing_tests.js` Sec 3 | Authorized member visibility | **PASS** |
| `R3-08-REQ-009` | `conversationAuthorizationService.js`, `presenceService.js` | `test/presence_typing_tests.js` Sec 3 | Non-members rejected (403) | **PASS** |
| `R3-08-REQ-010` | `presenceController.js`, `messagingSocketHandler.js` | `test/presence_typing_tests.js` Sec 3 | REST & Socket snapshot contract | **PASS** |
| `R3-08-REQ-011` | `socketEvents.js` (`PRESENCE_UPDATED`) | `test/presence_typing_tests.js` Sec 2 | Versioned event; no sensitive leaks | **PASS** |
| `R3-08-REQ-012` | `presenceService.js` (`removeSocketConnection`) | `test/presence_typing_tests.js` Sec 2 | Server-generated last-seen on offline | **PASS** |
| `R3-08-REQ-013` | `presenceStore.js` (`setDegraded`), `presenceService.js` | `test/presence_typing_tests.js` Sec 8 | Graceful fallback to `UNKNOWN` | **PASS** |
| `R3-08-REQ-014` | `presenceStore.js` (`typingLeases`, `socketTypingIndex`) | `test/presence_typing_tests.js` Sec 4 | Ephemeral typing store | **PASS** |
| `R3-08-REQ-015` | `messagingSocketHandler.js` (`handleTypingStart`) | `test/presence_typing_tests.js` Sec 4 | Authorized typing start | **PASS** |
| `R3-08-REQ-016` | `messagingSocketHandler.js` (`handleTypingStop`) | `test/presence_typing_tests.js` Sec 4 | Authorized typing stop | **PASS** |
| `R3-08-REQ-017` | `presenceStore.js` (`expireTypingLeases`, 5s TTL) | `test/presence_typing_tests.js` Sec 4 | Automatic typing TTL expiration | **PASS** |
| `R3-08-REQ-018` | `presenceStore.js` (`userTypingConns`) | `test/presence_typing_tests.js` Sec 5 | Multi-device typing aggregation | **PASS** |
| `R3-08-REQ-019` | `typingService.js` (`isEffectiveTransition`) | `test/presence_typing_tests.js` Sec 4 | Duplicate starts/stops deduplicated | **PASS** |
| `R3-08-REQ-020` | `typingService.js` (`broadcastTypingUpdated`) | `test/presence_typing_tests.js` Sec 4 | Zero text/socketId in typing payload | **PASS** |
| `R3-08-REQ-021` | `safetyService.js` (`unmatchUser`, `blockUser`) | `test/presence_typing_tests.js` Sec 6 | Ephemeral leases cleared on block | **PASS** |
| `R3-08-REQ-022` | `presenceStore.js`, `syncService.js` | `test/presence_typing_tests.js` Sec 6 | 0 typing in Outbox or offline sync | **PASS** |
| `R3-08-REQ-023` | `messagingSocketHandler.js` (`checkSocketRateLimit`) | `test/presence_typing_tests.js` Sec 7 | Rate limiting on heartbeats & typing | **PASS** |
| `R3-08-REQ-024` | `presenceService.js`, `typingService.js` errors | `test/presence_typing_tests.js` Sec 7 | Canonical error codes | **PASS** |
| `R3-08-REQ-025` | `presenceStore.js` (distributed multi-node tests) | `test/presence_typing_tests.js` Sec 8 | Cross-node transition consistency | **PASS** |
| `R3-08-REQ-026` | `presence_typing_tests.js` Sec 7 | `test/presence_typing_tests.js` Sec 7 | Security & spoofing resistance | **PASS** |
| `R3-08-REQ-027` | `presence_typing_tests.js` Sec 9 | `test/presence_typing_tests.js` Sec 9 | Race condition & concurrency tests | **PASS** |
| `R3-08-REQ-028` | `run_all_tests.js` (all 33 suites) | `test/run_all_tests.js` | 1044/1044 passed; 0 regressions | **PASS** |
| `R3-08-REQ-029` | `presenceService.js`, `socketHandler.js` | `test/presence_typing_tests.js` Sec 2 | Safe logging; zero credentials leaked | **PASS** |
| `R3-08-REQ-030` | `R3-08_TYPING_INDICATORS_AND_REAL_TIME_PRESENCE.md` | `test/run_all_tests.js` | Authoritative documentation & verdict | **PASS** |

---

## 8. Exact Test Execution Evidence

**Test Execution Date:** `2026-09-03`  
**Command:** `node test/run_all_tests.js`  
**Working Directory:** `backend`  
**Environment:** Atlas MongoDB Cluster + Node.js v20.x + Socket.io 4.7.5

```text
================================================================================
                         EXACT ARITHMETIC BREAKDOWN                              
================================================================================
┌─────────┬──────────────────────────────────────────────────┬────────┬────────┬───────────┬────────┐
│ (index) │ file                                             │ passed │ failed │ elapsedMs │ status │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼───────────┼────────┤
│ 0       │ 'test/model_level_tests.js'                      │ 18     │ 0      │ 1485      │ 'PASS' │
│ 1       │ 'test/preference_tests.js'                       │ 28     │ 0      │ 6774      │ 'PASS' │
│ 2       │ 'test/location_tests.js'                         │ 31     │ 0      │ 3266      │ 'PASS' │
│ 3       │ 'test/eligibility_tests.js'                      │ 25     │ 0      │ 2751      │ 'PASS' │
│ 4       │ 'test/discovery_tests.js'                        │ 29     │ 0      │ 5500      │ 'PASS' │
│ 5       │ 'test/impression_tests.js'                       │ 16     │ 0      │ 4326      │ 'PASS' │
│ 6       │ 'test/pass_undo_tests.js'                        │ 27     │ 0      │ 6024      │ 'PASS' │
│ 7       │ 'test/like_tests.js'                             │ 28     │ 0      │ 9655      │ 'PASS' │
│ 8       │ 'test/incoming_likes_tests.js'                   │ 36     │ 0      │ 4234      │ 'PASS' │
│ 9       │ 'test/match_tests.js'                            │ 27     │ 0      │ 7127      │ 'PASS' │
│ 10      │ 'test/matches_list_authorization_tests.js'       │ 30     │ 0      │ 5780      │ 'PASS' │
│ 11      │ 'test/safety_tests.js'                           │ 30     │ 0      │ 7253      │ 'PASS' │
│ 12      │ 'test/frontend_dating_integration_tests.js'      │ 23     │ 0      │ 11742     │ 'PASS' │
│ 13      │ 'test/concurrency_security_audit_tests.js'       │ 12     │ 0      │ 4926      │ 'PASS' │
│ 14      │ 'test/media_foundation_tests.js'                 │ 33     │ 0      │ 3672      │ 'PASS' │
│ 15      │ 'test/follow_graph_tests.js'                     │ 42     │ 0      │ 6818      │ 'PASS' │
│ 16      │ 'test/post_lifecycle_tests.js'                   │ 40     │ 0      │ 6832      │ 'PASS' │
│ 17      │ 'test/content_visibility_authorization_tests.js' │ 21     │ 0      │ 5376      │ 'PASS' │
│ 18      │ 'test/social_interaction_tests.js'               │ 50     │ 0      │ 8435      │ 'PASS' │
│ 19      │ 'test/connected_feed_tests.js'                   │ 44     │ 0      │ 5979      │ 'PASS' │
│ 20      │ 'test/feed_impression_tests.js'                  │ 31     │ 0      │ 4613      │ 'PASS' │
│ 21      │ 'test/story_lifecycle_tests.js'                  │ 36     │ 0      │ 6484      │ 'PASS' │
│ 22      │ 'test/reel_playback_tests.js'                    │ 36     │ 0      │ 6186      │ 'PASS' │
│ 23      │ 'test/social_safety_moderation_tests.js'         │ 41     │ 0      │ 8874      │ 'PASS' │
│ 24      │ 'test/social_notification_tests.js'              │ 48     │ 0      │ 7287      │ 'PASS' │
│ 25      │ 'test/frontend_social_integration_tests.js'      │ 41     │ 0      │ 11294     │ 'PASS' │
│ 26      │ 'test/conversation_foundation_tests.js'          │ 45     │ 0      │ 6937      │ 'PASS' │
│ 27      │ 'test/socket_messaging_tests.js'                 │ 31     │ 0      │ 6315      │ 'PASS' │
│ 28      │ 'test/chat_media_tests.js'                       │ 33     │ 0      │ 11228     │ 'PASS' │
│ 29      │ 'test/watermark_receipt_tests.js'                │ 27     │ 0      │ 11407     │ 'PASS' │
│ 30      │ 'test/offline_sync_tests.js'                     │ 21     │ 0      │ 9859      │ 'PASS' │
│ 31      │ 'test/presence_typing_tests.js'                  │ 51     │ 0      │ 6946      │ 'PASS' │
│ 32      │ 'test_all_endpoints.js'                          │ 13     │ 0      │ 5818      │ 'PASS' │
└─────────┴──────────────────────────────────────────────────┴────────┴────────┴───────────┴────────┘

GRAND TOTAL ASSERTIONS EXECUTED: 1044
TOTAL PASSED: 1044
TOTAL FAILED: 0
SUCCESS RATE: 100.00%
================================================================================
```

---

## 9. Final Readiness Decision

```text
READY_FOR_R3_09
```

```text
R3-08 Typing Indicators and Real-Time Presence completed and verified across all 30 requirements.
Reactions, replies, in-chat polls, group administration, push notifications, and frontend chat reducers were not implemented in this phase.
```
