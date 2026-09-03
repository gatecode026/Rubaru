# Rubaru Research 3 — Step R3-02: Conversation & Membership Foundation

**Document Version:** `1.0.0`  
**Phase:** `Research 3 — Real-Time Messaging Architecture`  
**Execution Timestamp:** `2026-09-02`  
**Status:** `COMPLETED`  
**System Verdict:** `READY_FOR_R3_03`

---

## 1. Executive Summary

Research 3 Step **R3-02 (Conversation & Membership Foundation)** establishes the authoritative, production-grade schema and domain layer for real-time conversations and membership management within the Rubaru platform.

Prior to R3-02, messaging existed as a prototype with informal participant arrays, client-dictated conversation creation, and lack of strict state transitions on unmatch or blocking events. R3-02 resolves all architectural deficiencies identified in `docs/research-3/R3-01_EXISTING_MESSAGING_AUDIT.md` by establishing:

1. **Authoritative Conversation Schema (`Conversation.js`)**: Encapsulates conversation lifecycle, type (`DIRECT_MATCH`, `GROUP`), deterministic sequence counters (`lastSequence`), atomic match references, and security status.
2. **Authoritative Membership Schema (`ConversationMember.js`)**: Decouples membership identity from conversation documents, providing granular member roles (`OWNER`, `ADMIN`, `MEMBER`), membership lifecycle states (`ACTIVE`, `LEFT`, `REMOVED`, `BLOCKED`), delivery/read sequence watermarks (`lastDeliveredSequence`, `lastReadSequence`), and notification preferences.
3. **Deterministic Direct-Match Uniqueness**: Enforced via a unique sparse compound index on `canonicalParticipantKey` (`lowerUserId:higherUserId`) and atomic resolution in `ensureDirectMatchConversation`. Concurrent creation attempts under race conditions resolve to exactly one conversation document.
4. **Centralized Conversation Authorization (`conversationAuthorizationService.js`)**: A single authoritative policy engine that enforces membership checks, account status verification, match lifecycle gating, and bilateral block restrictions across all conversational operations.
5. **Safety & Moderation Integration**: Deeply integrated with `matchService.js` and `safetyService.js`. Unmatching atomically transitions conversations to `CLOSED_BY_UNMATCH`, blocking transitions conversations to `CLOSED_BY_BLOCK` and updates membership states to `BLOCKED`.
6. **Transactional Outbox Events**: Emits `conversation.created` and `conversation.closed` events for reliable downstream processing.
7. **Production REST Endpoints (`/v1/conversations`)**: Provides cursor-paginated conversation lists, safe single-conversation retrieval with zero N+1 queries, and idempotent direct conversation resolution.
8. **100% Regression-Free Verification**: All 28 test suites (Research 1 Dating Core, Research 2 Social Media, and Research 3 Conversation Foundation) pass with **885/885 assertions passing (100.00% success rate)**.

---

## 2. Formal System Verdict

```text
================================================================================
FINAL VERDICT: READY_FOR_R3_03
================================================================================
- Authoritative Conversation Model:         COMPLETED & VERIFIED
- Authoritative Membership Model:            COMPLETED & VERIFIED
- Direct Match Uniqueness & Concurrency:     VERIFIED (10 CONCURRENT WRITES -> 1 DOC)
- Centralized Authorization Layer:           COMPLETED & TESTED
- Safety, Unmatch & Block Integration:       COMPLETED & TESTED
- REST Endpoints & Signed Cursor Pagination: COMPLETED & TESTED
- Transactional Outbox Integration:          COMPLETED & TESTED
- Master Regression Suite:                   885/885 PASSED (100.00%)
================================================================================
```

---

## 3. Authoritative Architecture & Schema Design

```
+-------------------------------------------------------------------------+
|                              MATCH ENTITY                               |
| - _id                                                                   |
| - canonicalPair: "lowerId:higherId"                                     |
| - status: ACTIVE | UNMATCHED | BLOCKED                                  |
| - conversation: ref(Conversation)                                       |
+------------------------------------+------------------------------------+
                                     |
                          1:1 Atomic Association
                                     |
                                     v
+-------------------------------------------------------------------------+
|                          CONVERSATION ENTITY                            |
| - _id: ObjectId                                                         |
| - type: DIRECT_MATCH | GROUP                                            |
| - status: ACTIVE | CLOSED_BY_UNMATCH | CLOSED_BY_BLOCK | CLOSED         |
| - matchId: ref(Match) [unique sparse index: uniq_conv_match_id]         |
| - canonicalParticipantKey: "id1:id2" [unique sparse index: uniq_pair]   |
| - createdBy: ref(User)                                                  |
| - lastSequence: Number (default: 0)                                     |
| - lastMessageId: ref(Message)                                           |
| - lastMessageAt: Date                                                   |
| - memberCount: Number                                                   |
| - closedAt, closedBy, closeReason                                       |
| - schemaVersion: '1.0'                                                  |
+------------------------------------+------------------------------------+
                                     |
                         1:N Membership Relations
                                     |
                                     v
+-------------------------------------------------------------------------+
|                       CONVERSATION_MEMBER ENTITY                        |
| - _id: ObjectId                                                         |
| - conversationId: ref(Conversation) [compound unique with userId]       |
| - userId: ref(User)                                                     |
| - role: OWNER | ADMIN | MEMBER                                          |
| - state: ACTIVE | LEFT | REMOVED | BLOCKED                              |
| - joinedAt, joinedSequence                                              |
| - leftAt, removedAt, removedBy                                          |
| - lastDeliveredSequence: Number (default: 0)                            |
| - lastReadSequence: Number (default: 0)                                 |
| - notificationPreference: ALL | MENTIONS_ONLY | MUTED                   |
+-------------------------------------------------------------------------+
```

### 3.1. Conversation Schema (`backend/models/Conversation.js`)

| Field | Type | Modifiers / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Primary Key | Canonical conversation identifier |
| `type` | `String` | Enum: `DIRECT_MATCH`, `GROUP` | Conversation archetype |
| `status` | `String` | Enum: `ACTIVE`, `CLOSED_BY_UNMATCH`, `CLOSED_BY_BLOCK`, `CLOSED_BY_SAFETY`, `CLOSED`, `ARCHIVED` | Lifecycle status |
| `matchId` | `ObjectId` | Ref: `'Match'`, unique sparse | Associated dating match |
| `canonicalParticipantKey`| `String` | Unique sparse index | Sorted pair key `lowerUserId:higherUserId` |
| `createdBy` | `ObjectId` | Ref: `'User'` | Creator / Initiator user ID |
| `lastSequence` | `Number` | Default: `0`, Min: `0` | Authoritative sequence watermark for messages |
| `lastMessageId` | `ObjectId` | Ref: `'Message'`, default `null` | Most recent message reference |
| `lastMessageAt` | `Date` | Default: `null` | Timestamp of last message |
| `memberCount` | `Number` | Default: `2`, Min: `1` | Denormalized active member count |
| `closedAt` | `Date` | Optional | Timestamp when conversation was closed |
| `closedBy` | `ObjectId` | Ref: `'User'` | Actor who triggered closure |
| `closeReason` | `String` | Trimmed | Reason for closure (e.g. `USER_UNMATCHED`, `USER_BLOCKED`) |
| `schemaVersion` | `String` | Default: `'1.0'` | Schema version identifier |

### 3.2. Conversation Member Schema (`backend/models/ConversationMember.js`)

| Field | Type | Modifiers / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Primary Key | Membership record ID |
| `conversationId` | `ObjectId` | Ref: `'Conversation'`, Required | Parent conversation reference |
| `userId` | `ObjectId` | Ref: `'User'`, Required | Member user reference |
| `role` | `String` | Enum: `OWNER`, `ADMIN`, `MEMBER` | Member administrative role |
| `state` | `String` | Enum: `ACTIVE`, `LEFT`, `REMOVED`, `BLOCKED` | Member lifecycle state |
| `joinedAt` | `Date` | Default: `Date.now` | Timestamp when user joined conversation |
| `joinedSequence` | `Number` | Default: `0` | Message sequence at time of joining |
| `leftAt` | `Date` | Optional | Timestamp when member voluntarily left |
| `removedAt` | `Date` | Optional | Timestamp when member was removed by admin |
| `removedBy` | `ObjectId` | Ref: `'User'` | Administrator who removed member |
| `lastDeliveredSequence` | `Number` | Default: `0` | Highest message sequence delivered to member's devices |
| `lastReadSequence` | `Number` | Default: `0` | Highest message sequence read by member |
| `notificationPreference`| `String` | Enum: `ALL`, `MENTIONS_ONLY`, `MUTED` | Member-specific push notification setting |

---

## 4. Key Services & Domain Invariants

### 4.1. Direct Match Resolution (`ensureDirectMatchConversation`)

```javascript
// backend/services/conversationService.js
async function ensureDirectMatchConversation({ actorUserId, matchId }) {
  // 1. Verify match existence, actor membership, and ACTIVE status
  // 2. Derive canonical pair key from match.users [lowerId, higherId]
  // 3. Check bilateral blocks between participants
  // 4. Find or atomically create Conversation
  // 5. Ensure both ConversationMember records exist with state = ACTIVE
  // 6. Atomically link match.conversation = conversation._id
  // 7. Emit outbox event conversation.created if newly created
  // 8. Return { conversation, isNew }
}
```

- **Race Condition Immunity**: Database-level unique constraint on `canonicalParticipantKey` paired with deterministic error-handling prevents duplicate conversations under concurrent client requests.
- **Client Non-Arbitrary Rule**: Direct match conversations cannot be created from arbitrary user input; they are strictly derived from validated `Match` documents.

### 4.2. Centralized Conversation Authorization (`authorizeConversationAccess`)

```javascript
// backend/services/conversationAuthorizationService.js
async function authorizeConversationAccess({ actorUserId, conversationId, operation = 'VIEW' }) {
  // 1. Validate actor account status (active, not suspended/banned/deleted)
  // 2. Load ConversationMember (must exist and have state === ACTIVE)
  // 3. Load Conversation (must exist)
  // 4. For active write operations (SEND_MESSAGE, UPDATE_PREFERENCE), conversation.status must be ACTIVE
  // 5. For DIRECT_MATCH conversations, verify Match is ACTIVE and no Block exists
  // 6. For administrative operations (MANAGE_MEMBERS), verify role is OWNER or ADMIN
  // 7. Return clean authorization context { authorized: true, conversation, member, otherMemberId, role }
}
```

### 4.3. Lifecycle Transitions (Unmatch & Block Integration)

1. **Unmatch Transition**:
   - `safetyService.unmatchUser` calls `conversationService.closeConversationForUnmatch`.
   - Conversation status transitions to `CLOSED_BY_UNMATCH`.
   - Read operations (`VIEW`, `READ_HISTORY`) remain permitted for historical context.
   - Active write operations (`SEND_MESSAGE`) are immediately rejected with `CONVERSATION_NOT_AVAILABLE` (403).
   - Emits transactional outbox event: `conversation.closed`.
2. **Block Transition**:
   - `safetyService.blockUser` calls `conversationService.closeConversationForBlock`.
   - Conversation status transitions to `CLOSED_BY_BLOCK`.
   - Blocked member's `ConversationMember.state` transitions to `BLOCKED`.
   - Bilateral block checks in `authorizeConversationAccess` reject all subsequent operations from either participant with `USER_BLOCKED` (403).
   - Emits transactional outbox event: `conversation.closed`.

---

## 5. REST API Specifications

### 5.1. `GET /v1/conversations`
Retrieves a paginated list of conversations for the authenticated user.

- **Authentication**: Required (`Bearer <JWT>`)
- **Query Parameters**:
  - `limit` (optional): Bounded between 1 and 50 (default: 20).
  - `cursor` (optional): HMAC-signed opaque cursor.
  - `status` (optional): Filter by conversation status (default: `ACTIVE`).
  - `type` (optional): Filter by conversation type (`DIRECT_MATCH`, `GROUP`).
- **Response Shape**:
```json
{
  "items": [
    {
      "id": "6a97bc6a2e66423b4f0230b4",
      "type": "DIRECT_MATCH",
      "status": "ACTIVE",
      "isGroup": false,
      "groupName": "",
      "groupAvatar": "",
      "otherParticipant": {
        "userId": "6a97bc6a2e66423b4f0230a2",
        "displayName": "Diya Sharma",
        "avatarUri": "https://cdn.rubaru.app/photos/diya_1.jpg",
        "age": 25,
        "isVerified": true
      },
      "memberCount": 2,
      "lastSequence": 0,
      "lastMessageAt": "2026-09-02T06:05:32.000Z",
      "myMembership": {
        "role": "MEMBER",
        "state": "ACTIVE",
        "joinedAt": "2026-09-02T06:05:32.000Z",
        "lastReadSequence": 0,
        "lastDeliveredSequence": 0,
        "notificationPreference": "ALL"
      },
      "updatedAt": "2026-09-02T06:05:32.000Z"
    }
  ],
  "nextCursor": "cur_c_eyJ1c2VySWQiOiI2YTk3YmM..._signature",
  "hasMore": false
}
```

### 5.2. `GET /v1/conversations/:conversationId`
Retrieves metadata and member summary for a single conversation.

- **Authentication**: Required (`Bearer <JWT>`)
- **Authorization**: Must be an active member of the conversation.
- **Security Protections**: Non-members receive `403 Forbidden` (`MEMBERSHIP_REQUIRED`) without metadata leakage.

### 5.3. `POST /v1/conversations/ensure-direct`
Idempotently opens or resolves a direct conversation for an active match.

- **Authentication**: Required (`Bearer <JWT>`)
- **Request Body**: `{ "matchId": "6a97bc6a2e66423b4f0230b0" }`
- **Response Codes**: `201 Created` (if newly opened) or `200 OK` (if already existing).

---

## 6. Master Test Runner Execution & Verification Matrix

The complete test runner (`npm test`) executed all 28 test suites covering Research 1, Research 2, and Research 3.

```text
================================================================================
                         EXACT ARITHMETIC BREAKDOWN                              
================================================================================
┌─────────┬──────────────────────────────────────────────────┬────────┬────────┬───────────┬────────┐
│ (index) │ file                                             │ passed │ failed │ elapsedMs │ status │
├─────────┼──────────────────────────────────────────────────┼────────┼────────┼───────────┼────────┤
│ 0       │ 'test/model_level_tests.js'                      │ 18     │ 0      │ 2118      │ 'PASS' │
│ 1       │ 'test/preference_tests.js'                       │ 28     │ 0      │ 3709      │ 'PASS' │
│ 2       │ 'test/location_tests.js'                         │ 31     │ 0      │ 4589      │ 'PASS' │
│ 3       │ 'test/eligibility_tests.js'                      │ 25     │ 0      │ 3804      │ 'PASS' │
│ 4       │ 'test/discovery_tests.js'                        │ 29     │ 0      │ 4289      │ 'PASS' │
│ 5       │ 'test/impression_tests.js'                       │ 16     │ 0      │ 4527      │ 'PASS' │
│ 6       │ 'test/pass_undo_tests.js'                        │ 27     │ 0      │ 5250      │ 'PASS' │
│ 7       │ 'test/like_tests.js'                             │ 28     │ 0      │ 8311      │ 'PASS' │
│ 8       │ 'test/incoming_likes_tests.js'                   │ 36     │ 0      │ 3895      │ 'PASS' │
│ 9       │ 'test/match_tests.js'                            │ 27     │ 0      │ 6816      │ 'PASS' │
│ 10      │ 'test/matches_list_authorization_tests.js'       │ 30     │ 0      │ 4781      │ 'PASS' │
│ 11      │ 'test/safety_tests.js'                           │ 30     │ 0      │ 7009      │ 'PASS' │
│ 12      │ 'test/frontend_dating_integration_tests.js'      │ 23     │ 0      │ 7073      │ 'PASS' │
│ 13      │ 'test/concurrency_security_audit_tests.js'       │ 12     │ 0      │ 4497      │ 'PASS' │
│ 14      │ 'test/media_foundation_tests.js'                 │ 33     │ 0      │ 3122      │ 'PASS' │
│ 15      │ 'test/follow_graph_tests.js'                     │ 42     │ 0      │ 6498      │ 'PASS' │
│ 16      │ 'test/post_lifecycle_tests.js'                   │ 40     │ 0      │ 6357      │ 'PASS' │
│ 17      │ 'test/content_visibility_authorization_tests.js' │ 24     │ 0      │ 5374      │ 'PASS' │
│ 18      │ 'test/social_interaction_tests.js'               │ 50     │ 0      │ 8241      │ 'PASS' │
│ 19      │ 'test/connected_feed_tests.js'                   │ 44     │ 0      │ 5882      │ 'PASS' │
│ 20      │ 'test/feed_impression_tests.js'                  │ 31     │ 0      │ 3700      │ 'PASS' │
│ 21      │ 'test/story_lifecycle_tests.js'                  │ 37     │ 0      │ 5744      │ 'PASS' │
│ 22      │ 'test/reel_playback_tests.js'                    │ 36     │ 0      │ 5331      │ 'PASS' │
│ 23      │ 'test/social_safety_moderation_tests.js'         │ 41     │ 0      │ 7030      │ 'PASS' │
│ 24      │ 'test/social_notification_tests.js'              │ 48     │ 0      │ 5787      │ 'PASS' │
│ 25      │ 'test/frontend_social_integration_tests.js'      │ 41     │ 0      │ 9866      │ 'PASS' │
│ 26      │ 'test/conversation_foundation_tests.js'          │ 45     │ 0      │ 6536      │ 'PASS' │
│ 27      │ 'test_all_endpoints.js'                          │ 13     │ 0      │ 4736      │ 'PASS' │
└─────────┴──────────────────────────────────────────────────┴────────┴────────┴───────────┴────────┘

GRAND TOTAL ASSERTIONS EXECUTED: 885
TOTAL PASSED: 885
TOTAL FAILED: 0
SUCCESS RATE: 100.00%
================================================================================
```

---

## 7. Migration & Legacy Compatibility Summary

1. **Model Aliasing**: `backend/models/Chat.js` forwards directly to `backend/models/Conversation.js`. Legacy code requiring `Chat` operates seamlessly on the upgraded schema.
2. **Flexible Populate Resolution**: `ConversationMember` supports both `conversationId` and `conversation` aliases, ensuring backward-compatible population across queries.
3. **Outbox Compatibility**: Added `'CONVERSATION'` and `'MESSAGE'` to `aggregateType` in `OutboxEvent.js`.
4. **Zero Frontend Regressions**: All frontend dating and social integration tests remain 100% operational.

---

## 8. Next Step

With Step R3-02 verified and complete, the codebase is fully prepared for **Research 3 — Step R3-03: Real-Time Message Pipeline & Socket Delivery**.
