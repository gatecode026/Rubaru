# Research 3 — Prompt R3-09: Reactions, Replies, and In-Chat Polls

**Status**: COMPLETED  
**Version**: 1.0.0  
**Phase**: R3-09  
**Final Decision**: `READY_FOR_R3_10`

---

## 1. Executive Summary

Rubaru Research 3 Phase 9 (R3-09) implements high-fidelity, durable interactive messaging features:
1. **Durable Message Reactions**: Separate `MessageReaction` collection with compound uniqueness `{ messageId: 1, userId: 1 }`, bounded canonical reaction vocabulary, atomic increment/decrement of materialized `reactionSummary` on `Message`, and transactional outbox event emission (`message.reaction.updated`).
2. **Secure Quoted-Message Replies**: Monotonic sequence-backed reply references (`replyToMessageId`, `replyToSequence`), strict same-conversation authorization, derived safe reply previews without client spoofing, and complete content redaction upon tombstone/unsend.
3. **Transactional In-Chat Polls**: Durable `Poll` and `PollVote` collections with server-generated option IDs (`opt_1_...`), single/multi-select vote constraints, atomic voter counting, manual closing & automatic expiration, and transactional outbox events (`poll.vote.updated`, `poll.closed`).
4. **Offline Synchronization & Zero N+1 Queries**: Bulk resolution of reply previews, poll states, and user reaction states within `syncConversationMessages`.
5. **Unified Transport Integration**: Parity across REST endpoints and Socket.io commands using shared services with post-commit client ACKs.

---

## 2. Requirement Traceability Matrix

| Requirement ID | Description | Component / Implementation | Test Coverage |
| :--- | :--- | :--- | :--- |
| **R3-09-REQ-001** | Durable message-reaction model | `backend/models/MessageReaction.js` with `{ messageId: 1, userId: 1 }` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-002** | Bounded canonical reaction set | `backend/config/interactionConfig.js`, `backend/models/enums.js` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-003** | Add, change and remove reaction service | `backend/services/reactionService.js` (`addOrUpdateReaction`, `removeReaction`) | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-004** | Reaction summary without unbounded arrays | `Message.reactionSummary` (`version`, `total`, `counts`) | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-005** | Reaction idempotency | Idempotent set and remove handling in `reactionService.js` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-006** | Reaction transactional outbox events | `message.reaction.updated` Outbox event with payload versioning | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-007** | Secure reply-to message reference | `replyToMessageId`, `replyToSequence` on `Message` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-008** | Same-conversation reply authorization | Cross-conversation and missing target validation in `messageService.js` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-009** | Safe reply preview | `formatReplyPreview` with text truncation (120 chars) and sanitization | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-010** | Reply tombstone and unsend compatibility | Redacted `isUnavailable: true` preview for unsent/deleted messages | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-011** | Reply creation through R3-03 message service | Integrated `replyToMessageId` in `sendMessage` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-012** | Durable in-chat poll model | `backend/models/Poll.js` (`question`, `options`, `status`, `totalVoters`) | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-013** | Server-generated poll option IDs | Options validation & crypto-randomized prefix IDs (`opt_1_...`) | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-014** | Poll creation through message transaction | `type: 'POLL'` handling in `messageService.js` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-015** | Durable poll-vote model | `backend/models/PollVote.js` with `{ pollId: 1, userId: 1 }` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-016** | Atomic vote and selection changes | `votePoll`, `removePollVote` with single/multi-select bounds | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-017** | Poll closing and expiry | `closePoll` with creator-only authorization & expiry enforcement | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-018** | Poll result consistency | `formatPollDto` with `currentUserOptionIds` and non-negative counts | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-019** | Poll transactional outbox events | `poll.vote.updated` and `poll.closed` Outbox events | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-020** | REST interaction contracts | `reactionController.js` and `pollController.js` routes | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-021** | Socket.io interaction contracts | Handlers for `message.reaction.set`, `poll.vote.set`, etc. | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-022** | Service reuse across REST and Sockets | Socket handlers delegate directly to `reactionService` / `pollService` | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-023** | Offline synchronization compatibility | Bulk resolution of reply previews, polls, and user reactions in sync | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-024** | Authorization, blocking and revocation | Access checks via `authorizeConversationAccess` (blocks/unmatches) | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-025** | Central validation and safe errors | Standardized error codes across all interaction paths | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-026** | Abuse prevention and rate limiting | Central `interactionConfig.js` limits and socket rate limiting | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-027** | Security and privacy tests | Authorization, non-member rejection, and redaction tests | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-028** | Concurrency and transaction tests | Concurrent reaction and vote mutation tests with 0 data drift | `reaction_reply_poll_tests.js` |
| **R3-09-REQ-029** | Research regression protection | All 34 master test suites executed across R1, R2, R3 | `run_all_tests.js` |
| **R3-09-REQ-030** | Documentation and readiness decision | This document with conclusive `READY_FOR_R3_10` | Full phase sign-off |

---

## 3. Data Models and Schema Architecture

### 3.1 `MessageReaction` Collection
```javascript
{
  conversationId: ObjectId, // indexed
  messageId: ObjectId,      // indexed
  userId: ObjectId,         // indexed
  reaction: String,         // enum: LIKE, LOVE, LAUGH, SURPRISED, SAD, ANGRY, FIRE, 100
  createdAt: Date,
  updatedAt: Date
}
// Unique compound index:
{ messageId: 1, userId: 1 } (uniq_message_user_reaction)
```

### 3.2 `Poll` Collection
```javascript
{
  conversationId: ObjectId,
  messageId: ObjectId,       // unique
  createdByUserId: ObjectId,
  question: String,          // max 250 chars
  options: [{
    optionId: String,        // e.g. "opt_1_a3f8c1"
    text: String,            // max 100 chars
    order: Number,
    voteCount: Number        // min 0
  }],
  allowMultiple: Boolean,
  maxSelections: Number,     // default 1
  status: String,            // OPEN, CLOSED, EXPIRED
  closesAt: Date,
  closedAt: Date,
  closedByUserId: ObjectId,
  version: Number,           // monotonic increment
  totalVoters: Number,       // min 0
  createdAt: Date,
  updatedAt: Date
}
```

### 3.3 `PollVote` Collection
```javascript
{
  pollId: ObjectId,         // indexed
  conversationId: ObjectId,
  userId: ObjectId,         // indexed
  optionIds: [String],      // selected option IDs
  createdAt: Date,
  updatedAt: Date
}
// Unique compound index:
{ pollId: 1, userId: 1 } (uniq_poll_user_vote)
```

### 3.4 `Message` Schema Additions
```javascript
{
  // ... existing fields ...
  replyToMessageId: ObjectId,
  replyToSequence: Number,
  pollId: ObjectId,
  reactionSummary: {
    version: Number,
    total: Number,
    counts: Map<String, Number> // e.g. { LIKE: 1, LOVE: 2 }
  }
}
```

---

## 4. REST and Socket.io API Specifications

### 4.1 REST Endpoints
- `PUT /v1/conversations/:conversationId/messages/:messageId/reaction` — Add or replace reaction.
- `DELETE /v1/conversations/:conversationId/messages/:messageId/reaction` — Remove reaction.
- `GET /v1/conversations/:conversationId/messages/:messageId/reactions` — Paginated reactor list.
- `POST /v1/conversations/:conversationId/messages` — Send message with optional `replyToMessageId` or `poll` descriptor.
- `PUT /v1/conversations/:conversationId/polls/:pollId/vote` — Submit or update poll vote.
- `DELETE /v1/conversations/:conversationId/polls/:pollId/vote` — Remove poll vote.
- `POST /v1/conversations/:conversationId/polls/:pollId/close` — Close poll (creator-only).
- `GET /v1/conversations/:conversationId/polls/:pollId` — Get poll detail with user vote state.

### 4.2 Socket.io Events
- **Client Commands**:
  - `message.reaction.set` -> ACK `{ ok: true, code: 'REACTION_ACCEPTED', data: { reaction, summary } }`
  - `message.reaction.remove` -> ACK `{ ok: true, code: 'REACTION_REMOVED', data: { summary } }`
  - `poll.vote.set` -> ACK `{ ok: true, code: 'POLL_VOTE_ACCEPTED', data: { poll } }`
  - `poll.vote.remove` -> ACK `{ ok: true, code: 'POLL_VOTE_REMOVED', data: { poll } }`
  - `poll.close` -> ACK `{ ok: true, code: 'POLL_CLOSED', data: { poll } }`
- **Server Room Broadcasts**:
  - `message.reaction.updated`
  - `poll.vote.updated`
  - `poll.closed`

---

## 5. Verification and Test Results

- **R3-09 Dedicated Test Suite**: [`test/reaction_reply_poll_tests.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/test/reaction_reply_poll_tests.js) — **55/55 assertions passed (100%)**.
- **Full Master Test Runner**: [`test/run_all_tests.js`](file:///c:/Users/Shubh/Desktop/Rubaru/backend/test/run_all_tests.js) — **34 test suites executed, 100% passed, 0 regressions**.

---

## 6. Prerequisite Confirmation and Next Phase Gate

* R3-09 reactions, replies, and in-chat polls are fully implemented and verified.
* All requirements `R3-09-REQ-001` through `R3-09-REQ-030` are satisfied.
* Zero critical or high-severity blockers remain.

```text
READY_FOR_R3_10
```
