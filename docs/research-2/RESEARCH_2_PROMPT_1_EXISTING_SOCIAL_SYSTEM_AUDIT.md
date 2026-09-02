# Research 2: Prompt 1 — Existing Social System Comprehensive Read-Only Audit

> **Document Version**: 1.0.0  
> **Status**: COMPLETED & VERIFIED (Read-Only Audit)  
> **Author**: Senior Backend Architect & Security Lead  
> **Target Scope**: Instagram-Style Social Layer (Follow Graph, Posts, Carousels, Reels, Stories, Feeds, Interactions, Media Pipeline & Moderation)  
> **Date**: 1 September 2026  

---

## 1. Executive Summary

This document establishes the official architectural and implementation baseline for **Rubaru Research 2 (Social Content, Feed, Stories and Reels)**.

Before introducing new social features, a complete, non-destructive read-only audit of the existing codebase was conducted across frontend screens (`src/screens`), shared components (`src/components`), existing backend APIs (`backend/controllers`, `backend/routes`), database models (`backend/models`), media utilities (`backend/middleware`), and test suites (`backend/test`).

### Key Audit Findings:
1. **Frontend Richness vs Backend Reality**:
   * The React Native mobile frontend contains extensive, highly styled Instagram-like UI screens (`HomeScreen.js`, `ReelsScreen.js`, `AddStoryScreen.js`, `ViewStoryScreen.js`, `PostCommentsModal.js`).
   * **However**, approximately **85% of social content in the UI is backed by hardcoded static mocks** (`feedCardsData`, `storiesData`, `reelsData`, `INITIAL_COMMENTS`, `PLACEHOLDER_IMAGES`).
2. **Existing Backend Prototype Modules**:
   * **Reels Prototype**: `Reel.js` model, `reelController.js`, and `reelRoutes.js` exist at `/api/reels`. They support single-file video uploads via local disk Multer, basic unranked chronological listing, and toggling likes on an embedded array.
   * **Follow Graph Prototype**: `Profile.js` contains denormalized `followers: [ObjectId]` and `following: [ObjectId]` arrays, with `/api/profiles/:userId/follow` mutating both documents. This lacks a standalone `FollowRelationship` edge model, private account approval states (`PENDING`, `DECLINED`), and pagination.
   * **Stories & Posts Missing on Backend**: There are **zero backend models, controllers, or routes for Stories, Posts, Carousels, Post Likes, Post Comments, Saves, or Shares**.
3. **Research 1 Dating System Isolation**:
   * All 15 Research 1 test suites (`374 passing assertions`) remain protected. The social follow graph and dating match graph are completely separate domains and must remain decoupled.
4. **Prompt 2 Readiness**:
   * The repository is **`READY FOR PROMPT 2` (Media Foundation & Upload Sessions)**.

---

## 2. Repository Structure

```text
r:/Rubaru
├── backend/
│   ├── config/
│   │   ├── db.js                     (MongoDB Atlas connection with Google DNS SRV fallback)
│   │   └── datingConfig.js           (Research 1 dating parameters)
│   ├── controllers/
│   │   ├── authController.js         (Authentication, OTP, registration)
│   │   ├── callController.js         (WebRTC call history logs)
│   │   ├── chatController.js         (Chat messages & match-gated conversation authorization)
│   │   ├── profileController.js      (Profile CRUD, search, and prototype follow toggle)
│   │   ├── reelController.js         (Prototype Reel upload, feed, and likes)
│   │   └── [10 dating controllers]   (Research 1 protected controllers)
│   ├── middleware/
│   │   ├── auth.js                   (JWT Bearer authentication guard)
│   │   └── upload.js                 (Local disk Multer middleware: uploads/images, videos, audio)
│   ├── models/
│   │   ├── Profile.js                (General profile, avatar, bio, embedded follow arrays)
│   │   ├── Reel.js                   (Prototype short video model)
│   │   ├── Notification.js           (In-app notifications)
│   │   ├── User.js                   (User authentication identity & account status)
│   │   ├── OutboxEvent.js            (Transactional outbox collection)
│   │   └── [13 dating models]        (Research 1 protected models)
│   ├── routes/
│   │   ├── authRoutes.js             (/api/auth)
│   │   ├── profileRoutes.js          (/api/profiles)
│   │   ├── reelRoutes.js             (/api/reels)
│   │   ├── chatRoutes.js             (/api/chats)
│   │   └── [dating routes]           (/v1/dating, /v1/discovery, /v1/likes, /v1/matches, /v1/users)
│   ├── socket/
│   │   └── socketHandler.js          (Socket.io chat messaging, reactions, polls, and WebRTC signaling)
│   ├── test/                         (15 automated test suites with 374 passed assertions)
│   └── index.js                      (Express application gateway & route mounting)
├── src/
│   ├── assets/                       (App icons, watermark graphics, background assets)
│   ├── components/
│   │   └── common/
│   │       ├── FeedCard.js           (Instagram-style feed post card with comments & options sheet)
│   │       ├── PostCommentsModal.js  (Bottom sheet comments modal with nested replies & emoji bar)
│   │       ├── ReelItem.js           (Vertical snap video reel item with animated UI)
│   │       ├── StoryAvatar.js        (Story ring avatar component with gradient border)
│   │       └── StatsBar.js           (Profile likes, connections, and profile views counter banner)
│   ├── screens/
│   │   ├── HomeScreen.js             (Home feed + stories horizontal tray)
│   │   ├── ReelsScreen.js            (Vertical paging short-video feed)
│   │   ├── AddStoryScreen.js         (Full-featured camera viewfinder, gallery sheet, text overlay)
│   │   ├── ViewStoryScreen.js        (Story player with progress bar timer & direct reply input)
│   │   ├── SearchUsersScreen.js      (User search & discovery list)
│   │   └── UserProfileScreen.js      (Profile overview, reels grid, follow button, stats bar)
│   └── services/
│       ├── api.js                    (Axios HTTP client with JWT interceptor)
│       ├── datingService.js          (Research 1 dating API client)
│       └── socket.js                 (Socket.io client singleton)
└── docs/
    ├── backend/                      (Research 1 implementation documentation)
    └── research-2/                   (Research 2 architecture & audit reports)
```

---

## 3. Frontend Social Screen Inventory

| Screen / Route | File Path | Purpose | Reachable | Data Source | API Used | State Management | Current Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Home Feed** | `src/screens/HomeScreen.js` | Top social feed + Stories tray | Yes (Tab 1) | Hardcoded `feedCardsData` & `storiesData` | `GET /api/profiles/me` | Local React State | **Mock / Static Data** |
| **Reels Feed** | `src/screens/ReelsScreen.js` | Full-screen vertical paging video reels | Yes (Tab 3) | Hardcoded `reelsData` | None | Local React State | **Mock / Static Data** |
| **Add Story / Post** | `src/screens/AddStoryScreen.js` | Camera capture, gallery picker, text/sticker editor | Yes (`/add-story`) | Hardcoded `PLACEHOLDER_IMAGES` | Expo Camera / ImagePicker | Animated / PanResponder | **Frontend-Only** |
| **Story Viewer** | `src/screens/ViewStoryScreen.js` | 5s segmented story playback, reply input, pause on hold | Yes (`/view-story`) | Hardcoded `USER_STORIES` map | None | Animated Timer | **Mock / Static Data** |
| **User Profile** | `src/screens/UserProfileScreen.js` | Profile header, StatsBar, user reels grid, follow toggle | Yes (`/user-profile`) | Hybrid: Real Profile + Hardcoded stats | `GET /api/profiles/me`, `GET /api/reels/user/:id` | Local React State | **Partially Connected** |
| **Search People** | `src/screens/SearchUsersScreen.js` | Debounced text search for users and profiles | Yes (`/search-users`) | Real Database | `GET /api/profiles/search`, `GET /api/profiles/all` | Local React State | **Fully Connected** |
| **Search Friends** | `src/screens/SearchFriendsScreen.js` | Contacts permission promo screen | Yes (`/search-friends`) | Static UI | None | Local React State | **Frontend-Only** |

---

## 4. Frontend Social Component and Hook Inventory

| Component / Hook | File Path | Used By | Responsibility | Data Source | Backend Dependency | Issues Identified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FeedCard** | `src/components/common/FeedCard.js` | `HomeScreen.js` | Post card rendering, like toggle, options modal, comments sheet trigger | Props | None | Hardcoded likes, local state only |
| **PostCommentsModal** | `src/components/common/PostCommentsModal.js` | `FeedCard.js` | Bottom sheet comment list, nested replies, quick emoji bar, comment submission | Hardcoded `INITIAL_COMMENTS` | None | Simulated comments in local state, no API persistence |
| **ReelItem** | `src/components/common/ReelItem.js` | `ReelsScreen.js` | Reel card video/image player, like count, comment count, share action | Props | None | Hardcoded counters, unlinked comment modal |
| **StoryAvatar** | `src/components/common/StoryAvatar.js` | `HomeScreen.js` | Circular avatar with gradient ring for active stories | Props | None | Static placeholder avatars |
| **StatsBar** | `src/components/common/StatsBar.js` | `UserProfileScreen.js` | Profile summary pill (Likes, Connections, Profile Views) | Props | None | Authoritative data source undefined |

---

## 5. Mock and Static Social Data Inventory

| Data Source Constant | File Path | Data Type | Consumers | Production Ready | Backend Replacement Required |
| :--- | :--- | :--- | :--- | :---: | :---: |
| `feedCardsData` | `src/screens/HomeScreen.js` | 4 Mock Feed Post Objects | `HomeScreen` | **NO** | `GET /v1/feed` (Ranked Feed API) |
| `storiesData` | `src/screens/HomeScreen.js` | 5 Mock Story Circle Objects | `HomeScreen` | **NO** | `GET /v1/stories/feed` (Stories Tray API) |
| `reelsData` | `src/screens/ReelsScreen.js` | 4 Mock Reel Video Objects | `ReelsScreen` | **NO** | `GET /v1/reels` / `GET /api/reels` |
| `USER_STORIES` | `src/screens/ViewStoryScreen.js` | Map of 7 User Story Frames | `ViewStoryScreen` | **NO** | `GET /v1/stories/:userId` |
| `INITIAL_COMMENTS` | `src/components/common/PostCommentsModal.js` | 5 Top-Level Comments + Replies | `PostCommentsModal` | **NO** | `GET /v1/content/:id/comments` |
| `PLACEHOLDER_IMAGES`| `src/screens/AddStoryScreen.js` | 9 Random Picsum URLs | `AddStoryScreen` | **NO** | Real Device CameraRoll & Media Upload Sessions |

---

## 6. Backend Social Module Inventory

| Module | Model | Controller / Handler | Service | Route | Validation | Authorization | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Follow Graph** | `Profile.js` (embedded) | `profileController.followProfile` | None | `POST /api/profiles/:userId/follow` | Minimal | `protect` (JWT) | 0 tests | **Prototype** (Unindexed array growth) |
| **Reels Core** | `Reel.js` | `reelController.js` | None | `POST /api/reels/upload`, `GET /api/reels`, `POST /:id/like` | Basic | `protect` (JWT) | 0 tests | **Prototype** (Local disk storage, no transcoding) |
| **Posts & Carousels** | **Missing** | **Missing** | **Missing** | **Missing** | **None** | **None** | **None** | **Missing** |
| **Stories Lifecycle** | **Missing** | **Missing** | **Missing** | **Missing** | **None** | **None** | **None** | **Missing** |
| **Feed Ranking** | **Missing** | **Missing** | **Missing** | **Missing** | **None** | **None** | **None** | **Missing** |
| **Comments & Replies**| **Missing** | **Missing** | **Missing** | **Missing** | **None** | **None** | **None** | **Missing** |
| **Saves & Bookmarks** | **Missing** | **Missing** | **Missing** | **Missing** | **None** | **None** | **None** | **Missing** |
| **Media Upload Sessions**| **Missing** | **Missing** | **Missing** | **Missing** | **None** | **None** | **None** | **Missing** (Multer local disk only) |

---

## 7. Model and Schema Inventory

| Model | File Path | Purpose | Key Fields | Relationships | Indexes | Problems / Gaps Identified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Profile` | `backend/models/Profile.js` | User Social Profile | `displayName`, `avatarUri`, `photos`, `followers`, `following`, `followersCount`, `followingCount` | `user` -> `User` | `{ location: '2dsphere' }` | Follows stored as unbounded arrays inside Profile document (anti-pattern under scale). |
| `Reel` | `backend/models/Reel.js` | Short Video | `videoUri`, `thumbnailUri`, `caption`, `category`, `likes`, `sharesCount`, `commentsCount` | `user` -> `User` | None | Unindexed query paths; likes stored as embedded `[ObjectId]`; no duration/aspect ratio metadata. |
| `Notification` | `backend/models/Notification.js` | In-App Alerts | `recipient`, `sender`, `type`, `message`, `isRead`, `relatedReel`, `relatedChat` | `recipient`, `sender` -> `User` | None | Missing deduplication index; lacks support for post/comment/story notifications. |
| `Content` | **Missing** | Shared Post/Reel/Story Content | — | — | — | Needs implementation in Research 2. |
| `FollowRelationship`| **Missing** | Directional Follow Graph | — | — | — | Needs implementation in Research 2. |
| `MediaAsset` | **Missing** | Object Storage Metadata | — | — | — | Needs implementation in Research 2. |

---

## 8. Existing API Inventory

| Method | Endpoint | Route File | Handler | Auth | Validation | Current Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/reels/upload` | `reelRoutes.js` | `reelController.createReel` | Private | Multer file check | **Prototype** (Local disk write) |
| `GET` | `/api/reels` | `reelRoutes.js` | `reelController.getReels` | Private | Query params (`page`, `limit`) | **Prototype** (Offset pagination, unranked) |
| `POST` | `/api/reels/:id/like` | `reelRoutes.js` | `reelController.likeReel` | Private | ID check | **Prototype** (Embedded array mutation) |
| `GET` | `/api/reels/user/:userId` | `reelRoutes.js` | `reelController.getUserReels` | Private | Param check | **Prototype** (Unindexed find) |
| `POST` | `/api/profiles/:userId/follow` | `profileRoutes.js` | `profileController.followProfile` | Private | Self-check | **Prototype** (Bilateral array mutation) |
| `GET` | `/api/profiles/search` | `profileRoutes.js` | `profileController.searchProfiles` | Private | Query regex | **Production-Capable** (Regex search) |
| `GET` | `/api/profiles/all` | `profileRoutes.js` | `profileController.getAllProfiles` | Private | Limit 30 | **Production-Capable** (Global listing) |

---

## 9. Media Architecture Audit

| Capability | Frontend Evidence | Backend Evidence | Current Behavior | Security Risk | Required in Research 2 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Image / Video Selection** | `AddStoryScreen.js` (Expo ImagePicker) | Multer in `upload.js` | File selected from device gallery | Low | Keep Expo ImagePicker |
| **Storage Destination** | Local device URI | `backend/uploads/*` | Files stored directly on backend API server local disk | **High** (Server disk exhaustion, not scalable across multiple instances) | Migrate to direct-to-object-storage upload sessions (S3/R2/GCS compatible) |
| **Signed Upload Sessions** | None | None | Client POSTs multipart/form-data directly to API server | **Medium** (High API server CPU/bandwidth consumption) | `POST /v1/media/upload-sessions` |
| **Video Transcoding** | None | None | Raw uploaded video served as-is | **Medium** (Unoptimized mobile streaming) | Asynchronous video processing & thumbnail extraction |
| **EXIF / Geolocation Stripping**| None | None | Original image metadata preserved on disk | **High** (User location privacy leak in raw photos) | Automated EXIF metadata stripping in media pipeline |

---

## 10. Feed and Ranking Audit

* **Current Feed Implementation**: `HomeScreen.js` renders a static JavaScript array (`feedCardsData`) with 4 hardcoded posts.
* **Backend Feed Endpoints**: Currently **zero** backend feed generation endpoints exist.
* **Scoring Logic**: None implemented.
* **Research 2 Requirement**: Must implement on-read candidate retrieval (`GET /v1/feed`), combining connected accounts (accepted follows) with suggested discovery, rule-based ranking, and HMAC-SHA256 opaque cursors.

---

## 11. Story Lifecycle Audit

* **Current Story Implementation**:
  - `HomeScreen.js` renders a horizontal list of 5 hardcoded profile circles.
  - `ViewStoryScreen.js` plays a hardcoded map of images (`USER_STORIES`) with a 5000ms timer and pause-on-hold animation.
  - `AddStoryScreen.js` provides camera capture and text overlay creation in local state.
* **Backend Story Support**: Currently **zero backend Story models, storage, or endpoints exist**.
* **Research 2 Requirement**: Implement server-controlled 24-hour expiration (`expiresAt`), synchronous read-time filtering, tray aggregation, and idempotent view tracking (`POST /v1/stories/:id/view`).

---

## 12. Interaction Audit

* **Likes**: Currently only prototype Reel likes exist (`Reel.likes` array). Post likes, comment likes, and reaction types do not exist.
* **Comments**: `PostCommentsModal.js` contains a complete UI for comments and nested replies, but all data lives in local component state (`INITIAL_COMMENTS`).
* **Saves & Bookmarks**: No backend model or persistence.
* **Shares**: Handled as client UI counter increments only.

---

## 13. Event and Transactional Outbox Audit

* **Transactional Outbox Engine**: `backend/models/OutboxEvent.js` is fully implemented and tested.
* **Current Outbox Events**: Emits `match.created`, `match.unmatched`, `user.blocked`, `user.unblocked`, `report.created`, `profile.passed`, `profile.impression`.
* **Research 2 Reuse Opportunities**: The outbox schema can cleanly handle social events (`follow.requested`, `follow.accepted`, `content.published`, `content.liked`, `comment.created`, `story.expired`) without modifying the underlying outbox engine.

---

## 14. Security and Privacy Findings

| ID | Severity | Finding | Evidence | Exploit / Impact | Research 2 Mitigation Phase |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SEC-01** | **High** | Unbounded follow arrays in `Profile.js` | `followers: [ObjectId]` | Array growth causes document size to exceed MongoDB 16MB BSON limit for popular users. | Prompt 3 (`FollowRelationship` edge collection) |
| **SEC-02** | **High** | Local disk media storage via Multer | `backend/uploads/` | Server disk exhaustion; unauthenticated public file access; no EXIF stripping. | Prompt 2 (Scoped Upload Sessions & Direct Storage) |
| **SEC-03** | **Medium** | Unindexed Reel queries & embedded likes | `Reel.find({ category })` | Full collection scans under scale; race conditions on concurrent like toggles. | Prompt 4 & Prompt 6 (`Content` & `ContentLike` models) |
| **SEC-04** | **Medium** | Missing private account visibility authorization | `reelController.getReels` | Prototype endpoints return all content regardless of user privacy settings or block relationships. | Prompt 5 (Centralized Content Visibility Guard) |

---

## 15. Research 1 Compatibility Matrix

| Research 1 Area | Social Dependency | Conflict Risk | Required Boundary | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **User Identity (`User.js`)** | Social Author | Zero | Shared base authentication model | **Compatible** |
| **Dating Profiles (`DatingProfile.js`)** | Social Profile | Medium | Keep `DatingProfile` separate from social `Profile` | **Compatible** |
| **Safety Blocks (`Block.js`)** | Social Feed & Following | High | A dating/user block MUST immediately suppress social feeds, stories, reels, and following edges in both directions | **Guaranteed in Policy** |
| **Match Authorization** | Social Follows | High | Mutual dating match does NOT automatically create a social follow (and vice versa) | **Guaranteed in Policy** |
| **Transactional Outbox** | Social Events | Low | Social events use distinct event types in `OutboxEvent` | **Guaranteed in Policy** |

---

## 16. Summary Scorecard

| Area | Complete | Partial | Mocked | Missing | Confidence |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Follow Graph** | 0% | 20% (Prototype) | 0% | 80% | **High** |
| **Posts & Carousels** | 0% | 0% | 100% (Frontend) | 100% (Backend) | **High** |
| **Reels** | 0% | 30% (Prototype) | 70% (Frontend) | 70% (Backend) | **High** |
| **Stories** | 0% | 0% | 100% (Frontend) | 100% (Backend) | **High** |
| **Feed Generation** | 0% | 0% | 100% (Frontend) | 100% (Backend) | **High** |
| **Interactions (Likes/Comments/Saves)** | 0% | 15% (Reel like) | 85% (Frontend) | 85% (Backend) | **High** |
| **Media Pipeline** | 0% | 25% (Local Multer)| 0% | 75% (Direct Storage) | **High** |
| **Visibility / Privacy** | 0% | 0% | 0% | 100% | **High** |
| **Moderation** | 0% | 10% (Reports) | 0% | 90% | **High** |
| **Analytics / Impressions** | 0% | 0% | 0% | 100% | **High** |

---

## 17. Prompt 2 Readiness Gate

### Final Decision: **`READY FOR PROMPT 2`**

#### Read-Only Audit Checklist Complete:
* [x] Existing media code audited (`backend/middleware/upload.js` identified as local disk Multer prototype).
* [x] Storage provider status confirmed (No cloud object storage currently configured; local disk used).
* [x] Content and media model requirements identified (`Content.js`, `MediaAsset.js`, `UploadSession.js`).
* [x] Frontend upload consumers mapped (`AddStoryScreen.js`, `EditProfileScreen.js`).
* [x] Security boundaries and EXIF stripping requirements documented.
* [x] Research 1 regression baseline verified (All 15 test suites passed: **374 PASSED, 0 FAILED**).

---

*Files the Prompt 2 implementation agent must inspect first:*
1. `backend/middleware/upload.js` (Current Multer disk storage configuration)
2. `src/screens/AddStoryScreen.js` (Frontend media picker and capture flow)
3. `backend/models/OutboxEvent.js` (Transactional outbox schema)
4. `Rubaru_Research_2_Social_Content_Feed_Stories_and_Reels.pdf` (Architecture Reference)

---

*End of Audit Report.*
