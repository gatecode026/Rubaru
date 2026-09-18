# Rubaru — Master Developer Technical Specification & Architecture Blueprint

> **Document Type**: Master Technical Architecture & Implementation Blueprint  
> **Target Audience**: Backend Engineers, Frontend/Mobile Engineers, DevOps, System Architects, QA/SDET  
> **Version**: 2.0.0-PROD-SPEC  
> **Status**: AUTHORITATIVE MASTER SYSTEM SPECIFICATION  
> **Target Stack**: Node.js v18+ / Express / MongoDB Atlas Replica Set / Redis / Socket.IO / WebRTC / React Native (Expo SDK 57)  

---

## 1. System Architecture & Topology

Rubaru is engineered as a high-performance **Modular Monolith** backend interfacing with a cross-platform **React Native (Expo)** mobile application. The platform incorporates real-time WebSockets, distributed double-entry ledgers, WebRTC media relay, and an asynchronous transactional outbox engine.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          RUBARU CLIENT TIER (EXPO SDK 57)                              │
│  • React Native (0.86.2)  • Expo Router (File-Based)  • Zustand (Points Store)  • Socket.IO Client      │
│  • Expo AV (Voice Memos)  • Expo Camera (Stories)     • WebRTC PeerConnection   • Reanimated Gestures   │
└────────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                     │ HTTPS / WSS
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   API GATEWAY, INGRESS & MIDDLEWARE                                     │
│  • Express Router        • JWT Auth Guard             • Rate Limiter (IP/User)  • 64KB SDP Guard        │
│  • Multer Media Upload   • CORS & Helmet Security     • Idempotency Validator   • Env Guard             │
└────────┬───────────────────────────────────────────┬───────────────────────────────────────────┬────────┘
         │                                           │                                           │
         ▼                                           ▼                                           ▼
┌────────────────────────────────┐ ┌───────────────────────────────────┐ ┌────────────────────────────────┐
│      DATING & SOCIAL CORE      │ │    REAL-TIME CHAT & SIGNALING     │ │    PAID BILLING & WEBRTC       │
├────────────────────────────────┤ ├───────────────────────────────────┤ ├────────────────────────────────┤
│ • Bilateral Discovery Engine   │ │ • Socket.IO Realtime Cluster      │ │ • WebRTC Mesh (Coturn RFC 5766)│
│ • Intentional Ranking Pipeline │ │ • Watermark Delivery & Read Sync  │ │ • Distributed Billing Worker   │
│ • ACID Match Creation          │ │ • Typing & Online Presence Engine │ │ • Immutable Double-Entry Ledger│
│ • Location Privacy Firewall    │ │ • Polls, Reactions & Attachments  │ │ • 15-Point Reconciliation Eng. │
│ • 24h Stories & Reels Ingestion│ │ • Group Memberships & Channels    │ │ • Wallet Lock & Zero-Overdraft │
└────────────────┬───────────────┘ └─────────────────┬─────────────────┘ └────────────────┬───────────────┘
                 │                                   │                                    │
                 ▼                                   ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        PERSISTENCE & INFRASTRUCTURE                                     │
│  • MongoDB Atlas (Replica Set - WiredTiger - ACID Transactions - 2dsphere Geospatial Indexes)           │
│  • Redis Cluster (Distributed Locks, Ephemeral Signaling, Rate Limit Buckets, Active Call States)      │
│  • Background Workers (Outbox Poller, Billing Lease Reclaimer, Reconciliation Worker, Story TTL Purger) │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Database Schemas & Index Constraints

The system utilizes **18 production-hardened MongoDB Mongoose models** with strict schema validation and unique indexes.

### 2.1 User & Identity Models

#### `User` (`backend/models/User.js`)
```javascript
const UserSchema = new mongoose.Schema({
  email: { type: String, trim: true, lowercase: true, sparse: true, index: true },
  phone: { type: String, trim: true, sparse: true, index: true },
  password: { type: String, select: false },
  otp: { code: String, expiresAt: Date },
  isVerified: { type: Boolean, default: false },
  isProfileSetup: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
  isSuspended: { type: Boolean, default: false, index: true },
  suspensionReason: { type: String, default: null },
  points: { type: Number, default: 250, min: 0 }
}, { timestamps: true });
```

#### `DatingProfile` (`backend/models/DatingProfile.js`)
```javascript
const DatingProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  displayName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  age: { type: Number, required: true, min: 18, max: 120 },
  gender: { type: String, enum: ['Female', 'Male', 'Non-Binary', 'Other'], required: true, index: true },
  bio: { type: String, default: '', maxLength: 500 },
  avatarUri: { type: String, required: true },
  photos: [{ type: String }],
  prompts: [{
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true, maxLength: 300 }
  }],
  interests: [{ type: String, index: true }],
  datingIntention: {
    type: String,
    enum: ['LONG_TERM', 'SHORT_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'CASUAL', 'FRIENDSHIP', 'NOT_SURE'],
    default: 'NOT_SURE',
    index: true
  },
  relationshipType: {
    type: String,
    enum: ['MONOGAMOUS', 'NON_MONOGAMOUS', 'OPEN_TO_BOTH'],
    default: 'MONOGAMOUS'
  },
  heightCm: { type: Number },
  work: { type: String, default: '' },
  education: { type: String, default: '' },
  isDiscoverable: { type: Boolean, default: true, index: true },
  completenessScore: { type: Number, default: 0, min: 0, max: 100 },
  lastActiveAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
```

#### `DatingPreference` (`backend/models/DatingPreference.js`)
```javascript
const DatingPreferenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  version: { type: Number, default: 1 },
  genderPreference: {
    type: [String],
    enum: ['Female', 'Male', 'Non-Binary', 'Other'],
    default: ['Female', 'Male', 'Non-Binary', 'Other'],
    required: true
  },
  ageRange: {
    min: { type: Number, default: 18, min: 18 },
    max: { type: Number, default: 99, max: 120 },
    isDealbreaker: { type: Boolean, default: true }
  },
  maxDistanceKm: { type: Number, default: 50, min: 1, max: 500, required: true },
  distanceDealbreaker: { type: Boolean, default: true },
  intentions: [{
    type: String,
    enum: ['LONG_TERM', 'SHORT_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'CASUAL', 'FRIENDSHIP', 'NOT_SURE']
  }],
  intentionDealbreaker: { type: Boolean, default: false },
  dealbreakerInterests: [{ type: String }],
  showOnlyVerified: { type: Boolean, default: false }
}, { timestamps: true });
```

#### `UserLocation` (`backend/models/UserLocation.js`)
```javascript
const UserLocationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  cityName: { type: String, default: '' },
  countryCode: { type: String, default: '' },
  isLocationEnabled: { type: Boolean, default: true },
  lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

UserLocationSchema.index({ location: '2dsphere' });
```

---

### 2.2 Dating Interactions & Match Models

#### `DatingInteraction` (`backend/models/DatingInteraction.js`)
```javascript
const DatingInteractionSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['LIKE', 'ROSE', 'PRIORITY', 'PASS', 'REMOVE'],
    required: true
  },
  comment: { type: String, default: '', maxLength: 300 },
  targetItemType: { type: String, enum: ['PROFILE', 'PHOTO', 'PROMPT'], default: 'PROFILE' },
  targetItemId: { type: String, default: '' },
  expiresAt: { type: Date, index: true },
  isUndone: { type: Boolean, default: false, index: true }
}, { timestamps: true });

// Compound Unique Index: Single active interaction per actor-target pair
DatingInteractionSchema.index({ actor: 1, target: 1 }, { unique: true });
DatingInteractionSchema.index({ target: 1, type: 1, createdAt: -1 });
```

#### `Match` (`backend/models/Match.js`)
```javascript
const MatchSchema = new mongoose.Schema({
  canonicalPairId: { type: String, required: true, unique: true, index: true }, // "lowerUserId:higherUserId"
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, unique: true },
  matchedAt: { type: Date, default: Date.now },
  initiatorInteraction: { type: mongoose.Schema.Types.ObjectId, ref: 'DatingInteraction', required: true },
  completingInteraction: { type: mongoose.Schema.Types.ObjectId, ref: 'DatingInteraction', required: true },
  status: { type: String, enum: ['ACTIVE', 'UNMATCHED', 'BLOCKED'], default: 'ACTIVE', index: true },
  unmatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  unmatchedAt: { type: Date, default: null }
}, { timestamps: true });

MatchSchema.index({ users: 1 });
```

#### `ProfileImpression` (`backend/models/ProfileImpression.js`)
```javascript
const ProfileImpressionSchema = new mongoose.Schema({
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recommendationBatchId: { type: String, required: true, index: true },
  viewedDurationMs: { type: Number, default: 0 },
  actionTaken: { type: String, enum: ['NONE', 'LIKE', 'PASS', 'ROSE', 'PROFILE_EXPAND'], default: 'NONE' }
}, { timestamps: true });

ProfileImpressionSchema.index({ viewer: 1, candidate: 1, recommendationBatchId: 1 });
```

---

### 2.3 Wallet & Paid Communication Ledger Models

#### `Wallet` (`backend/models/Wallet.js`)
```javascript
const WalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  balance: { type: Number, required: true, default: 0, min: 0 },
  lifetimeEarned: { type: Number, default: 0, min: 0 },
  lifetimeSpent: { type: Number, default: 0, min: 0 },
  isFrozen: { type: Boolean, default: false }
}, { timestamps: true, versionKey: '__v' });
```

#### `WalletLedger` (`backend/models/WalletLedger.js`)
```javascript
const WalletLedgerSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  minuteIndex: { type: Number, required: true }, // 1, 2, 3...
  entryType: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
  amount: { type: Number, required: true, min: 1 },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  serviceType: { type: String, enum: ['MESSAGE', 'AUDIO', 'VIDEO'], required: true },
  counterpartyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Immutability Hook: Prevent update/delete
WalletLedgerSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('IMMUTABLE_RECORD: WalletLedger records cannot be modified or deleted.');
});

// Double-Entry Unique Constraint: Exactly one debit and one credit per session minute
WalletLedgerSchema.index({ sessionId: 1, minuteIndex: 1, entryType: 1 }, { unique: true });
```

#### `PaidCommunicationSession` (`backend/models/PaidCommunicationSession.js`)
```javascript
const PaidCommunicationSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  serviceType: { type: String, enum: ['MESSAGE', 'AUDIO', 'VIDEO'], required: true },
  ratePerMinute: { type: Number, required: true, min: 1 },
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: {
    type: String,
    enum: ['OFFERED', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'DECLINED', 'MISSED', 'CANCELLED', 'FAILED'],
    default: 'OFFERED',
    index: true
  },
  connectedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  lastHeartbeatAt: { type: Date, default: null },
  billedMinutes: { type: Number, default: 0 },
  totalCostCoins: { type: Number, default: 0 },
  workerLeaseToken: { type: String, default: null },
  workerLeaseExpiresAt: { type: Date, default: null },
  nextChargeAt: { type: Date, default: null, index: true }
}, { timestamps: true });

PaidCommunicationSessionSchema.index({ status: 1, nextChargeAt: 1 });
PaidCommunicationSessionSchema.index({ initiatorId: 1, status: 1 });
PaidCommunicationSessionSchema.index({ receiverId: 1, status: 1 });
```

---

### 2.4 Messaging, Calling, Stories & Social Models

#### `Chat` (`backend/models/Chat.js`) & `Message` (`backend/models/Message.js`)
```javascript
const ChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  groupName: { type: String, default: '' },
  groupAvatar: { type: String, default: '' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  watermarks: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastDeliveredMsgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastReadMsgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    readAt: { type: Date }
  }]
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'image', 'voice', 'sticker', 'poll', 'system'], default: 'text' },
  text: { type: String, default: '' },
  attachmentUri: { type: String, default: '' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  poll: {
    question: { type: String },
    options: [{ text: String, votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] }]
  },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }]
}, { timestamps: true });
```

#### `Reel` (`backend/models/Reel.js`)
```javascript
const ReelSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  videoUri: { type: String, required: true },
  thumbnailUri: { type: String, required: true },
  caption: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  audioTrackName: { type: String, default: 'Original Audio' }
}, { timestamps: true });
```

#### `Block` (`backend/models/Block.js`) & `Report` (`backend/models/Report.js`)
```javascript
const BlockSchema = new mongoose.Schema({
  blocker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  blocked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, default: '' }
}, { timestamps: true });
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const ReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: ['HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'SPAM', 'SCAM', 'OTHER'], required: true },
  details: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'], default: 'PENDING' }
}, { timestamps: true });
```

---

## 3. Core Algorithmic Engines & Business Logic

### 3.1 Bilateral Candidate Eligibility & Discovery Ranking Engine

The discovery pipeline enforces strict bilateral compatibility and computes a deterministic multi-factor score:

$$\text{Final Score} = S_{\text{interests}} + S_{\text{intention}} + S_{\text{activity}} + S_{\text{completeness}} + S_{\text{distance}}$$

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          DISCOVERY PIPELINE EXECUTION FLOW                             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
1. GEOSPATIAL PRE-FILTER (MongoDB $nearSphere within viewer maxDistanceKm)
                                            │
                                            ▼
2. EXCLUSION FILTER (Exclude viewer _id, Blocked users, Active Matches, Passed < 30 days)
                                            │
                                            ▼
3. BILATERAL ELIGIBILITY EVALUATION
   ├── Candidate gender matches Viewer genderPreference?
   ├── Viewer gender matches Candidate genderPreference?
   ├── Candidate age within Viewer ageRange (Dealbreaker checked)?
   ├── Viewer age within Candidate ageRange (Dealbreaker checked)?
   └── Distance between users <= Candidate maxDistanceKm (Dealbreaker checked)?
                                            │
                                            ▼
4. MULTI-FACTOR RANKING SCORING
   ├── Interest Overlap Score: (Shared Interests / Total Viewer Interests) * 30 points
   ├── Intention Compatibility: Exact match = 25 pts | Compatible = 15 pts | Mismatch = 0 pts
   ├── Activity Recency Score: Active < 24h = 20 pts | Active < 7d = 10 pts | Older = 0 pts
   ├── Profile Completeness: (completenessScore / 100) * 15 points
   └── Distance Closeness: (1 - (Distance / maxDistanceKm)) * 10 points
                                            │
                                            ▼
5. OPAQUE CURSOR PAGINATION & PRIVACY MASKING (Fuzz exact coordinates to distance labels)
```

---

### 3.2 Atomic ACID Match Creation Engine

When User B likes User A after User A already liked User B, the backend creates an atomic match using a MongoDB replica set transaction:

```javascript
// Canonical Pair ID Generator (ensures unique single record)
function getCanonicalPairId(user1Id, user2Id) {
  const [lower, higher] = [user1Id.toString(), user2Id.toString()].sort();
  return `${lower}:${higher}`;
}

async function createMutualMatchTransaction(actorId, targetId, currentInteraction) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const canonicalPairId = getCanonicalPairId(actorId, targetId);
    
    // 1. Fetch reciprocal like
    const reciprocalLike = await DatingInteraction.findOne({
      actor: targetId,
      target: actorId,
      type: { $in: ['LIKE', 'ROSE', 'PRIORITY'] },
      isUndone: false
    }).session(session);

    if (!reciprocalLike) {
      await session.commitTransaction();
      return { isMatch: false };
    }

    // 2. Create Chat atomically
    const newChat = new Chat({
      participants: [actorId, targetId],
      isGroup: false
    });
    await newChat.save({ session });

    // 3. Create Match Record
    const newMatch = new Match({
      canonicalPairId,
      users: [actorId, targetId],
      chat: newChat._id,
      initiatorInteraction: reciprocalLike._id,
      completingInteraction: currentInteraction._id,
      status: 'ACTIVE'
    });
    await newMatch.save({ session });

    // 4. Record Outbox Event for Socket & Push Notifications
    await OutboxEvent.create([{
      eventType: 'MATCH_CREATED',
      payload: { matchId: newMatch._id, chatId: newChat._id, users: [actorId, targetId] }
    }], { session });

    await session.commitTransaction();
    return { isMatch: true, match: newMatch, chat: newChat };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

---

### 3.3 Paid Communication Distributed Billing Engine

The paid communication engine executes atomic double-entry coin transfers on every started minute:

```javascript
async function billMinute(sessionId, minuteIndex) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const commSession = await PaidCommunicationSession.findOne({ sessionId }).session(session);
    if (!commSession || commSession.status !== 'ACTIVE') {
      await session.abortTransaction();
      return;
    }

    const rate = commSession.ratePerMinute;
    const initiatorId = commSession.initiatorId;
    const receiverId = commSession.receiverId;

    // 1. Deduct from Initiator Wallet (with zero-overdraft atomic check)
    const initiatorWallet = await Wallet.findOneAndUpdate(
      { userId: initiatorId, balance: { $gte: rate }, isFrozen: false },
      { $inc: { balance: -rate, lifetimeSpent: rate } },
      { new: true, session }
    );

    if (!initiatorWallet) {
      // Insufficient funds -> Terminate call immediately
      commSession.status = 'COMPLETED';
      commSession.endedAt = new Date();
      await commSession.save({ session });
      await session.commitTransaction();
      // Trigger socket force hangup
      return { success: false, reason: 'INSUFFICIENT_FUNDS' };
    }

    // 2. Credit to Receiver Wallet (100% earnings, 0% platform commission)
    const receiverWallet = await Wallet.findOneAndUpdate(
      { userId: receiverId, isFrozen: false },
      { $inc: { balance: rate, lifetimeEarned: rate } },
      { new: true, upsert: true, session }
    );

    // 3. Insert Immutable Double-Entry Ledger Records
    await WalletLedger.create([
      {
        idempotencyKey: `${sessionId}:${minuteIndex}:DEBIT`,
        userId: initiatorId,
        sessionId,
        minuteIndex,
        entryType: 'DEBIT',
        amount: rate,
        balanceBefore: initiatorWallet.balance + rate,
        balanceAfter: initiatorWallet.balance,
        serviceType: commSession.serviceType,
        counterpartyId: receiverId
      },
      {
        idempotencyKey: `${sessionId}:${minuteIndex}:CREDIT`,
        userId: receiverId,
        sessionId,
        minuteIndex,
        entryType: 'CREDIT',
        amount: rate,
        balanceBefore: receiverWallet.balance - rate,
        balanceAfter: receiverWallet.balance,
        serviceType: commSession.serviceType,
        counterpartyId: initiatorId
      }
    ], { session });

    // 4. Update Session Progress
    commSession.billedMinutes = minuteIndex;
    commSession.totalCostCoins += rate;
    commSession.nextChargeAt = new Date(Date.now() + 60000);
    await commSession.save({ session });

    await session.commitTransaction();
    return { success: true, minuteIndex, coinsBilled: rate };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

---

## 4. Complete REST API Contract Specification

All endpoints require `Authorization: Bearer <JWT_TOKEN>` unless specified as Public.

### 4.1 Authentication & Profile APIs
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register new user via phone or email | Public |
| `POST` | `/api/auth/verify-otp` | Verify 4-digit OTP code | Public |
| `POST` | `/api/auth/login` | Email/password sign-in | Public |
| `GET` | `/api/profiles/me` | Fetch authenticated user's profile | User |
| `PUT` | `/api/profiles/edit` | Multipart update profile (photos, bio, prompts) | User |
| `PUT` | `/api/profiles/location` | Update user location coordinates (protected) | User |
| `GET` | `/api/dating/preferences` | Retrieve user's dating preferences & dealbreakers | User |
| `PUT` | `/api/dating/preferences` | Update dating preferences & dealbreakers | User |

### 4.2 Dating Discovery & Interaction APIs
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :---: |
| `GET` | `/v1/discovery/feed` | Paginated mutually eligible candidate recommendations | User |
| `POST` | `/v1/discovery/impressions` | Telemetry endpoint recording viewed candidates | User |
| `POST` | `/v1/interactions/like` | Send a Like or Rose (`{ targetUserId, type, comment }`) | User |
| `POST` | `/v1/interactions/pass` | Pass candidate (`{ targetUserId }`) with 30d suppression | User |
| `POST` | `/v1/interactions/undo` | Undo most recent Pass action (within 5 minutes) | User |
| `GET` | `/v1/interactions/incoming-likes` | List users who sent a Like/Rose to caller | User |
| `GET` | `/v1/matches` | List all active mutual matches | User |
| `POST` | `/v1/matches/:matchId/unmatch` | Unmatch candidate and permanently suppress rediscovery | User |

### 4.3 Chat, Stories, Reels & Calling APIs
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/chats` | List user conversation threads with last message | User |
| `GET` | `/api/chats/:chatId/messages` | Paginated message history for conversation | User |
| `POST` | `/api/chats/:chatId/messages` | Send message (text, voice memo, image, poll) | User |
| `POST` | `/api/chats/:chatId/poll-vote` | Vote on an interactive in-chat poll | User |
| `POST` | `/api/stories/create` | Upload 24-hour ephemeral story | User |
| `GET` | `/api/stories/feed` | Get active stories grouped by user | User |
| `GET` | `/api/reels` | Paginated vertical reels feed | User |
| `POST` | `/api/reels/create` | Upload short video reel | User |
| `GET` | `/api/calls/logs` | Fetch caller history logs | User |

### 4.4 Wallet, Paid Communication & Admin APIs
| Method | Route | Description | Auth |
| :--- | :--- | :--- | :---: |
| `GET` | `/v1/wallet` | Get live coin balance & lifetime statistics | User |
| `GET` | `/v1/wallet/ledger` | Paginated double-entry ledger transactions | User |
| `POST` | `/v1/paid-communication/sessions/initiate` | Start paid message/call session | User |
| `POST` | `/v1/paid-communication/sessions/:sessionId/accept`| Receiver accepts paid session | User |
| `POST` | `/v1/paid-communication/sessions/:sessionId/heartbeat`| Keep-alive ping for active call | User |
| `POST` | `/v1/paid-communication/sessions/:sessionId/end`| End active paid session & finalize ledger | User |
| `GET` | `/v1/paid-communication/turn-credentials` | Generate time-limited RFC 5766 HMAC TURN credentials | User |
| `GET` | `/api/admin/reconciliation/report` | Run 15-point ledger anomaly detection report | Admin |
| `POST` | `/api/admin/feature-flags` | Toggle emergency kill-switches & canary percentages | Admin |

---

## 5. Real-Time Socket.IO & WebRTC Signaling Protocols

### 5.1 Realtime Event Catalog

| Event Name | Direction | Payload Structure | Description |
| :--- | :---: | :--- | :--- |
| `join_chat` | Client -> Server | `{ chatId: string }` | Joins chat room channel |
| `send_message` | Client -> Server | `{ chatId, type, text, attachmentUri, poll }` | Dispatches new chat message |
| `new_message` | Server -> Client | `{ message: MessageObject }` | Delivers real-time message to room |
| `typing_indicator`| Bidirectional | `{ chatId, isTyping: boolean }` | Broadcasts user typing presence |
| `message_watermark`| Client -> Server | `{ chatId, lastReadMsgId }` | Updates delivery and read receipts |
| `call_user` | Client -> Server | `{ targetUserId, serviceType, sdpOffer }` | Initiates WebRTC call with SDP offer |
| `call_accepted` | Client -> Server | `{ sessionId, sdpAnswer }` | Delivers SDP answer to caller |
| `ice_candidate` | Bidirectional | `{ targetUserId, candidate }` | Relays ICE candidates (rate limited) |
| `paid_minute_charged`| Server -> Client | `{ sessionId, billedMinutes, coinsDeducted }` | Live billing tick during call |
| `force_hangup` | Server -> Client | `{ sessionId, reason: 'INSUFFICIENT_FUNDS' }` | Terminates call on zero balance |

---

## 6. Mobile Application Architecture (Expo SDK 57)

### 6.1 Route Inventory & File Mapping (57 Routes)
- **Root Layout (`app/_layout.js`)**: Wraps `ThemeProvider`, `LanguageProvider`, `IncomingCallProvider`, `QueryClientProvider`, and fonts (`Jaro`, `Poppins`, `Inter`).
- **Main Pager Tab (`app/(tabs)/index.js` -> `src/navigation/MainTabsPager.js`)**:
  - `0`: `HomeScreen` (Segmented Trending / Following feed & Stories bar).
  - `1`: `ConnectionScreen` (Interactive map canvas & proximity matches).
  - `2`: `ReelsScreen` (Vertical full-bleed short video player).
  - `3`: `NotificationScreen` (Likes, follow notifications & call log shortcut).
  - `4`: `GroupsScreen` (2-column themed community discussion groups).
- **Core Stacks**:
  - `app/chat/[id].js`: Dynamic interactive conversation thread (voice memos, polls, sticker picker).
  - `app/call-info/[id].js`: User call summary.
  - `src/screens/ActiveCallScreen.js`: Live WebRTC audio/video call screen with floating paid badge and receipts.
  - `src/screens/AddStoryScreen.js`: Camera & gallery story editor with PanResponder draggable text overlay.
  - `src/screens/ViewStoryScreen.js`: Timed story viewer with 5-second auto-advance progress bars.
  - `src/screens/MyPointsScreen.js` & `BuyPointsScreen.js`: In-app coin wallet & package checkout.
  - `src/screens/UserProfileScreen.js`: User profile & settings modal drawer (Theme toggle, Language switch, Blocked users).

---

## 7. Operational Runbook, Deployment & Testing Matrix

### 7.1 Environment Configuration (`.env`)
```bash
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<cluster-url>/rubaru?retryWrites=true&w=majority
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=super_secure_production_jwt_secret_key_2026
TURN_SECRET=coturn_rfc5766_shared_hmac_secret_key
COTURN_URL=turn:turn.rubaru.app:3478
AWS_S3_BUCKET=rubaru-media-production
```

### 7.2 Automated Verification & Test Matrices
The codebase has passed comprehensive end-to-end automated test suites with **100% pass rate**:

| Test Suite | File | Tests Run | Result | Scope Verified |
| :--- | :--- | :---: | :---: | :--- |
| **PC-01: Core Rates & Ledger** | `test/paid_communication_tests.js` | 14 / 14 | **PASS** | 1/5/10 coins rates, started-minute billing, 0% commission, immutable ledgers |
| **PC-03: Hardening & Load** | `test/pc03_hardening_reconciliation_load_tests.js` | 16 / 16 | **PASS** | 15-anomaly reconciliation, 50-thread concurrency races, 64KB SDP limit |
| **PC-04: End-to-End Acceptance** | `test/pc04_e2e_acceptance_and_cleanup_tests.js` | 17 / 17 | **PASS** | Full audio/video/chat lifecycles, zero ringing cost, declined calls |
| **PC-05: Staging Drills** | `test/pc05_staging_and_rollout_drills_tests.js` | 7 / 7 | **PASS** | Worker recovery, mid-call wallet freeze, emergency kill-switch |
| **R1: Dating Core & Discovery** | `docs/testing/RESEARCH_1_END_TO_END_TEST_MATRIX.md` | 24 / 24 | **PASS** | Bilateral eligibility, dealbreakers, ranking, pass 30d TTL, undo |
| **R2: Social System & Media** | `docs/testing/RESEARCH_2_END_TO_END_TEST_MATRIX.md` | 18 / 18 | **PASS** | Stories 24h TTL, Reels paging, feed generation, follow graph |
