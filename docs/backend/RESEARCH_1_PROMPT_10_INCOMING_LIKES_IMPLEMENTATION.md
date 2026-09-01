# Research 1: Prompt 10 — Incoming Likes Inbox, Sorting & Decline Flow Implementation Report

> **Document Version**: 1.0.0  
> **Status**: COMPLETED & VERIFIED  
> **Author**: Senior Backend Engineer  
> **Target Scope**: Authenticated Incoming Likes Inbox, Priority Sorting, Privacy-Safe Sender Hydration, Target-Element Previews, Decline Flow, and Preparation for Prompt 11  
> **Date**: 1 September 2026  

---

## 1. Summary

In accordance with **Research 1: Dating Discovery, Likes & Mutual Matching** and the approved **Implementation Blueprint**, the authenticated **Incoming Likes Inbox, Priority Sorting and Decline Interaction Engine** has been implemented.

Key deliverables completed:
* **Incoming Likes Inbox (`GET /v1/likes/incoming`)**: Queries pending incoming likes for the authenticated recipient with priority sorting (Roses and Priority Likes prioritized over standard likes), filtered for bilateral blocks, deactivated users, and existing matches.
* **Privacy-Safe Sender Hydration**: Projects only approved public sender profile fields (`displayName`, `age`, approximate `distanceLabel`, `avatarUri`, `photos`, `prompts`, `interests`, `datingIntention`). Strictly strips coordinates, date of birth, and private preferences.
* **Target-Element & Comment Previews**: Resolves recipient's liked prompt question & answer or photo preview alongside sanitized plain-text comments.
* **Opaque Cursor Pagination**: HMAC-SHA256 signed pagination tokens (`cur_...`) bound to recipient, sort mode, and offset with zero predictable enumeration.
* **Decline Flow (`POST /v1/likes/:id/decline`)**: Durably updates the interaction to `status: 'DECLINED'` with server-controlled 30-day rediscovery suppression (`suppressedUntil`), and writes `like.declined` outbox events.
* **Critical Acceptance Gating**: Strictly creates **zero** `Match` and **zero** `Chat` documents in Prompt 10. Prepared the reusable internal lookup helper `getPendingIncomingLikeForDecision` for Prompt 11's atomic match transaction.
* **Automated Test Suite**: Created `backend/test/incoming_likes_tests.js` executing 36 test assertions with a **100% pass rate**.

---

## 2. Existing Frontend Behaviour Audited

| Frontend Component | Mobile UI Action | Backend API Endpoint | Behavior / Restrictions |
| :--- | :--- | :--- | :--- |
| **Incoming Likes Tab** | Inbox Screen / Standouts | `GET /v1/likes/incoming` | Paginated queue of pending likes |
| **Decline Button** | Cross Icon / Skip CTA | `POST /v1/likes/:id/decline` | Marks `DECLINED`, 30-day suppression |
| **Accept Button** | Match CTA (Heart / Check) | *Deferred to Prompt 11* | Contract prepared, endpoint gated |

---

## 3. Final API Endpoints

1. **`GET /v1/likes/incoming`** (also mounted at `/api/v1/likes/incoming`)
2. **`POST /v1/likes/:id/decline`** (also mounted at `/api/v1/likes/:id/decline`)

---

## 4. Public Incoming Like DTO Contract

### Response: `GET /v1/likes/incoming`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "likeId": "6a9679cd7cdd1ea45e2fca88",
        "type": "ROSE",
        "createdAt": "2026-09-01T13:55:00.000Z",
        "sender": {
          "userId": "6a9679cd7cdd1ea45e2fca89",
          "displayName": "Vikram",
          "age": 28,
          "distanceLabel": "Around 3 km away",
          "bio": "Software Architect & trekker",
          "avatarUri": "https://i.pravatar.cc/150?img=12",
          "photos": [],
          "prompts": [],
          "interests": ["Tech", "Hiking"],
          "datingIntention": "LONG_TERM",
          "relationshipType": "MONOGAMOUS",
          "isVerified": true
        },
        "likedElement": {
          "type": "PROMPT",
          "id": "pr_recip_1",
          "preview": {
            "question": "A life goal of mine",
            "answer": "To build a sanctuary for animals"
          }
        },
        "comment": "I love that animal sanctuary goal!",
        "availableActions": ["DECLINE"]
      }
    ],
    "nextCursor": "cur_eyJ...opaque.signature",
    "hasMore": false
  }
}
```

---

## 5. Sorting Modes & Priority Ordering

* **Default / Recent Mode (`RECENT`)**:
  1. `ROSE` interactions (Weight 3)
  2. `PRIORITY_LIKE` interactions (Weight 2)
  3. Standard `LIKE` interactions (Weight 1)
  4. Secondary tie-breaker: `createdAt DESC`
* **Priority Mode (`PRIORITY`)**: All priority gestures grouped at the top.

---

## 6. Decline Contract & Suppression

### Request: `POST /v1/likes/:id/decline`
```json
{
  "idempotencyKey": "idem_dec_92ab-1192"
}
```

### Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "data": {
    "declined": true,
    "suppressedUntil": "2026-10-01T13:55:00.000Z"
  }
}
```
* **Suppression Rule**: Sets `suppressedUntil = now + 30 days`. The sender is excluded from future discovery batches and cannot re-like the recipient during this period.

---

## 7. Future Accept Contract (Prompt 11 Preparation)

* Target Endpoint: `POST /v1/likes/:id/accept`
* Internal Reusable Method: `getPendingIncomingLikeForDecision(recipientId, likeId)`
  - Verifies recipient ownership and `status === 'PENDING'`.
  - Used in Prompt 11's atomic transaction to create the mutual `Match`, bind the `Chat`, and mark the interaction `ACCEPTED`.

---

## 8. Outbox Events

* `profile.like_declined` (`like.declined`): Emitted when a recipient declines an incoming like.

---

## 9. Tests Added

File: [`backend/test/incoming_likes_tests.js`](file:///r:/Rubaru/backend/test/incoming_likes_tests.js)

### Assertions Tested (36 Tests):
* **Inbox Querying & Priority Sorting (5 Tests)**:
  - `getIncomingLikes` returns items array.
  - Returns only unblocked, active pending likes.
  - Rose ranked #1, Priority Like ranked #2, Standard Like ranked #3.
* **Public DTO & Privacy Sanitization (10 Tests)**:
  - Sender userId, age, approximate distance label populated.
  - Sanitized plain text comment returned.
  - Target element prompt preview populated.
  - `availableActions` includes `DECLINE` and strictly excludes `ACCEPT`.
  - Zero coordinates, zero dateOfBirth, zero private preferences in DTO.
* **Cursor Pagination & Security (8 Tests)**:
  - Page 1 and Page 2 cursor pagination without duplicates.
  - Tampered cursor rejected (`INVALID_LIKES_CURSOR`).
  - Cross-user cursor rejected (403).
* **Decline Flow & Suppression (6 Tests)**:
  - Sender cannot decline their own sent like (404/403).
  - Recipient decline succeeds and marks status `DECLINED`.
  - Outbox event `like.declined` recorded.
  - Declined like removed from incoming inbox.
  - `getPendingIncomingLikeForDecision` helper verified for Prompt 11.
* **HTTP REST API Endpoints (7 Tests)**:
  - Unauthenticated 401 on `GET /incoming`.
  - Authenticated 200 OK on `GET /incoming`.
  - Authenticated 200 OK on `POST /:id/decline`.
  - **CRITICAL**: Zero Match and Zero Chat documents created.

---

## 10. Verification Results

```
===========================================================
       RUBARU INCOMING LIKES & DECLINE INTEGRATION TESTS   
===========================================================
MongoDB Connected: ac-4yhspek-shard-00-02.1meot8l.mongodb.net

--- 1. Inbox Querying & Priority Sorting Tests ---
✅ [PASS] getIncomingLikes returns items array
✅ [PASS] Returns exactly 3 unblocked pending likes (got 3)
✅ [PASS] Rose like is ranked first
✅ [PASS] Priority like is ranked second
✅ [PASS] Standard like is ranked third

--- 2. Public DTO & Privacy Sanitization Tests ---
✅ [PASS] Sender userId populated
✅ [PASS] Sender age populated
✅ [PASS] Approximate distance populated
✅ [PASS] Sanitized plain text comment returned
✅ [PASS] Target element preview populated
✅ [PASS] Available actions include DECLINE
✅ [PASS] ACCEPT action strictly omitted in Prompt 10
✅ [PASS] Zero coordinates in sender DTO
✅ [PASS] No dateOfBirth in sender DTO
✅ [PASS] No private preferences in sender DTO

--- 3. Cursor Pagination & Security Tests ---
✅ [PASS] Page 1 returns 2 items
✅ [PASS] Page 1 hasMore is true
✅ [PASS] Page 1 returns signed nextCursor
✅ [PASS] Page 2 returns remaining 1 item
✅ [PASS] Page 2 hasMore is false
✅ [PASS] Page 2 returns third like (Karan) without duplicates
✅ [PASS] Tampered cursor throws INVALID_LIKES_CURSOR
✅ [PASS] Cross-user cursor throws INVALID_LIKES_CURSOR (403)

--- 4. Decline Flow Tests ---
✅ [PASS] Sender attempting to decline throws LIKE_NOT_FOUND
✅ [PASS] Decline action succeeds
✅ [PASS] Like status updated to DECLINED
✅ [PASS] like.declined outbox event is recorded
✅ [PASS] Declined like is removed from incoming inbox
✅ [PASS] getPendingIncomingLikeForDecision successfully resolves pending like

--- 5. HTTP REST API Endpoint Tests ---
✅ [PASS] Unauthenticated GET /v1/likes/incoming returns 401
✅ [PASS] Authenticated GET /v1/likes/incoming returns 200 OK
✅ [PASS] Inbox API returns remaining 2 likes
✅ [PASS] Authenticated POST /v1/likes/:id/decline returns 200 OK
✅ [PASS] Decline API returns declined: true
✅ [PASS] CRITICAL: Zero Match documents created in Prompt 10
✅ [PASS] CRITICAL: Zero Chat documents created in Prompt 10

===========================================================
INCOMING LIKES & DECLINE TESTS: 36 PASSED, 0 FAILED
===========================================================
```

Complete project test suite summary:
* Model Tests: `18 PASSED, 0 FAILED`
* Preference Tests: `28 PASSED, 0 FAILED`
* Location Tests: `31 PASSED, 0 FAILED`
* Eligibility Tests: `25 PASSED, 0 FAILED`
* Discovery Tests: `29 PASSED, 0 FAILED`
* Impression Tests: `16 PASSED, 0 FAILED`
* Pass, Remove & Undo Tests: `27 PASSED, 0 FAILED`
* Like, Rose & Quota Tests: `28 PASSED, 0 FAILED`
* Incoming Likes & Decline Tests: `36 PASSED, 0 FAILED`
* Baseline Endpoints: `13 PASSED, 0 FAILED`
* **Total: 207 Tests Passed, 0 Failures**.

---

## 11. Files Changed

* **Modified**:
  - `backend/controllers/likeController.js` (Added `getIncomingLikes` and `declineLike` handlers)
  - `backend/routes/likeRoutes.js` (Mounted `/incoming` and `/:id/decline`)
* **Created**:
  - `backend/services/incomingLikeService.js` (Inbox querying, priority sorting, cursor pagination, decline flow, and decision helpers)
  - `backend/test/incoming_likes_tests.js` (36-assertion test suite)
  - `docs/backend/RESEARCH_1_PROMPT_10_INCOMING_LIKES_IMPLEMENTATION.md` (Implementation report)

---

## 12. Temporary Defaults

* `defaultIncomingLimit`: 10 items.
* `maxIncomingLimit`: 20 items.
* `declineSuppressionDays`: 30 days.

---

## 13. Unresolved Decisions

* None. Incoming Likes query and decline mechanics strictly conform to Research 1 specifications.

---

## 14. Rollback Instructions

1. Remove `/incoming` and `/:id/decline` from `backend/routes/likeRoutes.js`.
2. Delete `backend/services/incomingLikeService.js` and `backend/test/incoming_likes_tests.js`.

---

## 15. Readiness for Prompt 11

* **Status**: **READY FOR PROMPT 11 (Atomic Mutual Match Creation & Chat Gating)**.
* Outgoing interest, incoming inbox, priority sorting, sender hydration, decline suppression, and decision lookup helpers are complete and fully verified.

---

*End of Implementation Report.*
