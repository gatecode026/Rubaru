# Research 1: Dating Core Operations Runbook

> **Document Version**: 1.0.0  
> **Target Audience**: Site Reliability Engineers, DevOps, On-Call Backend Engineers, and Security Reviewers  
> **Service**: Rubaru Dating Core Engine (Discovery, Likes, Matches, Chat Gating & Safety)  
> **Status**: APPROVED  
> **Date**: 1 September 2026  

---

## 1. Architecture Summary

The Rubaru Dating Core Engine operates across five primary layers:

```
[ Mobile App (React Native / Expo) ]
             |
             v  (HTTPS / REST + Socket.io)
[ Express API Gateway & Auth Guards (`/v1/*`, `/api/*`) ]
             |
             +---> [ Dating Preferences Service (`preferenceService.js`) ]
             +---> [ Protected Location Service (`locationService.js`) ]
             +---> [ Mutual Eligibility Engine (`eligibilityPolicy.js`) ]
             +---> [ Rule-Based Discovery Ranking (`rankingService.js`) ]
             +---> [ Impression Tracking (`impressionService.js`) ]
             +---> [ Likes, Roses & Limits Engine (`likeService.js`) ]
             +---> [ Incoming Likes Inbox (`incomingLikeService.js`) ]
             +---> [ Atomic Match & Chat Provisioner (`matchService.js`) ]
             +---> [ Match & Conversation Authorization Guard (`matchAuthorizationService.js`) ]
             +---> [ Trust & Safety: Unmatch, Block & Report (`safetyService.js`) ]
             |
             v  (Mongoose ORM / Transactions)
[ MongoDB Atlas Replica Set (Indexes, Geospatial 2dsphere, Unique Pairs) ]
             |
             v  (Transactional Outbox Pattern)
[ Outbox Event Collection (`OutboxEvent`) ] ---> [ Background Worker Engine (`outboxWorker.js`) ]
```

---

## 2. Health Checks & Diagnostic Endpoints

| Component | Endpoint / Method | Expected Status | Diagnostic Action on Failure |
| :--- | :--- | :---: | :--- |
| **API Server** | `GET /` | `200 OK` ("Rubaru API Server is running...") | Check PM2 process status and container memory. |
| **Database** | Mongoose connection state | `readyState === 1` | Verify MongoDB Atlas cluster status, SRV DNS resolution (8.8.8.8), and connection pool. |
| **Outbox Worker** | `node test/model_level_tests.js` | Index verification (`18/18 PASS`) | Check for stuck processing events in `OutboxEvent` (`status: 'PENDING'`). |

---

## 3. Critical Alert Response Runbooks

### 3.1 Alert: `HIGH_DISCOVERY_LATENCY` (> 500ms p95)
* **Trigger**: Discovery candidate queries taking > 500ms.
* **Immediate Actions**:
  1. Inspect MongoDB Atlas slow query logs for `$geoNear` stage.
  2. Verify 2dsphere index: `UserLocation.collection.getIndexes()`.
  3. Confirm `eligibilityPolicy.js` uses bulk `$in` queries (zero N+1 queries).
  4. Verify candidate batch caching is functioning.

### 3.2 Alert: `MATCH_TRANSACTION_CONFLICT` / `DUPLICATE_MATCH_ATTEMPT`
* **Trigger**: Duplicate key warnings on `canonicalPair_1`.
* **Resolution**: This is the expected and intended database-level race protection. The server automatically catches `E11000` duplicate key exceptions in `matchService.js` and returns the existing canonical match document without data corruption.

### 3.3 Alert: `OUTBOX_BACKLOG_ACCUMULATION`
* **Trigger**: More than 1,000 events pending in `OutboxEvent`.
* **Immediate Actions**:
  1. Inspect `OutboxEvent.find({ status: 'FAILED' })` for error traces.
  2. Run dead-letter reprocessing script.
  3. Scale outbox worker concurrency.

### 3.4 Alert: `SAFETY_REVOCATION_FAILURE`
* **Trigger**: Block or Unmatch endpoint latency / failure.
* **Immediate Actions**:
  1. Verify `Block` collection indexes: `{ blocker: 1, blocked: 1 }` and `{ blocked: 1, blocker: 1 }`.
  2. Confirm `matchAuthorizationService.requireActiveDatingConversation` is rejecting inactive chat writes.

---

## 4. Rollback and Disaster Recovery

### Feature Flag Deactivation:
To immediately disable the Dating Core in production without deploying code:
1. Set `DATING_FEATURE_ENABLED=false` in the application environment.
2. Restart the API servers: `pm2 reload rubaru-backend`.
3. The mobile client will fall back cleanly to standard social features.

---

*End of Operations Runbook.*
