# Research 1: Prompt 3 — Dating Preferences Implementation Report

> **Document Version**: 1.0.0  
> **Status**: COMPLETED & VERIFIED  
> **Author**: Senior Backend Engineer  
> **Target Scope**: Authenticated Dating Preferences Backend (`GET /v1/dating/preferences`, `PATCH /v1/dating/preferences`, Versioning, Dealbreakers, and Validation)  
> **Date**: 1 September 2026  

---

## 1. Summary

In accordance with **Research 1: Dating Discovery, Likes & Mutual Matching** and the approved **Implementation Blueprint**, the authenticated **Dating Preferences** backend service and REST endpoints have been implemented.

Key deliverables completed:
* **Centralized Configuration**: Created `backend/config/datingConfig.js` establishing age bounds (18-99), distance limits (1-500 km), daily like limits (25), and dealbreaker/flexible field definitions.
* **Preference Domain Service**: Implemented `backend/services/preferenceService.js` handling default initialization (Approach B), partial updates with full-state validation, optimistic concurrency versioning (`expectedVersion`), and outbox event publishing (`preferences.updated`).
* **Authenticated Endpoints**: Implemented `GET /v1/dating/preferences` and `PATCH /v1/dating/preferences` (also mounted on `/api/v1/dating/preferences`) in `backend/controllers/preferenceController.js` and `backend/routes/datingRoutes.js`.
* **Privacy & Isolation**: Private dating preferences are decoupled from public profile models and return a standardized owner DTO with zero database internal leakages.
* **Automated Integration & Service Tests**: Implemented `backend/test/preference_tests.js` executing 28 test assertions with a **100% pass rate**.

---

## 2. Existing Frontend Fields Audited

From inspecting `src/components/common/DiscoverFiltersModal.js` and onboarding screens:

| Frontend Field | Frontend Type | Backend Field | Validation Rules | Strict / Flexible | Premium Restricted |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `lookingFor` | String (`'Men'`, `'Women'`, `'Everyone'`) | `genderPreference` | Array of `['Female', 'Male', 'Non-Binary', 'Other']` | **Strict Only** | No |
| `minAge`, `maxAge` | Integers (18 to 60+) | `ageRange.min`, `ageRange.max` | Integers between 18 and 99; `min <= max` | Flexible or Dealbreaker | No |
| `distance` | String/Number (`"25 km"`, `50`) | `maxDistanceKm` | Numeric between 1 and 500 km | Flexible or Dealbreaker | No |
| `relationship` | String (e.g. `'Relationship'`, `'Friendship'`) | `intentions` | Array of `DatingIntentions` enums | Flexible or Dealbreaker | No |
| `interests` | Array of strings (e.g. `['Music', 'Travel']`) | `dealbreakerInterests`| Max 20 unique strings | Flexible or Dealbreaker | No |
| `profileType` | String (`'all'`, `'verified'`) | `showOnlyVerified` | Boolean | Dealbreaker | Configurable |

---

## 3. Final Canonical Preference Contract

```json
{
  "success": true,
  "data": {
    "preferences": {
      "preferredGenders": ["Female", "Male", "Non-Binary", "Other"],
      "minimumAge": 21,
      "maximumAge": 35,
      "maximumDistance": 50,
      "datingIntentions": ["NOT_SURE"],
      "dealbreakers": {
        "gender": true,
        "age": true,
        "distance": true,
        "intentions": false
      },
      "dealbreakerInterests": [],
      "showOnlyVerified": false,
      "version": 1,
      "updatedAt": "2026-09-01T12:00:00.000Z"
    },
    "isComplete": true
  }
}
```

---

## 4. Models and Services Reused

* **`DatingPreference.js`**: Reused the Mongoose model created in Prompt 2.
* **`User.js`**: Reused for active account verification and JWT payload extraction.
* **`OutboxEvent.js`**: Reused to record `preferences.updated` events for future background cache invalidation.
* **`enums.js`**: Reused `Genders` and `DatingIntentions`.
* **`auth.js` Middleware**: Reused `protect` JWT Bearer token authentication middleware.

---

## 5. Files Created

1. `backend/config/datingConfig.js`: Centralized dating constraints and weight configuration.
2. `backend/services/preferenceService.js`: Business logic for preferences retrieval, validation, merging, and versioning.
3. `backend/controllers/preferenceController.js`: HTTP request handlers for preferences.
4. `backend/routes/datingRoutes.js`: Express router mounting `/preferences` with authentication.
5. `backend/test/preference_tests.js`: 28-assertion test suite.
6. `docs/backend/RESEARCH_1_PROMPT_3_PREFERENCES_IMPLEMENTATION.md`: Implementation report.

---

## 6. Files Modified

* `backend/index.js`: Mounted `datingRoutes` at `/v1/dating` and `/api/v1/dating`.

---

## 7. Final API Endpoints

* **`GET /v1/dating/preferences`** (and `/api/v1/dating/preferences`): Retrieves authenticated user's dating preferences.
* **`PATCH /v1/dating/preferences`** (and `/api/v1/dating/preferences`): Partially updates authenticated user's dating preferences with optimistic concurrency versioning.

---

## 8. Request and Response Contracts

### 8.1 `GET /v1/dating/preferences`
* **Headers**: `Authorization: Bearer <token>`
* **Status**: `200 OK`
* **Body**:
```json
{
  "success": true,
  "data": {
    "preferences": {
      "preferredGenders": ["Female", "Male"],
      "minimumAge": 22,
      "maximumAge": 30,
      "maximumDistance": 40,
      "datingIntentions": ["LONG_TERM"],
      "dealbreakers": {
        "gender": true,
        "age": true,
        "distance": true,
        "intentions": false
      },
      "dealbreakerInterests": [],
      "showOnlyVerified": false,
      "version": 2,
      "updatedAt": "2026-09-01T12:30:00.000Z"
    },
    "isComplete": true
  }
}
```

### 8.2 `PATCH /v1/dating/preferences`
* **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Body** (all fields optional for partial update):
```json
{
  "preferredGenders": ["Female"],
  "minimumAge": 23,
  "maximumAge": 32,
  "maximumDistance": 45,
  "datingIntentions": ["LONG_TERM", "LONG_TERM_OPEN_TO_SHORT"],
  "dealbreakers": {
    "age": true,
    "distance": false
  },
  "dealbreakerInterests": ["Travel", "Coffee"],
  "showOnlyVerified": false,
  "expectedVersion": 2
}
```
* **Status**: `200 OK`
* **Response Body**: Returns updated owner DTO with incremented `version: 3`.

---

## 9. Initialization Behaviour

* **Approach Used**: **Approach B (First GET initializes approved defaults)**.
* When a newly registered or migrated user calls `GET /v1/dating/preferences` and no `DatingPreference` document exists, the service initializes default preferences (`all genders`, `21-35 age range`, `50 km max distance`, `dealbreakers: gender=true, age=true, distance=true`, `version: 1`) and returns them.

---

## 10. Validation Rules

1. **Age Validation**:
   - `minimumAge` and `maximumAge` must be integers between 18 and 99.
   - Merged result enforces `minimumAge <= maximumAge`.
2. **Distance Validation**:
   - Numeric value between 1 and 500 km.
   - Normalizes frontend string distances (e.g. `"25 km"` -> `25`).
3. **Gender Validation**:
   - Must be non-empty array containing only approved `Genders` (`'Female'`, `'Male'`, `'Non-Binary'`, `'Other'`).
4. **Intention Validation**:
   - Array containing approved `DatingIntentions` (`'LONG_TERM'`, `'SHORT_TERM'`, `'LONG_TERM_OPEN_TO_SHORT'`, `'CASUAL'`, `'FRIENDSHIP'`, `'NOT_SURE'`).
5. **Dealbreaker Validation**:
   - Booleans for supported keys (`gender`, `age`, `distance`, `intentions`). `gender` is strictly immutable as `true`.

---

## 11. Strict versus Flexible Behaviour

* **Gender Preference**: Strictly enforced as a dealbreaker (`dealbreakers.gender = true`). In discovery, candidates whose gender does not match the viewer's preference (or whose preference does not match the viewer's gender) are dropped immediately.
* **Age, Distance, Intentions**: Can be toggled between hard dealbreaker exclusions (`isDealbreaker = true`) and soft ranking weights (`isDealbreaker = false`).

---

## 12. Dealbreaker Behaviour

When a dealbreaker is active:
* **Age Dealbreaker**: Dropped if candidate age is outside `[min, max]`.
* **Distance Dealbreaker**: Dropped if candidate distance exceeds `maxDistanceKm`.
* **Intentions Dealbreaker**: Dropped if candidate intention does not overlap with viewer intentions.

---

## 13. Premium-Filter Handling

* Future premium filters (such as `showOnlyVerified` or advanced lifestyle filters) are validated against `UserEntitlement` on the server.
* Client-supplied entitlement claims are rejected.

---

## 14. Preference-Version Strategy

* Preferences start at `version: 1`.
* Every successful, meaningful PATCH increments `version = version + 1`.
* No-op updates (where submitted fields match existing stored values) do not increment the version.
* If a client passes `expectedVersion` and it does not match the current database version, the update is rejected with `HTTP 409 Conflict` (`PREFERENCE_VERSION_CONFLICT`).

---

## 15. Authorization and Privacy Controls

* **Actor Derivation**: Derived strictly from `req.user._id` (JWT session).
* **Owner Isolation**: Users can only query and mutate their own preferences.
* **Public Profile Privacy**: Private preferences (`genderPreference`, `ageRange`, `maxDistanceKm`, `dealbreakers`) are never returned by public profile or discovery endpoints.

---

## 16. Rate Limits

* Rate limiting will be applied across preference endpoints (10 updates per minute per user).

---

## 17. Error Codes

| Error Code | HTTP Status | Meaning |
| :--- | :---: | :--- |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid Bearer token |
| `ACCOUNT_NOT_ACTIVE` | 403 | User account is suspended, banned, or deleted |
| `INVALID_AGE_RANGE` | 400 | Age out of bounds (18-99) or `minAge > maxAge` |
| `INVALID_DISTANCE` | 400 | Distance out of bounds (1-500 km) |
| `INVALID_PREFERENCE_VALUE` | 400 | Unknown gender/intention enum or empty gender array |
| `PREFERENCE_VERSION_CONFLICT` | 409 | Version mismatch (`expectedVersion` != stored version) |

---

## 18. Tests Added

File: [`backend/test/preference_tests.js`](file:///r:/Rubaru/backend/test/preference_tests.js)

### Assertions Tested (28 Tests):
* **Service Unit Tests (14 Tests)**:
  - Initial `getPreferences` returns version 1 defaults.
  - Initial `minimumAge` (21), `maximumAge` (35), and `gender` dealbreaker (true).
  - Valid partial update increments version to 2.
  - Partial update updates minimum age (23), maximum age (32), and distance (40 km).
  - No-op update retains version 2 without increment.
  - Invalid age range (`min > max`) throws `INVALID_AGE_RANGE`.
  - Invalid distance (`> 500 km`) throws `INVALID_DISTANCE`.
  - Invalid gender enum throws `INVALID_PREFERENCE_VALUE`.
  - Stale `expectedVersion` throws `PREFERENCE_VERSION_CONFLICT` (HTTP 409).
* **HTTP REST API Tests (14 Tests)**:
  - Unauthenticated `GET /v1/dating/preferences` returns 401.
  - Unauthenticated `PATCH /v1/dating/preferences` returns 401.
  - Authenticated `GET /v1/dating/preferences` returns 200 OK with success envelope.
  - Database internal fields (`_id`, `__v`) stripped from DTO.
  - Authenticated `PATCH /v1/dating/preferences` increments version from 2 to 3.
  - Normalized string `"30 km"` to integer 30.
  - Dealbreaker distance update verified.
  - Invalid age range returns 400 Bad Request with error code.
  - Version mismatch in PATCH returns 409 Conflict with `PREFERENCE_VERSION_CONFLICT`.

---

## 19. Verification Results

```
===========================================================
      RUBARU DATING PREFERENCES INTEGRATION TEST SUITE     
===========================================================
MongoDB Connected: ac-4yhspek-shard-00-02.1meot8l.mongodb.net

--- 1. Preference Service Tests ---
✅ [PASS] Initial getPreferences returns version 1 defaults
✅ [PASS] Initial minimumAge is 21
✅ [PASS] Initial maximumAge is 35
✅ [PASS] Gender preference dealbreaker is true
✅ [PASS] Meaningful partial update increments version to 2
✅ [PASS] Minimum age successfully updated to 23
✅ [PASS] Maximum age successfully updated to 32
✅ [PASS] Maximum distance successfully updated to 40 km
✅ [PASS] No-op update retains version 2 without unnecessary increment
✅ [PASS] Invalid age range (min > max) throws INVALID_AGE_RANGE
✅ [PASS] Invalid distance (> 500 km) throws INVALID_DISTANCE
✅ [PASS] Invalid gender enum throws INVALID_PREFERENCE_VALUE
✅ [PASS] Stale expectedVersion throws PREFERENCE_VERSION_CONFLICT (409)
✅ [PASS] Conflict returns HTTP 409 status code

--- 2. HTTP REST API Endpoint Tests ---
✅ [PASS] Unauthenticated GET /v1/dating/preferences returns 401
✅ [PASS] Unauthenticated PATCH /v1/dating/preferences returns 401
✅ [PASS] Authenticated GET /v1/dating/preferences returns 200 OK
✅ [PASS] Response contains success: true envelope
✅ [PASS] Response returns current version 2
✅ [PASS] Database internal _id is excluded from DTO
✅ [PASS] Authenticated PATCH /v1/dating/preferences returns 200 OK
✅ [PASS] PATCH increments version from 2 to 3
✅ [PASS] Normalized "30 km" string to 30 integer
✅ [PASS] Updated dealbreaker distance to false
✅ [PASS] Invalid age range in PATCH returns 400 Bad Request
✅ [PASS] Error response returns code INVALID_AGE_RANGE
✅ [PASS] Version mismatch in PATCH returns 409 Conflict
✅ [PASS] Error response returns code PREFERENCE_VERSION_CONFLICT

===========================================================
PREFERENCE TESTS COMPLETED: 28 PASSED, 0 FAILED
===========================================================
```

Baseline API regression test:
```
====================================================
RESULTS: 13 PASSED, 0 FAILED
====================================================
```

---

## 20. Unresolved Decisions

* **Ethnicity / Religion / Astrological Filters**: Not confirmed by current UI; excluded from MVP.
* **Premium Entitlement Quotas for Custom Filters**: Deferred to future monetization prompt.

---

## 21. Deferred Work

* **Prompt 4**: Protected Location Service & Privacy Masking (`PUT /v1/dating/location`).
* **Prompt 5**: Mutual Bilateral Eligibility Policy & Geospatial Candidate Retrieval.
* **Prompt 6**: Candidate Scoring, Recommendation Batches & Impression Tracking.
* **Prompt 7**: Interaction APIs (Like, Pass, Undo, Roses).

---

## 22. Rollback Instructions

If rollback of Prompt 3 is required:
1. Revert `backend/index.js` route mounting for `datingRoutes`.
2. Remove `backend/routes/datingRoutes.js`, `backend/controllers/preferenceController.js`, `backend/services/preferenceService.js`, `backend/config/datingConfig.js`, `backend/test/preference_tests.js`.

---

## 23. Readiness for Prompt 4

* **Status**: **READY FOR PROMPT 4 (Protected Location Service & Privacy Firewall)**.
* Dating Preferences API, DTOs, versioning, dealbreakers, and validation are verified and stable.

---

*End of Implementation Report.*
