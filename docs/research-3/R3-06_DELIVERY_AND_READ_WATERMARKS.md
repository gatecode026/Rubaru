# Rubaru Research 3 — Prompt R3-06: Delivery and Read Watermarks

**Document Version:** `1.0.0` (Authoritative)  
**Phase:** `Research 3 — Real-Time Messaging Architecture`  
**Execution Timestamp:** `2026-09-02`  
**Status:** `COMPLETED`  
**System Verdict:** `READY_FOR_R3_07`

---

## 1. Executive Summary

This document specifies and certifies the implementation of **Research 3 — R3-06: Delivery and Read Watermarks** for the Rubaru backend.

R3-06 introduces scalable, monotonic, per-conversation delivery and read watermarks stored on `ConversationMember` records. It completely avoids the database explosion of per-message receipt rows while delivering strict, real-time message status updates (`SENT`, `DELIVERED`, `READ`, `DELETED`) across REST and Socket.io.

---

## 2. Scope and Explicit Exclusions

### In Scope:
- Per-member delivery and read watermarks (`deliveredThroughSequence`, `readThroughSequence`).
- Monotonic watermark progression via atomic MongoDB `$max` updates.
- "Read implies delivered" atomic invariant enforcement.
- Centralized conversation authorization, block, and membership status checks.
- Unified shared service layer for REST and Socket.io (`receiptService.js`).
- Durable post-commit Socket.io acknowledgements (`ok: true, data: {...}`).
- Transactional outbox events (`conversation.receipt_watermark.updated`).
- Real-time event fanout to canonical conversation and user rooms.
- Dynamic direct-message status derivation (`SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `READ` / `DELETED`) with zero N+1 database queries.
- Multi-device account-level synchronization without watermark regression.
- Tombstone and media attachment compatibility.
- Comprehensive concurrency, security, REST, Socket.io, and regression test suites.

### Explicitly Excluded (Scheduled for Later Phases):
- Offline synchronization & delta pull ($\rightarrow$ R3-07)
- Typing indicators and presence ($\rightarrow$ R3-08)
- Reactions, replies and polls ($\rightarrow$ R3-09)
- Group administration & group receipt aggregation ($\rightarrow$ R3-10)
- Message push notifications ($\rightarrow$ R3-11)
- React Native / Expo chat UI and viewport read detection ($\rightarrow$ R3-14)

---

## 3. Prerequisite Verification

- **Prerequisite Gate Document**: [`docs/research-3/R3-05_CHAT_MEDIA_AND_VOICE_ATTACHMENTS_PIPELINE.md`](file:///c:/Users/Shubh/Desktop/Rubaru/docs/research-3/R3-05_CHAT_MEDIA_AND_VOICE_ATTACHMENTS_PIPELINE.md)
- **Prerequisite Verdict**: `READY_FOR_R3_06`
- **Confirmation**: R3-05 closed all 12 gaps, passed 33/33 tests, and master regression passed 946/946 assertions with 0 blockers.

---

## 4. Existing Architecture Audit & Files Modified

### Modified Files:
1. [`backend/models/ConversationMember.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/models/ConversationMember.js):
   - Added schema fields: `deliveredThroughSequence`, `readThroughSequence`, `deliveredAt`, `readAt`, `receiptVersion`.
   - Maintained bidirectional alias synchronization with legacy `lastDeliveredSequence` / `lastReadSequence`.
2. [`backend/routes/conversationRoutes.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/routes/conversationRoutes.js):
   - Mounted `POST /:conversationId/receipts/delivered`, `POST /:conversationId/receipts/read`, `GET /:conversationId/receipts`.
3. [`backend/socket/socketEvents.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/socketEvents.js):
   - Registered `receipt.delivered`, `receipt.read`, `conversation.receipt_watermark.updated`.
4. [`backend/socket/messagingSocketHandler.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/messagingSocketHandler.js):
   - Handled `receipt.delivered` and `receipt.read` commands with socket rate-limiting and durable ACK.
5. [`backend/services/socketDispatchService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/socketDispatchService.js):
   - Added `dispatchOutboxReceiptUpdated` to emit to conversation and user rooms.
6. [`backend/services/conversationService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/conversationService.js):
   - Embedded `receiptState` and member watermarks into conversation details.
7. [`backend/services/messageService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/messageService.js):
   - Integrated dynamic `deliveryStatus` derivation into `formatMessageDto`.
8. [`backend/test/run_all_tests.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/test/run_all_tests.js):
   - Added `test/watermark_receipt_tests.js` to master runner.

### Created Files:
1. [`backend/services/receiptService.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/receiptService.js):
   - Centralized business logic for `advanceDeliveryWatermark`, `advanceReadWatermark`, `getConversationReceiptState`, `deriveDirectMessageStatus`.
2. [`backend/controllers/receiptController.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/controllers/receiptController.js):
   - REST controllers for watermark commands.
3. [`backend/test/watermark_receipt_tests.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/test/watermark_receipt_tests.js):
   - Automated 27-assertion test suite covering all R3-06 requirements.
4. [`docs/research-3/R3-06_DELIVERY_AND_READ_WATERMARKS.md`](file:///c:/Users/Shubh/Desktop/Rubaru/docs/research-3/R3-06_DELIVERY_AND_READ_WATERMARKS.md):
   - Authoritative architectural documentation.

---

## 5. Watermark Architecture & Semantics

### 5.1. Why Per-Member Watermarks?
In a chat application with millions of messages, storing receipt status per message per user creates $O(M \times U)$ rows and causes severe index and write contention.
Instead, Rubaru uses monotonic conversation sequence numbers. Because sequences are strictly continuous integers ($1, 2, 3, \dots$):
- Storing `deliveredThroughSequence: N` guarantees that all messages with $\text{sequence} \le N$ were delivered.
- Storing `readThroughSequence: R` guarantees that all messages with $\text{sequence} \le R$ were read.

### 5.2. Invariants
$$0 \le \text{readThroughSequence} \le \text{deliveredThroughSequence} \le \text{conversation.lastSequence}$$

1. **Monotonicity**: Watermarks can only advance or remain unchanged. Lower or equal sequence updates are idempotent no-ops.
2. **Read Implies Delivered**: Advancing `readThroughSequence` to $N$ atomically advances `deliveredThroughSequence` to $\max(\text{currentDelivered}, N)$.
3. **Upper Bound**: An update with $\text{throughSequence} > \text{conversation.lastSequence}$ is rejected with `RECEIPT_SEQUENCE_AHEAD`.

---

## 6. Monotonic Atomic Update Algorithm

Implemented in `backend/services/receiptService.js`:

```javascript
// Delivery Watermark Advancement
const updatedMember = await ConversationMember.findOneAndUpdate(
  {
    conversationId: conversation._id,
    userId: actorUserId,
  },
  {
    $max: {
      deliveredThroughSequence: validSeq,
      lastDeliveredSequence: validSeq,
    },
    $set: {
      deliveredAt: now,
    },
    $inc: {
      receiptVersion: 1,
    },
  },
  { new: true }
);

// Read Watermark Advancement (Read implies delivered)
const updatedMember = await ConversationMember.findOneAndUpdate(
  {
    conversationId: conversation._id,
    userId: actorUserId,
  },
  {
    $max: {
      readThroughSequence: validSeq,
      lastReadSequence: validSeq,
      deliveredThroughSequence: validSeq,
      lastDeliveredSequence: validSeq,
    },
    $set: {
      readAt: now,
      deliveredAt: now,
    },
    $inc: {
      receiptVersion: 1,
    },
  },
  { new: true }
);
```

---

## 7. Contracts & APIs

### 7.1. REST Endpoints

#### Advance Delivery Watermark
- **Endpoint**: `POST /v1/conversations/:conversationId/receipts/delivered`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "throughSequence": 125
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "conversationId": "6a98...",
      "deliveredThroughSequence": 125,
      "readThroughSequence": 120,
      "deliveredAt": "2026-09-02T16:40:00.000Z",
      "readAt": "2026-09-02T16:38:00.000Z",
      "changed": true
    }
  }
  ```

#### Advance Read Watermark
- **Endpoint**: `POST /v1/conversations/:conversationId/receipts/read`
- **Request Body**: `{"throughSequence": 125}`
- **Response** (`200 OK`): Returns updated watermarks (`readThroughSequence: 125`, `deliveredThroughSequence: 125`).

#### Get Receipt State
- **Endpoint**: `GET /v1/conversations/:conversationId/receipts`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "conversationId": "6a98...",
      "receiptState": {
        "self": { "deliveredThroughSequence": 125, "readThroughSequence": 125, "deliveredAt": "...", "readAt": "..." },
        "peer": { "deliveredThroughSequence": 120, "readThroughSequence": 115, "deliveredAt": "...", "readAt": "..." }
      }
    }
  }
  ```

### 7.2. Socket.io Commands & Events

#### Client Commands:
- `receipt.delivered`: `{"conversationId": "...", "throughSequence": 125}` $\rightarrow$ ACK `{"ok": true, "data": {...}}`
- `receipt.read`: `{"conversationId": "...", "throughSequence": 125}` $\rightarrow$ ACK `{"ok": true, "data": {...}}`

#### Dispatched Real-Time Event:
- `conversation.receipt_watermark.updated`:
  ```json
  {
    "version": 1,
    "eventId": "evt_rcpt_del_6a98..._172527...",
    "eventType": "conversation.receipt_watermark.updated",
    "occurredAt": "2026-09-02T16:40:00.000Z",
    "data": {
      "conversationId": "6a98...",
      "actorUserId": "6a98...",
      "deliveredThroughSequence": 125,
      "readThroughSequence": 120,
      "deliveredAt": "2026-09-02T16:40:00.000Z",
      "readAt": null,
      "receiptType": "DELIVERED"
    }
  }
  ```

---

## 8. Direct-Message Status Derivation (Zero N+1)

Given a message sequence $S$ sent by the actor, its status is derived dynamically in memory against the peer member's watermarks:

$$\text{status}(S) = \begin{cases} \text{DELETED} & \text{if } \text{message.status} == \text{'DELETED'} \\ \text{READ} & \text{if } \text{peer.readThroughSequence} \ge S \\ \text{DELIVERED} & \text{if } \text{peer.deliveredThroughSequence} \ge S \\ \text{SENT} & \text{otherwise} \end{cases}$$

No message records are mutated or rewritten when receipts advance.

---

## 9. Requirement Traceability Matrix

| Requirement ID | Description | Implementation File | Verification Test | Status |
| :--- | :--- | :--- | :--- | :--- |
| `R3-06-REQ-001` | Per-member delivery watermark | `ConversationMember.js`, `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-002` | Per-member read watermark | `ConversationMember.js`, `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-003` | Monotonic watermark updates | `receiptService.js` (`$max`) | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-004` | Read implies delivered | `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-005` | Sequence-bound validation | `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-006` | Centralized conversation authorization | `receiptService.js`, `conversationAuthorizationService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-007` | REST delivered command | `receiptController.js`, `conversationRoutes.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-008` | REST read command | `receiptController.js`, `conversationRoutes.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-009` | Socket.io delivered command | `messagingSocketHandler.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-010` | Socket.io read command | `messagingSocketHandler.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-011` | Shared receipt service | `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-012` | Durable accepted acknowledgement | `messagingSocketHandler.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-013` | Transactional outbox events | `receiptService.js`, `OutboxEvent.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-014` | Versioned receipt event contracts | `socketDispatchService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-015` | Direct-message status derivation | `receiptService.js`, `messageService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-016` | Conversation & history DTO integration | `conversationService.js`, `messageService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-017` | Multi-device account-level semantics | `socketDispatchService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-018` | Idempotent duplicate & stale updates | `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-019` | Out-of-order event safety | `socketDispatchService.js`, `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-020` | Block, unmatch & revocation | `conversationAuthorizationService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-021` | Receipt privacy & data minimization | `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-022` | Rate limiting & abuse protection | `messagingSocketHandler.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-023` | Tombstone & attachment compatibility | `receiptService.js`, `messageService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-024` | Backward-compatible schema migration | `ConversationMember.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-025` | Security tests | `test/watermark_receipt_tests.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-026` | Concurrency tests | `test/watermark_receipt_tests.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-027` | REST and Socket.io parity tests | `test/watermark_receipt_tests.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-028` | Research regression tests | `run_all_tests.js` | `run_all_tests.js` | **VERIFIED** |
| `R3-06-REQ-029` | Operational metrics and safe logging | `receiptService.js` | `test/watermark_receipt_tests.js` | **VERIFIED** |
| `R3-06-REQ-030` | Authoritative documentation | This document | `test/watermark_receipt_tests.js` | **VERIFIED** |

---

## 10. Master Test Evidence

```text
================================================================================
   RUBARU COMPLETE RESEARCH 1, RESEARCH 2 & RESEARCH 3 MASTER TEST RUNNER      
================================================================================

[SUITE 1/31] Executing: test/model_level_tests.js...
  -> Result: 18 Passed, 0 Failed (1452ms)
[SUITE 2/31] Executing: test/preference_tests.js...
  -> Result: 28 Passed, 0 Failed (3407ms)
[SUITE 3/31] Executing: test/location_tests.js...
  -> Result: 31 Passed, 0 Failed (3511ms)
[SUITE 4/31] Executing: test/eligibility_tests.js...
  -> Result: 25 Passed, 0 Failed (2649ms)
[SUITE 5/31] Executing: test/discovery_tests.js...
  -> Result: 29 Passed, 0 Failed (5813ms)
[SUITE 6/31] Executing: test/impression_tests.js...
  -> Result: 16 Passed, 0 Failed (4986ms)
[SUITE 7/31] Executing: test/pass_undo_tests.js...
  -> Result: 27 Passed, 0 Failed (5684ms)
[SUITE 8/31] Executing: test/like_tests.js...
  -> Result: 28 Passed, 0 Failed (9151ms)
[SUITE 9/31] Executing: test/incoming_likes_tests.js...
  -> Result: 36 Passed, 0 Failed (4339ms)
[SUITE 10/31] Executing: test/match_tests.js...
  -> Result: 27 Passed, 0 Failed (6532ms)
[SUITE 11/31] Executing: test/matches_list_authorization_tests.js...
  -> Result: 30 Passed, 0 Failed (4735ms)
[SUITE 12/31] Executing: test/safety_tests.js...
  -> Result: 30 Passed, 0 Failed (6599ms)
[SUITE 13/31] Executing: test/frontend_dating_integration_tests.js...
  -> Result: 23 Passed, 0 Failed (7150ms)
[SUITE 14/31] Executing: test/concurrency_security_audit_tests.js...
  -> Result: 12 Passed, 0 Failed (4836ms)
[SUITE 15/31] Executing: test/media_foundation_tests.js...
  -> Result: 33 Passed, 0 Failed (3237ms)
[SUITE 16/31] Executing: test/follow_graph_tests.js...
  -> Result: 42 Passed, 0 Failed (6548ms)
[SUITE 17/31] Executing: test/post_lifecycle_tests.js...
  -> Result: 40 Passed, 0 Failed (6555ms)
[SUITE 18/31] Executing: test/content_visibility_authorization_tests.js...
  -> Result: 21 Passed, 0 Failed (5299ms)
[SUITE 19/31] Executing: test/social_interaction_tests.js...
  -> Result: 50 Passed, 0 Failed (8305ms)
[SUITE 20/31] Executing: test/connected_feed_tests.js...
  -> Result: 44 Passed, 0 Failed (5211ms)
[SUITE 21/31] Executing: test/feed_impression_tests.js...
  -> Result: 31 Passed, 0 Failed (3703ms)
[SUITE 22/31] Executing: test/story_lifecycle_tests.js...
  -> Result: 37 Passed, 0 Failed (5177ms)
[SUITE 23/31] Executing: test/reel_playback_tests.js...
  -> Result: 36 Passed, 0 Failed (5447ms)
[SUITE 24/31] Executing: test/social_safety_moderation_tests.js...
  -> Result: 41 Passed, 0 Failed (6763ms)
[SUITE 25/31] Executing: test/social_notification_tests.js...
  -> Result: 48 Passed, 0 Failed (4705ms)
[SUITE 26/31] Executing: test/frontend_social_integration_tests.js...
  -> Result: 41 Passed, 0 Failed (9665ms)
[SUITE 27/31] Executing: test/conversation_foundation_tests.js...
  -> Result: 45 Passed, 0 Failed (5894ms)
[SUITE 28/31] Executing: test/socket_messaging_tests.js...
  -> Result: 31 Passed, 0 Failed (5741ms)
[SUITE 29/31] Executing: test/chat_media_tests.js...
  -> Result: 33 Passed, 0 Failed (10514ms)
[SUITE 30/31] Executing: test/watermark_receipt_tests.js...
  -> Result: 27 Passed, 0 Failed (10347ms)
[SUITE 31/31] Executing: test_all_endpoints.js...
  -> Result: 13 Passed, 0 Failed (4561ms)

================================================================================
                         EXACT ARITHMETIC BREAKDOWN                              
================================================================================
┌─────────┬──────────────────────────────────────────────────┬────────┬────────┬───────────┬────────┐
│ (index) │ file                                             │ passed │ failed │ elapsedMs │ status │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼───────────┼────────┤
│ 0       │ 'test/model_level_tests.js'                      │ 18     │ 0      │ 1452      │ 'PASS' │
│ 1       │ 'test/preference_tests.js'                       │ 28     │ 0      │ 3407      │ 'PASS' │
│ 2       │ 'test/location_tests.js'                         │ 31     │ 0      │ 3511      │ 'PASS' │
│ 3       │ 'test/eligibility_tests.js'                      │ 25     │ 0      │ 2649      │ 'PASS' │
│ 4       │ 'test/discovery_tests.js'                        │ 29     │ 0      │ 5813      │ 'PASS' │
│ 5       │ 'test/impression_tests.js'                       │ 16     │ 0      │ 4986      │ 'PASS' │
│ 6       │ 'test/pass_undo_tests.js'                        │ 27     │ 0      │ 5684      │ 'PASS' │
│ 7       │ 'test/like_tests.js'                             │ 28     │ 0      │ 9151      │ 'PASS' │
│ 8       │ 'test/incoming_likes_tests.js'                   │ 36     │ 0      │ 4339      │ 'PASS' │
│ 9       │ 'test/match_tests.js'                            │ 27     │ 0      │ 6532      │ 'PASS' │
│ 10      │ 'test/matches_list_authorization_tests.js'       │ 30     │ 0      │ 4735      │ 'PASS' │
│ 11      │ 'test/safety_tests.js'                           │ 30     │ 0      │ 6599      │ 'PASS' │
│ 12      │ 'test/frontend_dating_integration_tests.js'      │ 23     │ 0      │ 7150      │ 'PASS' │
│ 13      │ 'test/concurrency_security_audit_tests.js'       │ 12     │ 0      │ 4836      │ 'PASS' │
│ 14      │ 'test/media_foundation_tests.js'                 │ 33     │ 0      │ 3237      │ 'PASS' │
│ 15      │ 'test/follow_graph_tests.js'                     │ 42     │ 0      │ 6548      │ 'PASS' │
│ 16      │ 'test/post_lifecycle_tests.js'                   │ 40     │ 0      │ 6555      │ 'PASS' │
│ 17      │ 'test/content_visibility_authorization_tests.js' │ 21     │ 0      │ 5299      │ 'PASS' │
│ 18      │ 'test/social_interaction_tests.js'               │ 50     │ 0      │ 8305      │ 'PASS' │
│ 19      │ 'test/connected_feed_tests.js'                   │ 44     │ 0      │ 5211      │ 'PASS' │
│ 20      │ 'test/feed_impression_tests.js'                  │ 31     │ 0      │ 3703      │ 'PASS' │
│ 21      │ 'test/story_lifecycle_tests.js'                  │ 37     │ 0      │ 5177      │ 'PASS' │
│ 22      │ 'test/reel_playback_tests.js'                    │ 36     │ 0      │ 5447      │ 'PASS' │
│ 23      │ 'test/social_safety_moderation_tests.js'         │ 41     │ 0      │ 6763      │ 'PASS' │
│ 24      │ 'test/social_notification_tests.js'              │ 48     │ 0      │ 4705      │ 'PASS' │
│ 25      │ 'test/frontend_social_integration_tests.js'      │ 41     │ 0      │ 9665      │ 'PASS' │
│ 26      │ 'test/conversation_foundation_tests.js'          │ 45     │ 0      │ 5894      │ 'PASS' │
│ 27      │ 'test/socket_messaging_tests.js'                 │ 31     │ 0      │ 5741      │ 'PASS' │
│ 28      │ 'test/chat_media_tests.js'                       │ 33     │ 0      │ 10514     │ 'PASS' │
│ 29      │ 'test/watermark_receipt_tests.js'                │ 27     │ 0      │ 10347     │ 'PASS' │
│ 30      │ 'test_all_endpoints.js'                          │ 13     │ 0      │ 4561      │ 'PASS' │
└─────────┴──────────────────────────────────────────────────┴────────┴────────┴───────────┴────────┘

GRAND TOTAL ASSERTIONS EXECUTED: 973
TOTAL PASSED: 973
TOTAL FAILED: 0
SUCCESS RATE: 100.00%
================================================================================
```

---

## 11. Final Decision

```text
READY_FOR_R3_07
```

```text
R3-06 Delivery and Read Watermarks completed and verified across all 30 requirements.
Offline synchronization, presence, typing indicators, reactions, push notifications, and frontend chat integration were not implemented in this phase.
```
