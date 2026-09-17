# Phase 0 Functional Correctness Audit & Verification Report

**App:** Rubaru (Instagram-style Social + Hinge-style Discovery)  
**Date:** September 16, 2026  
**Scope:** Single-user functional correctness pass before scaling or performance work. Every core user flow mapped end-to-end, traced from UI action to database persistence, audited for silent failures, race conditions, and dead workers, with all identified bugs fixed in code in isolation.

---

## 1. Flow-by-Flow Status Checklist

| # | Flow Description | Status | Traced Path |
|---|---|---|---|
| **1** | **Signup (Email / Phone + OTP)** | **WORKING** | `SignInScreen` / `VerifyOtpScreen` → `POST /api/auth/register-email` / `POST /api/auth/verify-otp` → `authController.js` → `User` created with `accountStatus: 'ACTIVE'` |
| **2** | **Login & JWT Issuance** | **WORKING** | `SignInScreen` → `POST /api/auth/login` → `authController.login` → Bcrypt comparison → 3650-day JWT returned → Persisted to AsyncStorage |
| **3** | **Auth Token Refresh** | **WORKING (BY DESIGN)** | App uses long-lived JWTs (3650 days) with instant 401 interceptor in `api.js` redirecting to `/sign-in`. No ephemeral refresh rotation is needed at this phase. |
| **4** | **Sign Out** | **WORKING** | Profile menu → `storage.clearSession()` + `disconnectSocket()` → clears local storage and navigates to `/sign-in` |
| **5** | **Account Deletion** | **FIXED** | `UserProfileScreen` 3-step modal → `DELETE /api/auth/account` → `authController.deleteAccount` → `User.accountStatus = 'DELETED'`, `isActive = false`, profile soft-deleted, content marked `DELETED`, session destroyed |
| **6** | **Create Image Post** | **WORKING** | `AddStoryScreen` (Post mode) → `mediaService.uploadMedia` (`POST /v1/media/upload`) → ImageKit upload + `MediaAsset` created → `postService.createPost` (`POST /v1/posts`) → `Content` record created (`contentType: 'POST'`, `status: 'PUBLISHED'`) |
| **7** | **Create Video Reel** | **WORKING** | `AddStoryScreen` (Reel mode) → `mediaService.uploadMedia` (`POST /v1/media/upload`) → ImageKit upload + `MediaAsset` created → `reelService.createReel` (`POST /v1/reels`) → `Content` record created (`contentType: 'REEL'`, `status: 'PUBLISHED'`) |
| **8** | **Create Story** | **FIXED** | `AddStoryScreen` (Story mode) → validates asset presence (no dummy fallback) → `mediaService.uploadMedia` → `storyService.createStory` (`POST /v1/stories`) → `Content` record created (`contentType: 'STORY'`, `expiresAt = now + 24h`) |
| **9** | **Story 24h Expiry & Cleanup** | **FIXED** | Background worker `socialLifecycleWorker.js` runs every 60s → queries `expiresAt <= now` → transitions `status: 'EXPIRED'` → produces `story.expired` outbox event → feed excludes expired stories |
| **10** | **View Home Feed** | **WORKING** | `HomeScreen` → `feedService.getMainFeed` (`GET /v1/feed`) → `feedController.getFeed` → queries `Content` (`contentType: 'POST'`, `status: 'PUBLISHED'`, audience/block filtered) → serialized feed returned |
| **11** | **View Reels Feed** | **WORKING** | `ReelsScreen` → `reelService.getReels` (`GET /v1/reels`) → `reelController.getReelsFeed` → queries `Content` (`contentType: 'REEL'`) → paginated video items rendered in `ReelItem` |
| **12** | **View Single Post / Reel / Story** | **WORKING** | `PostDetailModal` / `ReelItem` / `StoryViewerModal` → `GET /v1/posts/:id`, `GET /v1/reels/:id`, `GET /v1/stories/:id` → returns serialized media, author, and metrics |
| **13** | **Like / Unlike Post** | **WORKING** | Double-tap or heart icon in feed → `interactionService.toggleLike` (`POST /v1/content/:id/like` / `DELETE /v1/content/:id/like`) → atomic upsert on `ContentLike` + `$inc` on `Content.likesCount` → Socket.io event + in-app notification |
| **14** | **Like / Unlike Reel** | **WORKING** | Heart button in `ReelItem` → `interactionService.toggleLike` (`POST /v1/content/:id/like` / `DELETE`) → updates `ContentLike` and `Content.likesCount` |
| **15** | **Like / Unlike Comment** | **WORKING** | Heart button in `PostCommentsModal` → `interactionService.likeComment` (`POST /v1/comments/:id/like` / `DELETE`) → `CommentLike` updated + `$inc` on `Comment.likesCount` |
| **16** | **Comment on Post / Reel** | **FIXED** | `PostCommentsModal` → `POST /v1/content/:id/comments` → `interactionService.createComment` → `Comment` created + thumbnail preview correctly extracted from `mediaItems[0]` → Socket dispatch + notification to author |
| **17** | **Reply to Comment** | **WORKING** | `PostCommentsModal` reply input → `POST /v1/content/:id/comments` with `parentId` → `Comment` created with `parentCommentId` → `$inc` on `parent.replyCount` → notification to parent comment author |
| **18** | **Delete Comment** | **WORKING** | Long-press / trash icon in `PostCommentsModal` → `DELETE /v1/comments/:id` → soft deletes comment, decrements `Content.commentsCount`, cascades reply deletion |
| **19** | **Follow / Unfollow User** | **FIXED** | Profile / Reel follow button → `POST /v1/users/:id/follow` or `DELETE /v1/users/:id/follow` → `followService.followUser / unfollowUser` → updates `FollowRelationship` (`ACCEPTED` or `PENDING`) and recalculates counts |
| **20** | **Accept / Decline Follow Request** | **WORKING** | `NotificationScreen` / `FollowRequestsScreen` → `POST /v1/follow-requests/:id/accept` or `decline` → `followService.acceptFollowRequest` → transitions relationship to `ACCEPTED` and increments counters |
| **21** | **View Own Profile** | **WORKING** | `UserProfileScreen` → `GET /api/profiles/me` + `GET /v1/users/me/stats` → `profileController.getMe` → returns profile, posts, reels, followers/following counts |
| **22** | **View Another User's Profile** | **WORKING** | Profile tap from feed/reels → `GET /api/profiles/:userId` + `GET /v1/users/:userId/follow-status` → returns user bio, relationship status, and public content grid |
| **23** | **Edit Profile** | **WORKING** | Edit Profile Modal in `UserProfileScreen` → `PUT /api/profiles/edit` → `profileController.editProfile` → updates displayName, bio, interests, avatar, and photos |
| **24** | **Notifications Generation & Delivery** | **FIXED** | Interaction (like/comment/follow) → `OutboxEvent` written → `notificationConsumer.processPendingOutboxEvents` runs via `socialLifecycleWorker` + instant socket dispatch (`socketDispatchService`) → appears in `NotificationScreen` |
| **25** | **Save / Bookmark Reel & Post** | **FIXED** | Bookmark button in `ReelItem` → `POST /v1/content/:id/save` or `DELETE /v1/content/:id/save` → `ContentSave` collection updated |
| **26** | **Direct Messages / 1-on-1 Chat** | **WORKING** | `ChatsScreen` / `ChatDetailScreen` → `POST /v1/conversations/direct` → `POST /v1/conversations/:id/messages` → `messageService.sendMessage` → persisted to `Message` collection + real-time Socket.io delivery |
| **27** | **Hinge-Style Discovery Candidates** | **WORKING** | `DatingDiscoveryScreen` → `GET /v1/discovery/candidates` → `discoveryService.getCandidates` → validates readiness, applies geo-proximity and dating preferences, returns profile cards |
| **28** | **Send Dating Like / Match Flow** | **WORKING** | Like button in `DatingDiscoveryScreen` → `POST /v1/likes/send` → `incomingLikeService.sendLike` → if mutual, creates `Match` and creates shared `Conversation` |
| **29** | **Block User** | **WORKING** | Options menu → `POST /v1/safety/block` → `safetyService.blockUser` → `Block` record created → immediate feed and messaging mutual exclusion |
| **30** | **Report Content / User** | **WORKING** | Options menu → `POST /v1/safety/report` → `safetyService.report` → `Report` record created for moderation triage |

---

## 2. Details of Code Fixes

### Fix 1: Automated Background Worker for Story Expiry and Notification Outbox
- **Files Created/Modified:**
  - `backend/services/socialLifecycleWorker.js` *(New File)*
  - `backend/index.js`
- **What Was Broken:**
  - `storyService.expireStoriesBatch` existed in the codebase but was never called on a loop or timer. Stories with `expiresAt <= now` remained in `PUBLISHED` state indefinitely.
  - `notificationConsumer.processPendingOutboxEvents` was not scheduled, allowing asynchronous outbox events to pile up unprocessed.
- **What Was Changed:**
  - Created `SocialLifecycleWorker` which runs:
    - Story expiry batch pass every 60 seconds (`expireStoriesBatch(100)`).
    - Notification outbox processing pass every 5 seconds (`processPendingOutboxEvents(50)`).
  - Attached and started `defaultSocialWorker` during server initialization in `backend/index.js`.

### Fix 2: Account Deletion Flow (UI Crash & Missing Endpoint)
- **Files Modified:**
  - `backend/routes/authRoutes.js`
  - `backend/controllers/authController.js`
  - `src/screens/UserProfileScreen.js`
- **What Was Broken:**
  - Step 3 confirmation in `UserProfileScreen.js` merely navigated to `/sign-in` without sending any request to the backend or clearing session tokens.
  - No `DELETE /api/auth/account` endpoint existed on the backend.
  - Deleted users could log back in because `login` did not check `accountStatus === 'DELETED'`.
- **What Was Changed:**
  - Implemented `deleteAccount` in `backend/controllers/authController.js`: sets `user.isActive = false`, `user.accountStatus = 'DELETED'`, soft-deletes the `Profile`, and marks all user `Content` as `DELETED`.
  - Added `DELETE /account` protected route to `backend/routes/authRoutes.js`.
  - Added a check in `authController.login` returning HTTP 403 with `"This account has been deleted."` if `user.accountStatus === 'DELETED'`.
  - Updated `UserProfileScreen.js` Step 3 confirmation to call `api.delete('/auth/account')`, invoke `storage.clearSession()`, call `disconnectSocket()`, show an alert, and route to `/sign-in`.

### Fix 3: Legacy `followProfile` Controller Inconsistency
- **Files Modified:**
  - `backend/controllers/profileController.js`
- **What Was Broken:**
  - `profileController.followProfile` attempted to read and filter `currentProfile.following` and `targetProfile.followers`. In the unified social architecture, follow relationships are modeled via the `FollowRelationship` collection. This caused inconsistent count mutations and bypassed private account approval rules.
- **What Was Changed:**
  - Delegated `profileController.followProfile` directly to `followService.getFollowStatus`, `followService.followUser`, and `followService.unfollowUser`. Both legacy `/api/profiles/:userId/follow` and modern `/v1/users/:userId/follow` now share the identical transaction and validation logic.

### Fix 4: Broken Reel Follow and Save Toggle Endpoints
- **Files Modified:**
  - `src/components/common/ReelItem.js`
- **What Was Broken:**
  - `handleFollowToggle` was making requests to `/social/follow/${item.authorId}` (a non-existent endpoint), silently catching and failing in the console.
  - `handleSaveToggle` was making requests to `/social/save/${targetId}` (a non-existent endpoint), silently catching and failing.
- **What Was Changed:**
  - Imported `followService` and updated `handleFollowToggle` to call `followService.followUser` or `followService.unfollowUser` according to the toggled state.
  - Updated `handleSaveToggle` to call `POST /v1/content/${targetId}/save` or `DELETE /v1/content/${targetId}/save`.

### Fix 5: Notification Preview Thumbnail Schema Mismatch
- **Files Modified:**
  - `backend/services/interactionService.js`
- **What Was Broken:**
  - In like notifications (line 394) and comment notifications (line 599), code accessed `content.media?.[0]?.thumbnailUri`. In the `Content` schema, media is stored in `mediaItems`. The preview thumbnail always resolved to an empty string `''`.
- **What Was Changed:**
  - Updated both lines to correctly query:
    `content.mediaItems?.[0]?.thumbnail?.url || content.mediaItems?.[0]?.originalUrl || content.mediaItems?.[0]?.variants?.[0]?.url || ''`.

### Fix 6: Dummy Fallback Strings in Story / Reel / Post Creation
- **Files Modified:**
  - `src/screens/AddStoryScreen.js`
- **What Was Broken:**
  - If media was missing or upload failed, the code defaulted `mediaAssetId` to string literals like `'story_asset_fallback'`, `'reel_asset_fallback'`, or `'post_asset_fallback'`. These failed MongoDB ObjectId validation with cryptic 500/400 errors.
  - In Create (text) mode, passing `'create_canvas_' + Date.now()` caused an invalid ObjectId failure.
- **What Was Changed:**
  - Added strict validation checking for a valid `mediaAssetId`. If media failed to upload or was not selected, a clean user-facing alert is displayed and publishing is prevented before making an invalid backend request.

---

## 3. Ambiguities & Product Decisions Flagged for Product Owner

1. **Follower Removal vs. Comment Retention:**
   - *Current Behavior:* When a user removes a follower via `DELETE /v1/users/:userId/followers`, existing comments made by that removed follower on the user's private posts remain visible.
   - *Question:* Should removing a follower automatically delete or hide all their historical comments on the user's private posts, or retain them?
2. **Text-Only Stories (Instagram Create Mode):**
   - *Current Behavior:* Rubaru requires an image or video asset for all stories. The "Create" text mode in `AddStoryScreen` currently requires a background photo to be captured or selected.
   - *Question:* Should Rubaru generate a server-side SVG/canvas image asset for gradient text stories, or keep stories strictly photo/video-based?
3. **Session Invalidation on Password Change:**
   - *Current Behavior:* Changing password (`POST /api/auth/set-password`) updates the hash but does not revoke previously issued long-lived JWTs on other devices.
   - *Question:* Should Rubaru introduce a `tokenVersion` counter on the `User` schema to immediately invalidate all existing sessions when a password is reset?

---

## 4. Manual Human Test Checklist

Follow these steps on a real device or simulator to verify the complete functionality from the UI:

### Flow A: Authentication & Onboarding
1. Open the app; confirm the Sign In screen displays cleanly without network errors.
2. Enter a phone number (`+917340445907`) or email (`rahul@gmail.com`) and log in.
3. Confirm that you land on the Home Feed with tab navigation at the bottom.
4. Tap the Profile tab (bottom right); confirm your name, bio, and stats load without placeholder dummy texts.

### Flow B: Feed & Content Consumption
5. On the Home Feed, scroll vertically to view posts.
6. Double-tap a post image; confirm the heart animation plays and the like counter increments by 1.
7. Tap the comment icon on a post; verify the comment drawer opens.
8. Type `"Great post!"` and tap Send; verify the comment appears immediately in the list.
9. Tap the heart icon next to your comment; verify it highlights and shows 1 like.
10. Long-press your comment and tap Delete; verify the comment disappears from the drawer.

### Flow C: Reels & Interactions
11. Tap the Reels tab (second icon in bottom bar).
12. Swipe up to navigate between video reels; verify audio/video plays smoothly.
13. Tap the Like button on the right side of the reel; verify the like count increments.
14. Tap the three-dots menu on the right; tap "Save Reel"; verify toast notification `"Reel saved to your collection!"` appears.
15. Tap the Follow button next to the creator's username; verify it turns into "Following".

### Flow D: Create Content
16. Tap the `+` button in the top bar or profile screen.
17. Select **Post** mode, pick a photo from gallery, add caption `"Testing Rubaru"`, and tap Publish.
18. Verify success alert `"Post published to feed!"` appears and the new post shows in your profile grid.
19. Tap `+` again, select **Story** mode, capture or pick a photo, and tap Share.
20. Verify your profile avatar at the top of the Home Feed gets a gradient ring indicating an active story.
21. Tap your story ring; confirm the story displays full-screen with the 24h timer progress bar.

### Flow E: Follow & Notifications
22. Tap the search icon or discover another user's profile.
23. Tap "Follow"; verify the button changes to "Following" (or "Requested" if user is private).
24. Log in as the second user (or check `NotificationScreen`); verify a notification appears: `"[User] started following you."`.
25. Tap the notification; verify it navigates directly to the follower's profile.

### Flow F: Direct Messaging
26. From the Home Feed, tap the Chat bubble icon (top right).
27. Tap an existing conversation or start a new chat with another user.
28. Type `"Hello from Rubaru!"` and tap Send; verify the message appears with a checkmark.
29. Confirm real-time delivery if the other user is open, and message persistence upon reopening the chat.

### Flow G: Account Deletion
30. Navigate to the Profile tab, tap the Settings gear icon.
31. Scroll to the bottom and tap **Delete Account**.
32. Step through the 3-step confirmation modal; on Step 3, tap **Confirm**.
33. Verify the alert `"Your account and data have been removed"` appears and you are returned to the Sign In screen.
34. Attempt to log in with the deleted credentials; confirm the server responds with `"This account has been deleted."`.
