# Research 1: Prompt 4 — Protected User Location & Geospatial Implementation Report

> **Document Version**: 1.0.0  
> **Status**: COMPLETED & VERIFIED  
> **Author**: Senior Backend Engineer  
> **Target Scope**: Protected User Location Service, 2dsphere Geospatial Index, Haversine Distance Engine, Privacy Masking, and `PUT /v1/dating/location`  
> **Date**: 1 September 2026  

---

## 1. Summary

In accordance with **Research 1: Dating Discovery, Likes & Mutual Matching** and the approved **Implementation Blueprint**, the protected location service and geospatial backend foundation have been implemented.

Key deliverables completed:
* **Strict Privacy Firewall**: User coordinates are stored exclusively in the protected `UserLocation` document and indexed with MongoDB `2dsphere`. Raw coordinates are **never** returned in API responses, logs, notifications, or public profiles.
* **Server-Side Movement Calculation**: Implemented `calculateHaversineDistance()` in `backend/services/locationService.js` to evaluate accurate movement in meters.
* **Significant Movement Detection**: Configured 500-meter movement threshold in `backend/config/datingConfig.js`. Movements >= 500m increment `locationVersion` and record `location.updated` outbox events for future recommendation cache invalidation.
* **Suspicious Velocity Detection**: Movement speeds exceeding 900 km/h over long distances (> 50 km) flag `suspiciousVelocityFlag` without blocking legitimate users.
* **Internal Geospatial Querying**: Implemented `findNearbyUserIds()` using `$geoNear` / `2dsphere` index, returning approximate distances and user IDs without coordinate leakages.
* **Authenticated Endpoint**: Implemented `PUT /v1/dating/location` (and `/api/v1/dating/location`) with full coordinate and timestamp validation.
* **Automated Test Suite**: Created `backend/test/location_tests.js` executing 31 assertions with a **100% pass rate**.

---

## 2. Existing Location Behaviour Audited

| Location Requirement | Existing File | Current Behaviour | Backend Change Required |
| :--- | :--- | :--- | :--- |
| Coordinate Storage | `backend/models/UserLocation.js` | Protected GeoJSON model | Added `locationVersion` and `lastRequestId` for idempotency |
| Public Profile Projections | `backend/models/DatingProfile.js` | Contains no coordinates | Ensured no coordinates are ever added |
| Discovery Distance Filters | `DiscoverFiltersModal.js` | Frontend specifies "25 km", "50 km" | Backend filters using server-side `$geoNear` radius |
| Distance Display | Frontend Cards | Shows distance labels | Provided server-side `formatDistanceLabel` utility |

---

## 3. Database Geographic Representation

* **Standard**: GeoJSON Point (WGS 84 coordinate system).
* **Format**:
```json
{
  "type": "Point",
  "coordinates": [75.7873, 26.9124] // [longitude, latitude]
}
```
* **Coordinate Ordering**: Strictly `[longitude, latitude]` (MongoDB GeoJSON requirement).

---

## 4. Geospatial Index

* **Index Name**: `location_2dsphere` on `UserLocation.location`.
* **Spherical Calculations**: Enabled via `spherical: true` in `$geoNear` aggregations.

---

## 5. Final Request Contract

### `PUT /v1/dating/location`
* **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Body**:
```json
{
  "latitude": 26.9124,
  "longitude": 75.7873,
  "accuracyMeters": 15,
  "source": "GPS",
  "capturedAt": "2026-09-01T12:00:00.000Z",
  "requestId": "loc_req_uuidv4_123"
}
```

---

## 6. Final Response Contract

* **Status**: `200 OK`
* **Body** (Strictly Privacy-Safe — Zero Coordinates):
```json
{
  "success": true,
  "data": {
    "locationStatus": "CURRENT",
    "updatedAt": "2026-09-01T12:00:01.234Z",
    "isSignificantMovement": true,
    "locationVersion": 2
  }
}
```

---

## 7. Validation Rules

1. **Latitude**: Must be a finite number between `-90` and `90` (inclusive).
2. **Longitude**: Must be a finite number between `-180` and `180` (inclusive).
3. **Accuracy**: Optional numeric value in meters between `0` and `2000m` (`maxAcceptedAccuracyMeters`). Values > 2000m are rejected.
4. **Captured Timestamp**:
   - Clock skew tolerance: Max 60 seconds into the future.
   - Max age tolerance: Max 60 minutes old (`maxCoordinateAgeMinutes`). Older timestamps rejected with `LOCATION_UPDATE_TOO_OLD`.
5. **No Spoofing**: Supplying another user's `userId` in the body is rejected with `HTTP 403 Forbidden` (`UNAUTHORIZED_USER_ID`).

---

## 8. Significant-Movement Logic

* Movement between consecutive updates is calculated using the spherical **Haversine formula**.
* If `distanceMeters >= 500m`:
  - `isSignificantMovement` is marked `true`.
  - `locationVersion` is incremented by 1.
  - A `location.updated` outbox event is logged to trigger cache invalidation for active recommendation batches.

---

## 9. Insignificant-Update Behaviour

* If `distanceMeters < 500m`:
  - `isSignificantMovement` is marked `false`.
  - Coordinates and timestamps are updated, but `locationVersion` is **not** incremented, preventing unnecessary cache invalidation thrashing caused by GPS drift.

---

## 10. Stale-Location Behaviour

* Locations older than 72 hours (`staleLocationThresholdHours`) are considered stale by discovery queries.
* Distance labels fall back to `"Nearby"` if location freshness cannot be guaranteed.

---

## 11. Permission-State Behaviour

* If the user revokes location permissions on their mobile device, the existing last-known protected location is retained until stale, but no new updates are accepted without valid coordinates.

---

## 12. Suspicious-Movement Handling

* Calculated velocity `velocityKmH = (distanceKm) / (timeDiffHours)`.
* If `velocityKmH > 900 km/h` and `distance > 50 km`, the `suspiciousVelocityFlag` is set on the document for security audit without blocking legitimate flight travel.

---

## 13. Idempotency and Concurrency Strategy

* If mobile network retries send the same `requestId`, the service recognizes the duplicate request and returns the previous state without incrementing the location version or re-dispatching outbox events.

---

## 14. Rate-Limit Policy

* Location update rate limit: 20 updates per minute per authenticated user session.

---

## 15. Privacy Controls

1. Exact latitude and longitude are **never** returned by `PUT /v1/dating/location`.
2. Public dating profile endpoints only expose coarse distance labels (e.g. `"Around 5 km away"` or `"Nearby"`).
3. If `hideDistance` is enabled, the distance label defaults to `"Nearby"`.

---

## 16. Logging Redactions

* Exact coordinates are strictly stripped from server logging.
* Logs record only `{ userId, isSignificantMovement, locationVersion }`.

---

## 17. Distance-Label Strategy

```javascript
formatDistanceLabel(distanceKm, hideDistance)
```
* `distanceKm < 1 km` -> `"Less than a kilometer away"`
* `distanceKm <= 5 km` -> `"Around X km away"`
* `distanceKm <= 10 km` -> `"Within 10 km"`
* `distanceKm <= 25 km` -> `"Within 25 km"`
* `distanceKm <= 50 km` -> `"Within 50 km"`
* `hideDistance === true` -> `"Nearby"`

---

## 18. Tests Added

File: [`backend/test/location_tests.js`](file:///r:/Rubaru/backend/test/location_tests.js)

### Assertions Tested (31 Tests):
* **Math & Distance Label Unit Tests (7 Tests)**:
  - Haversine distance accuracy tested between two landmarks.
  - Boundary distance formatting (<1km, 3.2km, 8.5km, 15km, 45km, hideDistance).
* **Location Validation & Service Tests (11 Tests)**:
  - First location update creates record with version 1.
  - Insignificant movement (<500m) retains version 1.
  - Significant movement (>=500m) increments version to 2.
  - Idempotent retry with same `requestId` retains version.
  - Out-of-bounds latitude (>90) throws `INVALID_LATITUDE`.
  - Out-of-bounds longitude (<-180) throws `INVALID_LONGITUDE`.
  - Accuracy > 2000m throws `INVALID_LOCATION_ACCURACY`.
  - Stale timestamp (>60 min) throws `LOCATION_UPDATE_TOO_OLD`.
* **Geospatial Index & Query Tests (4 Tests)**:
  - `$geoNear` query finds User B within 10 km.
  - Tight 1 km query excludes User B (2.5 km away).
  - Query results contain zero raw coordinates.
* **HTTP REST API Tests (9 Tests)**:
  - Unauthenticated `PUT /v1/dating/location` returns 401.
  - Authenticated `PUT /v1/dating/location` returns 200 OK.
  - Response contains zero coordinates.
  - Spoofing another user's ID returns 403 Forbidden (`UNAUTHORIZED_USER_ID`).

---

## 19. Verification Results

```
===========================================================
       RUBARU PROTECTED LOCATION INTEGRATION TEST SUITE    
===========================================================
MongoDB Connected: ac-4yhspek-shard-00-02.1meot8l.mongodb.net

--- 1. Math & Distance Label Unit Tests ---
✅ [PASS] Haversine distance calculated accurately (1543m)
✅ [PASS] Distance < 1 km formatted
✅ [PASS] Distance 3.2 km formatted
✅ [PASS] Distance 8.5 km formatted
✅ [PASS] Distance 15 km formatted
✅ [PASS] Distance 45 km formatted
✅ [PASS] hideDistance returns "Nearby"

--- 2. Location Validation & Service Tests ---
✅ [PASS] First location update status is CURRENT
✅ [PASS] First location sets locationVersion to 1
✅ [PASS] First location marks isSignificantMovement as true
✅ [PASS] Response contains zero coordinate fields
✅ [PASS] Insignificant movement (< 500m) flagged as false
✅ [PASS] Insignificant movement does not increment locationVersion
✅ [PASS] Significant movement (>= 500m) flagged as true
✅ [PASS] Significant movement increments locationVersion to 2
✅ [PASS] Retry with same requestId does not increment version
✅ [PASS] Latitude > 90 throws INVALID_LATITUDE
✅ [PASS] Longitude < -180 throws INVALID_LONGITUDE
✅ [PASS] Accuracy > 2000m throws INVALID_LOCATION_ACCURACY
✅ [PASS] CapturedAt > 60 mins old throws LOCATION_UPDATE_TOO_OLD

--- 3. Geospatial Index & Query Tests ---
✅ [PASS] Nearby query successfully finds User B within 10 km
✅ [PASS] User B distance within 10 km (2.5 km)
✅ [PASS] Nearby query results contain no raw coordinates
✅ [PASS] Tight 1 km query correctly excludes distant User B

--- 4. HTTP REST API Endpoint Tests ---
✅ [PASS] Unauthenticated PUT /v1/dating/location returns 401
✅ [PASS] Authenticated PUT /v1/dating/location returns 200 OK
✅ [PASS] Response has success: true envelope
✅ [PASS] Response confirms locationStatus: CURRENT
✅ [PASS] Response is privacy-safe (zero coordinates returned)
✅ [PASS] Attempting to spoof another user ID in body returns 403 Forbidden
✅ [PASS] Returns error code UNAUTHORIZED_USER_ID

===========================================================
LOCATION TESTS COMPLETED: 31 PASSED, 0 FAILED
===========================================================
```

Full regression suites:
* Model Tests: `18 PASSED, 0 FAILED`
* Preference Tests: `28 PASSED, 0 FAILED`
* Baseline Endpoints: `13 PASSED, 0 FAILED`

---

## 20. Files Changed

* **Modified**:
  - `backend/config/datingConfig.js` (Added location thresholds)
  - `backend/models/UserLocation.js` (Added `locationVersion` and `lastRequestId`)
  - `backend/routes/datingRoutes.js` (Mounted `PUT /location`)
* **Created**:
  - `backend/services/locationService.js` (Protected location and geospatial query service)
  - `backend/controllers/locationController.js` (HTTP controller for `PUT /location`)
  - `backend/test/location_tests.js` (31-assertion test suite)
  - `docs/backend/RESEARCH_1_PROMPT_4_LOCATION_IMPLEMENTATION.md` (Implementation report)

---

## 21. Unresolved Decisions

* **Passport / Travel Mode**: Deferred to future premium features prompt.

---

## 22. Deferred Discovery Work

* **Prompt 5**: Mutual Bilateral Eligibility Policy & Candidate Exclusion Pipeline.
* **Prompt 6**: Discovery Query, Rule-Based Ranking & Scoring Engine.
* **Prompt 7**: Recommendation Batches & Confirmed Profile Impressions.

---

## 23. Rollback Instructions

1. Remove `PUT /location` route from `backend/routes/datingRoutes.js`.
2. Delete `backend/controllers/locationController.js`, `backend/services/locationService.js`, `backend/test/location_tests.js`.

---

## 24. Readiness for Prompt 5

* **Status**: **READY FOR PROMPT 5 (Candidate Eligibility Policy & Retrieval Pipeline)**.
* Geospatial indexing, coordinate protection, movement versioning, and Haversine distance calculations are complete.

---

*End of Implementation Report.*
