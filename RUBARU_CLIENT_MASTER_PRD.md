# Rubaru — Master Client Product Requirements Document (PRD)

> **Document Type**: Master Product Requirements Document (Executive & Business Specification)  
> **Target Product**: Rubaru Mobile Application & Cloud Ecosystem  
> **Audience**: Product Owners, Investors, Executives, Business Operations, UI/UX Designers, Compliance & Growth Teams  
> **Version**: 2.0.0-ENTERPRISE  
> **Status**: APPROVED MASTER SPECIFICATION  
> **Target Platforms**: iOS & Android (Cross-Platform Native Experience)  
> **Localization**: English & Hindi (Bilingual Dynamic Interface)  

---

## Executive Summary

**Rubaru** is an all-in-one next-generation mobile platform that seamlessly fuses **Intentional Dating Discovery**, **Social Media Engagement (Reels & Stories)**, **Real-Time Interactive Messaging**, **High-Definition Audio/Video Calling**, and a **Creator Economy (Paid Communication & Micro-Transactions)** into a cohesive, culturally resonant ecosystem.

Unlike traditional single-purpose apps that suffer from high churn, Rubaru creates a complete daily engagement loop. Users onboard to discover meaningful romantic matches through strict bilateral compatibility and dealbreaker filters, stay connected through vibrant social feeds, express themselves with ephemeral stories and short-form video reels, converse through rich interactive chat threads with live polls and voice notes, and directly monetize their time and attention through pay-per-minute audio/video calls and paid messaging.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      RUBARU ECOSYSTEM                   │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
         ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
         │                   │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ INTENTIONAL     │ │ SOCIAL & MEDIA  │ │ REAL-TIME CHAT  │ │ HD CALLING &    │ │ CREATOR ECONOMY │
│ DATING CORE     │ │ FEED ECOSYSTEM  │ │ & ENGAGEMENT    │ │ WEBRTC ENGINE   │ │ & MONETIZATION  │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│• Mutual Match   │ │• Trending/Follow│ │• Voice Memos    │ │• 1-on-1 Audio   │ │• Coin Packages  │
│• Dealbreakers   │ │• Short Reels    │ │• Live Polls     │ │• 1-on-1 Video   │ │• Per-Min Calls  │
│• Like / Rose    │ │• 24h Stories    │ │• Reactions      │ │• Native Ringing │ │• Paid Messages  │
│• Location Fuzz  │ │• Interest Groups│ │• Watermarks     │ │• Call Logs      │ │• 100% Earnings  │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 1. Vision, Value Proposition & Market Strategy

### 1.1 The Market Opportunity
Modern mobile users frequently switch between 3 to 4 fragmented apps: a dating app (Tinder/Bumble/Hinge), a social video app (Instagram Reels/TikTok), a messaging tool (WhatsApp/Telegram), and creator platforms. Rubaru unifies these disparate behaviors into a unified, high-retention social-dating experience with integrated creator monetization tailored specifically for vibrant mobile-first demographics.

### 1.2 Core Value Propositions

1. **Intentional & Safe Dating Discovery**:
   - Replaces superficial endless swiping with a Hinge-style intentional discovery feed.
   - Enforces strict bilateral mutual compatibility: candidates only appear if both users satisfy each other’s gender, age, distance, and relationship preferences.
   - Privacy-first geolocation that never reveals exact coordinates, displaying fuzzed approximate distance tags (e.g., "Within 5 km").
   - Daily free interaction budgets (25 Likes/day) complemented by premium Super Likes and Roses to encourage genuine connections.

2. **Rich Ephemeral & Video Social Engagement**:
   - Integrated full-bleed vertical short video Reels with instant audio playback, stats, and sharing.
   - 24-hour ephemeral Stories with in-app camera capture, gallery selection, draggable text overlays, and a 5-second segmented progress viewer.
   - Dual-tab home feed (Trending vs. Following) and two-column themed community discussion groups.

3. **Next-Gen Messaging Experience**:
   - Real-time conversation threads featuring custom voice memo recordings, live interactive in-chat polls with real-time vote distribution, rich stickers, contextual replies, emoji reactions, and delivery/read receipts.

4. **Reliable High-Definition Calling**:
   - Crystal-clear 1-on-1 audio and video calling powered by secure WebRTC mesh and real-time signaling.
   - Native mobile ringer support that wakes up physical devices in the background for incoming calls.

5. **Direct Creator Monetization & Virtual Currency**:
   - Built-in virtual currency economy ("Rubaru Coins").
   - Creator monetization enabling verified influencers, hosts, and creators to charge per-minute rates for audio calls (5 coins/min), video calls (10 coins/min), and paid direct messages (1 coin/min).
   - 100% creator earnings payout model with zero platform fee deduction on communication transfers.
   - Transparent double-entry wallet ledger and instant receipt modals.

6. **Exceptional Aesthetic & Accessibility**:
   - Seamless dynamic Dual-Theme Engine (Light Mode with signature vibrant pink accents vs. Dark Mode with deep OLED black luxury finishes).
   - Full Bilingual Localization (English and Hindi) accessible via an interactive one-tap language switch.

---

## 2. Comprehensive Product Feature Breakdown

```
==================================================================================
PILLAR 1: ONBOARDING, VERIFICATION & SMART PROFILE
==================================================================================
```

### 2.1 Multi-Step Onboarding Journey
- **Interactive Onboarding Carousel**: 3D perspective cards demonstrating core features (Matches, Smart Algorithm, Premium Perks) with automatic 2.2-second rotation.
- **Flexible Sign-Up Options**: One-tap phone number, email, and social login buttons.
- **Instant OTP Verification**: 4-digit numeric verification with a 60-second countdown timer and automatic progression upon the 4th digit.
- **Mandatory 18+ Age Verification**: Custom calendar date-of-birth picker with automatic age verification preventing underage registrations (< 18 years).
- **Gender & Orientation Selection**: Inclusive options (Female, Male, Non-Binary, Other) with customizable dating preferences.
- **Interest Tags Matrix**: 14 thematic category chips (Music, Travel, Fitness, Gaming, Art, Food, Tech, etc.) that seed discovery matching.
- **Permissions & Contacts**: Native permissions dialogs for push notifications, camera, microphone, and location.

### 2.2 Rich Dating Profile
- **Hero Avatar & Photo Carousel**: High-resolution profile photo slots with crop/zoom.
- **Icebreaker Prompts**: Structured questions with personalized answers (e.g., "A non-negotiable for me is...", "The best way to win me over...").
- **Dating Intentions**: Explicit relationship goals (`Long-Term`, `Short-Term`, `Long-Term Open to Short`, `Casual`, `Friendship`, `Not Sure`).
- **Relationship Type**: Monogamous, Non-Monogamous, or Open to Both.
- **Professional & Educational Highlights**: Work title, company, college, and height badges.
- **Profile Completeness Metric**: Real-time progress bar guiding users to achieve 100% profile optimization.

---

```
==================================================================================
PILLAR 2: INTENTIONAL DATING DISCOVERY & MATCHMAKING
==================================================================================
```

### 2.3 The Discovery Experience
- **Bilateral Matching Algorithm**: Users only encounter profiles where mutual compatibility is 100% verified across gender preferences, age bounds, distance parameters, and strict dealbreakers.
- **Deterministic Multi-Factor Scoring**: Candidates are ranked based on shared interests, intention compatibility, active recency, and profile completeness.
- **Fuzzed Location Privacy**: Exact GPS coordinates are securely locked in backend vaults; the UI strictly displays proximity labels (e.g., "Nearby", "Within 10 km", "Within 25 km").
- **Interactive Proximity Map**: Visual interactive map canvas displaying themed pins, POI badges, and nearby match previews without revealing pinpoint home addresses.

### 2.4 Actions & Intentional Likes
- **Daily Like Limits**: Free users receive 25 free Likes every 24 hours to prevent spam and encourage thoughtful interactions.
- **Interaction Types**:
  - **Like**: Standard heart gesture expressing interest.
  - **Rose / Super Like**: Premium highlight that prioritizes the user at the top of the recipient's incoming likes queue.
  - **Pass**: Politely skips a candidate with a 30-day suppression cooldown.
  - **Undo**: Instantly reverses the most recent eligible pass action within a 5-minute window.
- **Incoming Likes Drawer**: Dedicated screen for browsing users who have sent a Like or Rose, enabling instant mutual match resolution.
- **Mutual Match Celebratory Modal**: High-energy celebratory overlay appearing simultaneously for both users upon a mutual match, offering instant shortcuts to "Send a Message" or "Keep Browsing".

---

```
==================================================================================
PILLAR 3: SOCIAL FEED, STORIES, REELS & COMMUNITY
==================================================================================
```

### 2.5 Dynamic Social Feed
- **Segmented Home Feeds**:
  - **Trending Tab**: Algorithmic showcase of viral posts, creator media, and top community updates.
  - **Following Tab**: Chronological stream of posts and updates exclusively from followed profiles.
- **Interactive Feed Cards**: Rich media layouts supporting image carousels, heart likes, comment drawers, and direct sharing.

### 2.6 Full-Bleed Vertical Reels
- **Immersive Video Player**: Seamless vertical paging with viewport-calculated snap scrolling.
- **Live Creator Interactions**: One-tap creator follow button, real-time like counter, comment sheet trigger, and social share actions.
- **Audio Track Indicators**: Music/audio track title ticker and sound metadata badges.

### 2.7 24-Hour Ephemeral Stories
- **Full-Screen Camera & Gallery Studio**: In-app camera supporting front/back flip, flash toggle, and local device gallery browsing.
- **Creative Text Overlay**: Interactive draggable text overlay with PanResponder gestures, multi-color palette selector, and typography formatting.
- **Story Viewer Experience**: Immersive full-screen player with 5-second automatic segmented progress bars, left/right tap navigation, press-to-pause gestures, and direct reply messaging.

### 2.8 Community Groups Directory
- **2-Column Themed Grid**: Clean visual showcase of discussion groups organized by interest (e.g., Photography Club, Indie Music Lovers, Fitness Tribe, Tech Innovators).
- **Group Details & Instant Joining**: Member counters, community guidelines, and group chat access.

---

```
==================================================================================
PILLAR 4: REAL-TIME INTERACTIVE MESSAGING & CHAT
==================================================================================
```

### 2.9 Direct & Group Chat Threads
- **Real-Time Synchronized Inbox**: Live conversation list displaying avatar stories rings, latest message snippets, unread counters, and online presence indicators.
- **Voice Note Recording & Playback**: In-app microphone audio memo recording with live waveform animation, duration counter, and instant voice note playback powered by `expo-av`.
- **Interactive In-Chat Polls**: Users can create custom multi-option polls within chat threads. Participants vote directly on the message bubble with real-time percentage updates and vote tallies.
- **Rich Media & Reactions**:
  - Full-screen photo attachments with zoom capability.
  - Sticker picker sheet with custom animated sticker packs.
  - Quick emoji reaction picker overlay for attaching sentiment reactions to individual messages.
  - Contextual reply preview drawers quoting previous messages.
- **Message Status Watermarks**: Real-time delivery status indicators (Sending, Sent, Delivered, Read).
- **AI Conversation Starters**: Smart context-aware icebreakers to spark engaging conversations between newly matched users.

---

```
==================================================================================
PILLAR 5: HIGH-DEFINITION AUDIO & VIDEO CALLING
==================================================================================
```

### 2.10 Crystal-Clear Calling Engine
- **One-on-One Calling**: Instant crystal-clear audio and 720p/1080p video calls powered by WebRTC mesh infrastructure with STUN/TURN fallback.
- **Call State Transitions**: Realistic UI progression (`Calling` -> `Ringing` -> `Connected`) with an active duration timer clock.
- **Native Background Ringing**: Integration with PushKit and CallKeep waking up locked devices with full-screen native incoming call banners (Accept/Decline).
- **In-Call Controls**: Speaker toggle, microphone mute/unmute, video camera flip, video stream disable, and one-tap hang-up.
- **Comprehensive Call Logs**: Detailed history of incoming, outgoing, and missed calls with timestamps, duration metrics, and callback triggers.

---

```
==================================================================================
PILLAR 6: PAID COMMUNICATION, WALLET & CREATOR ECONOMY
==================================================================================
```

### 2.11 Virtual Currency ("Rubaru Coins")
- **My Points Dashboard**: Visual hero balance card displaying live Rubaru Coins balance, usage breakdowns per feature, and transaction history.
- **Transparent Purchase Tiers**: Expandable plan cards offering coin packages (e.g., Starter, Popular, Best Value, Ultra) with trust badges and secure checkout integration (UPI, Credit/Debit Cards, Net Banking, Apple/Google In-App Purchases).

### 2.12 Pay-Per-Minute Creator Monetization
- **Authoritative Business Pricing Rules**:
  | Service Type | Rate (Initiator Pays) | Creator Receives | Platform Commission |
  | :--- | :--- | :--- | :--- |
  | **Paid Chat Message** | 1 Coin / started minute | 1 Coin (100%) | 0% |
  | **Paid Audio Call** | 5 Coins / started minute | 5 Coins (100%) | 0% |
  | **Paid Video Call** | 10 Coins / started minute | 10 Coins (100%) | 0% |
- **Zero Cost on Non-Connected Calls**: Ringing, declined, missed, cancelled, or failed calls cost exactly 0 coins.
- **Started-Minute Rounding**: 1 to 60 seconds = 1 minute billed; 61 to 120 seconds = 2 minutes billed.
- **Live In-Session Status Badge**: Floating real-time pill during active calls showing live duration, coins spent/earned, and low-balance warnings.
- **End-of-Session Receipt Modal**: Comprehensive financial summary displayed at the end of every paid call detailing total duration, billed minutes, coins transferred, and direct ledger link.
- **Immutable Double-Entry Ledger**: Permanent audit trail of every coin debit and credit preventing discrepancies or unauthorized mutations.

---

```
==================================================================================
PILLAR 7: TRUST, SAFETY, MODERATION & COMPLIANCE
==================================================================================
```

### 2.13 Comprehensive Safety Suite
- **Bilateral User Blocking**: Immediate two-way exclusion. Blocked users cannot view profiles, appear in discovery, send messages, or place calls. Dedicated "Blocked Chats" management screen allows search and unblock.
- **Multi-Category Incident Reporting**: Structured reporting flow for harassment, fake profiles, inappropriate content, spam, or scams.
- **Safety Warnings & Violation Timelines**: In-app dashboard detailing broken rules, penalty statuses, and resolution timelines.
- **Scam Protection & Safety Hub**: Interactive educational checklists and guidelines on meeting safely in person and avoiding financial scams.
- **Full Legal Suite**: In-app searchable Privacy Policy, Terms of Service, and Community Standards.

---

```
==================================================================================
PILLAR 8: DESIGN SYSTEM, THEMING & ACCESSIBILITY
==================================================================================
```

### 2.14 UI/UX & Dual Theme Engine
- **Luxury Dual Theme**:
  - **Light Mode**: Warm, inviting palette with vibrant Rubaru Pink (`#E91E63` / `#FF3366`) primary accents.
  - **Dark Mode**: High-contrast, sleek OLED black aesthetic (`#121212` / `#1E1E1E`) designed for premium nocturnal usage.
- **Bilingual Switcher**: Instant toggle between English and Hindi with dynamic string localization across all 48 screens.
- **Fluid Micro-Animations**: Smooth gesture responses, card scaling, and bottom-sheet drawers powered by React Native Reanimated.

---

## 3. End-to-End User Personas & Experience Journeys

### Persona A: The Intentional Dater (Priya, 24)
1. **Onboarding**: Signs up via phone number, completes 4-digit OTP, sets DOB (verified 24), chooses "Female looking for Male", selects interests (Travel, Indie Music, Coffee).
2. **Discovery**: Explores the discovery feed. Sees only verified males aged 24–30 within a 15 km radius with shared interests.
3. **Engagement**: Likes a prompt on Rohan's profile.
4. **Mutual Match**: Rohan likes her profile back. A celebratory "It's a Match!" modal pops up on both devices.
5. **Conversation**: Opens the chat thread, shares a voice note, votes on an icebreaker poll, and transitions to a crystal-clear HD video call.

### Persona B: The Influencer / Creator (Aarav, 27)
1. **Profile Setup**: Enables creator mode and accepts incoming paid communications.
2. **Social Sharing**: Publishes daily short video Reels and 24-hour Stories to grow his following.
3. **Paid Consultations**: Receives an incoming paid audio call from a fan.
4. **Transparent Billing**: The call connects. The live badge indicates a 5 coins/min rate. After a 12-minute discussion, the call ends.
5. **Earnings & Ledger**: 60 Rubaru Coins are instantly credited to Aarav's wallet with a permanent ledger receipt.

---

## 4. Monetization & Tokenomics Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             REVENUE ARCHITECTURE                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  COIN PACKAGES   │          │ PREMIUM BOOSTS & │          │ VIP SUBSCRIPTION │
│  (DIRECT IAP)    │          │ SUPER LIKES      │          │ TIERS (MONTHLY)  │
├──────────────────┤          ├──────────────────┤          ├──────────────────┤
│• Starter (100)   │          │• Profile Boost   │          │• Unlimited Likes │
│• Popular (250)   │          │• Roses / Super   │          │• See Who Liked   │
│• Plus (600)      │          │• Undo Pass       │          │• 5 Free Roses/wk │
│• Elite (1500)    │          │• Direct Match    │          │• Travel Passport │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

1. **Direct Virtual Coin Sales**: High-margin IAP coin packages purchased through Razorpay, Stripe, UPI, Apple App Store, and Google Play Billing.
2. **A La Carte Premium Features**: Users spend coins to unlock Super Likes/Roses, profile spotlights/boosts, and unlimited pass undos.
3. **Creator Economy Ecosystem**: While Rubaru offers 0% commission on communication transfers to attract top creators, creator cash-out payout fees and coin purchase margin generate substantial net revenue.
4. **VIP Subscription Tiers**: Monthly recurring tiers granting unlimited likes, advanced filters, read receipt toggles, and passport location switching.

---

## 5. Product Rollout Roadmap

```
PHASE 1: Core Dating & Auth (Completed & Verified)
  ├── 18+ Verification & Bilingual Onboarding
  ├── Bilateral Discovery & Matching Algorithm
  └── Like / Pass / Super Like / Undo Engine

PHASE 2: Social Media & Messaging (Completed & Verified)
  ├── Trending/Following Feeds & Groups
  ├── 24-Hour Stories Studio (Camera & Draggable Text)
  ├── Full-Bleed Vertical Reels Feed
  └── Rich Messaging (Voice Memos, Polls, Reactions)

PHASE 3: HD Calling & Creator Monetization (Completed & Verified)
  ├── 1-on-1 WebRTC Audio/Video Calling
  ├── Virtual Coin Economy & Double-Entry Ledger
  └── Pay-Per-Minute Paid Calls & Chat Monetization

PHASE 4: Production Hardening & Global Launch (Next Step)
  ├── Push Notifications (FCM / APNs) Live Gateway
  ├── Production Razorpay / Apple IAP Gateway Certification
  └── Production App Store & Google Play Store Submission
```

---

## 6. Business Success Metrics & KPIs

| Metric Category | Key Performance Indicator (KPI) | Target Benchmark |
| :--- | :--- | :--- |
| **User Acquisition** | Onboarding Completion Rate (Start to First Match) | `> 78%` |
| **Dating Engagement** | Mutual Match Rate per 100 Likes Sent | `12% – 18%` |
| **Social Retention** | Day 1 / Day 7 / Day 30 Retention | `D1 > 60% | D7 > 38% | D30 > 22%` |
| **Calling Quality** | Call Completion Rate & Zero Bill Discrepancy | `> 99.8% Call Success | 0% Bill Error` |
| **Monetization** | Paid Coin Conversion Rate & ARPU | `> 8.5% Conversion | ARPU $4.20+` |
| **Trust & Safety** | Average Incident Report Resolution Time | `< 2 hours` |

---

## 7. Sign-Off & Client Acceptance

This Master Client PRD captures the authoritative scope, business logic, feature sets, and monetization rules for the Rubaru mobile ecosystem. It serves as the baseline for all ongoing development, marketing, and commercial operations.
