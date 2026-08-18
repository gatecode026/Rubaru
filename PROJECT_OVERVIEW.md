# Rubaru - Project Overview & Developer Onboarding Guide

Welcome to **Rubaru**! This document serves as a comprehensive developer onboarding manual. It is built entirely on the actual codebase to help a new developer understand the codebase, set up the environment, and start contributing within an hour.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Screen-by-Screen Breakdown](#4-screen-by-screen-breakdown)
5. [Shared/Reusable Components Reference](#5-sharedreusable-components-reference)
6. [Design System / Theme](#6-design-system--theme)
7. [Localization / i18n](#7-localization--i18n)
8. [State Management](#8-state-management)
9. [Navigation Map](#9-navigation-map)
10. [Mock Data / Backend Status](#10-mock-data--backend-status)
11. [Known Limitations / TODOs](#11-known-limitations--todos)
12. [Setup & Run Instructions](#12-setup--run-instructions)
13. [Contribution Guidelines](#13-contribution-guidelines)

---

## 1. Project Overview

**Rubaru** is a modern social discovery and dating mobile application designed to connect users based on location, overlapping interests, and active communication.

* **Target Platforms**: iOS and Android mobile devices.
* **Workflow**: Expo Managed Workflow, utilizing **Expo Go** for quick development cycles.
* **Language**: 100% JavaScript (ES6+).
* **Core Value Proposition**: Allows users to set up rich interest-focused profiles, discover nearby matches on a mock interactive map, view full-bleed vertical short Reels, join themed community groups, chat inside threads (supporting emoji reactions, image attachments, stickers, custom polls, and voice notes), add stories with camera capture and gallery selection, manage in-app points economy, and manage support workflows or warning resolutions directly in-app.

### Key Feature Set
* **Interests & Matching**: Multi-select interest grids that filter nearby discoverable users.
* **Interactive Map**: Stylized canvas displaying points of interest and custom avatar coordinates for real-time proximity match previews.
* **Vertical Reels Feed**: Full-bleed swipeable reels with inline stats, follow options, and track indicators.
* **Group Management**: Two-column layouts representing community discussion groups.
* **Dynamic Chat Threads**: Context options for message copying, replies, sticker selection, emoji picker sheets, image sharing, poll voting overlays, and custom voice memo recording.
* **Stories System**: Camera-based story capture with gallery selection, text overlay support, and a timed story viewer with progress bars for viewing other users' stories.
* **Points Economy**: In-app virtual currency system with a dedicated points dashboard, purchase flow with plan selection cards, and a confirmation modal for buying points.
* **Simulated Calls System**: Handles outgoing, incoming call notifications, active duration clocks, and detail logs.
* **Dual Theme Support**: Light mode (pink accents) and dark/black mode toggled from user profile settings with dynamic color palette switching across all screens.
* **Bilingual Localization**: English and Hindi language support with a toggle in user profile settings.
* **Comprehensive Support Hub**: Built-in FAQ dropdown segments, bug ticket creators, scam guidelines, community compliance review dashboards, blocked chats management, privacy policy, terms of use, and about us pages.

---

## 2. Tech Stack

The libraries and frameworks used in this application are detailed below:

| Dependency / Tool | Version | Purpose in Rubaru |
| :--- | :--- | :--- |
| **React Native** | `0.86.2` | Core mobile application framework. |
| **Expo SDK** | `~57.0.12` | Managed environment wrap-around for quick compile, asset loading, and bundle builds. |
| **Expo Router** | `~57.0.12` | Handles routing structure, linking, and navigation stacks. |
| **React Native Pager View** | `8.0.2` | Powers the swipeable tabs pager container inside the main screen dashboard. |
| **React Native Reanimated** | `~3.16.1` | Facilitates smooth micro-animations, cards scaling, and sliding panels. |
| **Expo AV** | `~15.0.1` | Audio module used to record and play back voice notes in chats. |
| **Expo Camera** | Latest | Camera module used for capturing story photos with front/back camera toggle. |
| **Expo Image Picker** | Latest | Gallery access for selecting photos for stories and profile uploads. |
| **Axios** | `^1.7.4` | Network HTTP client instance ready for server communication. |
| **Zustand** | `^4.5.5` | Global state client engine powering the points balance store. |
| **React Query** | `^5.51.23` | Server state fetching caching framework (pre-wrapped at root level). |
| **Async Storage** | `^2.2.0` | Local storage engine for basic key-value data persistence. |
| **Expo Vector Icons** | `^15.0.3` | Custom vector symbols pack (Ionicons, Feather, FontAwesome, MaterialCommunityIcons). |
| **Expo Google Fonts** | `^0.4.*` | Inter, Jaro, and Poppins typography packages. |
| **Expo Linear Gradient** | Latest | Gradient backgrounds used across story screens, points screens, and buttons. |

---

## 3. Folder Structure

The directory map and structural purpose are detailed below:

* **[app/](file:///c:/Users/Shubh/Desktop/Rubaru/app)** — Maps file-based routes for Expo Router.
  * **[app/(tabs)/](file:///c:/Users/Shubh/Desktop/Rubaru/app/(tabs))** — Defines individual tabs route scripts redirecting to the main horizontal tab manager page.
  * **[app/call-info/](file:///c:/Users/Shubh/Desktop/Rubaru/app/call-info)** — Route endpoint details for call logs.
  * **[app/chat/](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat)** — Houses the dynamic conversation detail thread route.
  * **[app/_layout.js](file:///c:/Users/Shubh/Desktop/Rubaru/app/_layout.js)** — The root layout wrapping providers (ThemeProvider, LanguageProvider, IncomingCallProvider, QueryClientProvider), custom fonts loader, and routing tables.
* **[src/](file:///c:/Users/Shubh/Desktop/Rubaru/src)** — Houses the implementation.
  * **[src/assets/](file:///c:/Users/Shubh/Desktop/Rubaru/src/assets)** — App icons, graphics, backgrounds, and image assets (like_icon, poly_heart, payment brand logos).
  * **[src/components/](file:///c:/Users/Shubh/Desktop/Rubaru/src/components)** — Visual components.
    * **[src/components/common/](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common)** — 38 reusable presentation wrappers, lists, modals, cards, and sheets.
    * **[src/components/layout/](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/layout)** — Structure wrapper placeholders.
  * **[src/constants/](file:///c:/Users/Shubh/Desktop/Rubaru/src/constants)** — Stores static constants (like mock call history array objects).
  * **[src/hooks/](file:///c:/Users/Shubh/Desktop/Rubaru/src/hooks)** — Custom stateful hook definitions.
  * **[src/localization/](file:///c:/Users/Shubh/Desktop/Rubaru/src/localization)** — Bilingual language support system.
    * **[LanguageContext.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/localization/LanguageContext.js)** — React Context provider for language state (`en`/`hi`) and `t()` translation helper.
    * **[translations.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/localization/translations.js)** — Key-value translation maps for English and Hindi strings.
  * **[src/navigation/](file:///c:/Users/Shubh/Desktop/Rubaru/src/navigation)** — Custom navigation view components (e.g. swipe tabs view controller).
  * **[src/screens/](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens)** — 48 UI layout screens (Onboarding, Profiles, Stories, Points, Feeds, Violations, Help panels, Legal pages).
  * **[src/services/](file:///c:/Users/Shubh/Desktop/Rubaru/src/services)** — HTTP and client network instance scripts.
  * **[src/store/](file:///c:/Users/Shubh/Desktop/Rubaru/src/store)** — Zustand global state stores.
    * **[pointsStore.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/pointsStore.js)** — Points balance state with `addPoints()` and `setBalance()` actions.
  * **[src/theme/](file:///c:/Users/Shubh/Desktop/Rubaru/src/theme)** — Dual-theme design system with light and dark color palettes, spacing tokens, and ThemeContext provider.
  * **[src/utils/](file:///c:/Users/Shubh/Desktop/Rubaru/src/utils)** — Utilities and helper files (like emoji reaction assets list).

---

## 4. Screen-by-Screen Breakdown

This section details all **48 screen implementations** found inside the **[src/screens/](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens)** folder.

### Onboarding & Authentication Flow

1. **OnboardingScreen**
   * **File Path**: [OnboardingScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/OnboardingScreen.js)
   * **Route Mapping**: `/` (Default redirected route)
   * **Description**: Introduces the application with a high-fidelity carousel of marketing cards (Matches, Algorithm, Premium).
   * **Key Components**: [OnboardingCarousel](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/OnboardingCarousel.js), `ImageBackground`.
   * **Special Behavior**: Implements infinite swipe layouts with scale, perspective, and 3D card tilts, powered by an automatic 2200ms swipe cycle.
   * **Navigation Logic**:
     * Launches on app startup.
     * Navigates to `/signup-options` (Create account button) or `/sign-in` (Sign in link).

2. **SignInScreen**
   * **File Path**: [SignInScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/SignInScreen.js)
   * **Route Mapping**: `/sign-in`
   * **Description**: Email and password authentication page.
   * **Key Components**: Text fields, confirm action buttons, back chevron header.
   * **Special Behavior**: Simulated validation flow routing straight to main feed on press.
   * **Navigation Logic**:
     * Pushed from onboarding footer link.
     * Navigates to `/(tabs)` (Replaces routing stack) or `/signup-options`.

3. **SignUpOptionsScreen**
   * **File Path**: [SignUpOptionsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/SignUpOptionsScreen.js)
   * **Route Mapping**: `/signup-options`
   * **Description**: Onboarding gate presenting registration options and social log-ins.
   * **Key Components**: Action buttons (email/phone), FontAwesome social cards row, terms of use footer links.
   * **Special Behavior**: Scaled select triggers.
   * **Navigation Logic**:
     * Pushed from onboarding or sign in options.
     * Navigates to `/email-verification` or `/phone-verification`.

4. **EmailVerificationScreen**
   * **File Path**: [EmailVerificationScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/EmailVerificationScreen.js)
   * **Route Mapping**: `/email-verification`
   * **Description**: Collects the user's email address during registration.
   * **Key Components**: Custom styling text inputs, floating watermark backdrops.
   * **Navigation Logic**:
     * Pushed from sign up choices.
     * Navigates to `/otp-verification`.

5. **PhoneVerificationScreen**
   * **File Path**: [PhoneVerificationScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/PhoneVerificationScreen.js)
   * **Route Mapping**: `/phone-verification`
   * **Description**: Collects user mobile phone numbers and country code prefixes.
   * **Key Components**: Prefix dropdown indicator fields, submit button.
   * **Navigation Logic**:
     * Pushed from sign up choices.
     * Navigates to `/otp-verification`.

6. **OtpVerificationScreen**
   * **File Path**: [OtpVerificationScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/OtpVerificationScreen.js)
   * **Route Mapping**: `/otp-verification`
   * **Description**: Standard validation form verifying OTP code strings.
   * **Key Components**: 4-digit code box cells, custom numerical keyboard layout.
   * **Special Behavior**: Active 60-second countdown timer. Auto-routes immediately upon the 4th digit fill.
   * **Navigation Logic**:
     * Pushed from email/phone verification.
     * Navigates to `/profile-details`.

7. **ProfileDetailsScreen**
   * **File Path**: [ProfileDetailsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ProfileDetailsScreen.js)
   * **Route Mapping**: `/profile-details`
   * **Description**: Configures initial profile settings (avatar, first/last name, birthdate).
   * **Key Components**: Rounded avatar slot with camera badge overlay, name fields, dob selection drawer button.
   * **Special Behavior**: Integrates dynamic params listener updating chosen birthday values.
   * **Navigation Logic**:
     * Pushed from OTP verification.
     * Navigates to `/birthday-picker` (dob press) or `/gender-selection` (continue press).

8. **BirthdayPickerScreen**
   * **File Path**: [BirthdayPickerScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BirthdayPickerScreen.js)
   * **Route Mapping**: `/birthday-picker`
   * **Description**: Custom calendar date picker page.
   * **Key Components**: Months pagination buttons, custom day cells grid, year scroll modal overlay.
   * **Special Behavior**: Offsets calculation grid for first day of the week, custom month boundaries.
   * **Navigation Logic**:
     * Pushed from profile details.
     * Passes `selectedDob` parameter back to `/profile-details` route.

9. **GenderSelectionScreen**
   * **File Path**: [GenderSelectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/GenderSelectionScreen.js)
   * **Route Mapping**: `/gender-selection`
   * **Description**: Sets user gender identifiers.
   * **Key Components**: Gender option cards (Female, Male, More) with checkbox indicators.
   * **Navigation Logic**:
     * Pushed from profile details.
     * Navigates to `/interests-selection`.

10. **InterestsSelectionScreen**
    * **File Path**: [InterestsSelectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/InterestsSelectionScreen.js)
    * **Route Mapping**: `/interests-selection`
    * **Description**: Form to select interest tags.
    * **Key Components**: Grid of 14 interests with custom category icons, Skip link header.
    * **Special Behavior**: Toggles items state values inside local list arrays.
     * **Navigation Logic**:
        * Pushed from gender selection.
        * Navigates to `/search-friends` or `/enable-notifications`.

11. **SearchFriendsScreen**
    * **File Path**: [SearchFriendsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/SearchFriendsScreen.js)
    * **Route Mapping**: `/search-friends`
    * **Description**: Asks users to import contact logs to scan for matches.
    * **Key Components**: Import contact buttons, Skip link headers.
    * **Navigation Logic**:
       * Pushed from interests selection.
       * Navigates to `/enable-notifications` or replaces stack with `/(tabs)`.

12. **EnableNotificationsScreen**
    * **File Path**: [EnableNotificationsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/EnableNotificationsScreen.js)
    * **Route Mapping**: `/enable-notifications`
    * **Description**: Prompts users for permission to send push notifications.
    * **Key Components**: Illustration card layout, permission buttons.
    * **Navigation Logic**:
       * Pushed from contact search settings.
       * Replaces routing stack with `/(tabs)`.

---

### Main Tab Dashboard Screens (Swipeable Pager)

All tab screens below are hosted within the [MainTabsPager.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/navigation/MainTabsPager.js) template mapping to path `/(tabs)`.

13. **HomeScreen**
    * **File Path**: [HomeScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/HomeScreen.js)
    * **Route Mapping**: `/(tabs)` (Index Pager 0)
    * **Description**: The primary social discover feed tab.
    * **Key Components**: Horizontal story avatar lists, [SegmentedTabs](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/SegmentedTabs.js) (Trending vs. Following), feed post cards ([FeedCard](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/FeedCard.js)).
    * **Special Behavior**: Profile badge header routes to settings; heart pills toggle likes locally. Story avatars navigate to `/add-story` (own story) or `/view-story` (other users' stories).
    * **Navigation Logic**:
      * Navigates to `/user-profile` (avatar badge click), `/chats` (chat icon press), `/add-story` (story plus icon), or `/view-story` (story avatar press).

14. **ConnectionScreen**
    * **File Path**: [ConnectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ConnectionScreen.js)
    * **Route Mapping**: `/(tabs)` (tab search query `connection` - Index Pager 1)
    * **Description**: Map-based and tag-based match discovery screen.
    * **Key Components**: New users horizontal scroll card list, interests category chip row, custom interactive mockup map view.
    * **Special Behavior**: Custom interactive mock map with POI badges, street lines, nearby coordinate marker circles, and a center bubble highlighting "Connect with Rakhi". Toggling interests filters map pins updates.
    * **Navigation Logic**:
      * Integrated tab index swipe.

15. **ReelsScreen**
    * **File Path**: [ReelsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ReelsScreen.js)
    * **Route Mapping**: `/(tabs)` (tab search query `reels` - Index Pager 2)
    * **Description**: Swipeable vertical Reels media feed.
    * **Key Components**: Paged FlatList of [ReelItem](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/ReelItem.js) containers.
    * **Special Behavior**: Translucent system headers; FlatList scroll paging heights calculated based on viewport dimensions.
    * **Navigation Logic**:
      * Integrated tab index swipe.

16. **NotificationScreen**
    * **File Path**: [NotificationScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/NotificationScreen.js)
    * **Route Mapping**: `/(tabs)` (tab search query `notification` - Index Pager 3)
    * **Description**: Displays notification logs (likes, follow prompts, etc.).
    * **Key Components**: [SegmentedNotifCallsHeader](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/SegmentedNotifCallsHeader.js), list of [NotificationRow](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/NotificationRow.js) elements.
    * **Special Behavior**: Parses layout types: multi-thumbnail carousels, single preview images, or plain text strings.
    * **Navigation Logic**:
      * Header buttons navigate to `/call-logs`.

17. **GroupsScreen**
    * **File Path**: [GroupsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/GroupsScreen.js)
    * **Route Mapping**: `/(tabs)` (tab search query `groups` - Index Pager 4)
    * **Description**: Displays themed chat groups in a 2-column grid.
    * **Key Components**: Quick shortcuts row (Create Group, All Groups), group grid list of [GroupCard](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/GroupCard.js) components.
    * **Navigation Logic**:
      * Integrated tab index swipe.

---

### Inbox & Interactive Chat Flow

18. **ChatsScreen**
    * **File Path**: [ChatsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ChatsScreen.js)
    * **Route Mapping**: `/chats`
    * **Description**: Displays list of active chat threads.
    * **Key Components**: Horizontal story avatar rows, chat lists ([ChatListItem](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/ChatListItem.js)), [EmptyStateIllustration](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/EmptyStateIllustration.js).
    * **Special Behavior**: The profile initials badge in the header acts as a toggle: clicking it toggles between an empty chat state layout and an active conversation list view. Uses theme colors dynamically.
    * **Navigation Logic**:
      * Pushed from home header.
      * Navigates to `/chat/[id]` (chat row press) or `/user-profile`.

19. **ChatDetailRoute**
    * **File Path**: [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js)
    * **Route Mapping**: `/chat/[id]`
    * **Description**: Dynamic route hosting specific conversation threads.
    * **Key Components**: Chat messages stream, text inputs, emoji/reaction sheets, attachment menus, custom sticker picker dialogs, AI assist panels, custom interactive polls.
    * **Special Behavior**:
      * Dynamic poll selections updating votes ratio state variables in-app.
      * Floating reply preview drawers overlaying fields.
      * Integrated voice note audio recording and playback utilities powered by `expo-av`.
    * **Navigation Logic**:
      * Pushed from chat rows.
      * Back arrow redirects to `/chats`.

---

### Stories System

20. **AddStoryScreen**
    * **File Path**: [AddStoryScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/AddStoryScreen.js)
    * **Route Mapping**: `/add-story`
    * **Description**: Full-screen camera interface for capturing or selecting story photos. After capture/selection, transitions to an in-screen story editor with text overlay, draggable text positioning, and font color selection.
    * **Key Components**: `CameraView` (expo-camera), [GalleryThumbnail](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/GalleryThumbnail.js), [StoryModeTab](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/StoryModeTab.js), camera flip button, flash toggle, gallery grid browser.
    * **Special Behavior**:
      * Camera permission management with custom permission-request UI.
      * Front/back camera toggle with flip animation.
      * Gallery browser mode with thumbnail grid from device media library.
      * After capture: full-screen image preview with draggable text overlay using PanResponder, font color picker strip, and "Your Story" publish button with gradient styling.
      * All editing happens on the same screen (no page redirect).
    * **Navigation Logic**:
      * Pushed from home screen story plus icon.
      * Back arrow returns to previous screen.

21. **ViewStoryScreen**
    * **File Path**: [ViewStoryScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ViewStoryScreen.js)
    * **Route Mapping**: `/view-story`
    * **Description**: Full-screen immersive story viewer for viewing other users' stories with auto-advancing progress bars, timed transitions, and reply input.
    * **Key Components**: Animated progress bar segments, user avatar header, story image display, reply text input, like/share action buttons.
    * **Special Behavior**:
      * 5-second auto-advance timer per story frame.
      * Tap left/right halves of screen to navigate between story frames.
      * Multiple stories per user with segmented progress indicators.
      * Mock story data for multiple users (Karan, Sneha, Priya, Arjun, Meera).
      * Press-and-hold pauses the story timer.
    * **Navigation Logic**:
      * Pushed from story avatar taps on home/chats screens (receives `userName` param).
      * Close button or completing all stories navigates back.

22. **StoryPreviewScreen** *(Placeholder)*
    * **File Path**: [StoryPreviewScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/StoryPreviewScreen.js)
    * **Route Mapping**: `/story-preview`
    * **Description**: Empty placeholder screen reserved for future story preview functionality.

---

### Simulated Calling Operations Flow

23. **CallLogsScreen**
    * **File Path**: [CallLogsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/CallLogsScreen.js)
    * **Route Mapping**: `/call-logs`
    * **Description**: Lists previous inbound, outbound, and missed call sessions.
    * **Key Components**: [SegmentedNotifCallsHeader](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/SegmentedNotifCallsHeader.js), list of call logs, [EmptyCallLogsView](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/EmptyCallLogsView.js).
    * **Special Behavior**: Dev testing sub-bar containing:
      * **"⚡ Incoming Call Demo"** button: Triggers a mock incoming call using `IncomingCallContext`, displaying an overlay banner app-wide.
      * **"Show Empty State / Show List State"** button: Toggles between call logs list and empty state views.
    * **Navigation Logic**:
      * Switched from notifications header segment tab.
      * Navigates to `/call-info/[id]` or `/active-call`.

24. **CallInfoScreen**
    * **File Path**: [CallInfoScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/CallInfoScreen.js)
    * **Route Mapping**: `/call-info/[id]`
    * **Description**: Displays the call history and summary details of a specific user.
    * **Key Components**: User status card, action dial icon buttons, flat list of historic call logs.
    * **Navigation Logic**:
      * Pushed from call log list rows.
      * Navigates to `/active-call`.

25. **ActiveCallScreen**
    * **File Path**: [ActiveCallScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ActiveCallScreen.js)
    * **Route Mapping**: `/active-call`
    * **Description**: Simulates an active voice/video call session interface.
    * **Key Components**: Profile image card, hang up control button, status label.
    * **Special Behavior**: Transitions status: `Calling` -> `Ringing` (after 2s) -> `Connected` (after 4.5s), which triggers a real-time call duration timer.
    * **Navigation Logic**:
      * Pushed from dialing keys or accepted banners.
      * Hanging up redirects back, or to `/call-logs`.

---

### User Profile & Settings Flow

26. **UserProfileScreen**
    * **File Path**: [UserProfileScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/UserProfileScreen.js)
    * **Route Mapping**: `/user-profile`
    * **Description**: User profile options control center with settings sidebar modal.
    * **Key Components**: Top profile description card (63K followers text), Settings sidebar sections with grouped navigation options, Language selector toggle (English/Hindi flag slider), Dark mode toggle switch, Log out and Delete account overlay confirmation dialog modals.
    * **Special Behavior**: Uses backdrop overlay modals. Settings sidebar organizes items into 4 groups: Account, Privacy & Safety, Help, and Others. Language toggle uses animated flag slider. Dark mode toggle controls ThemeContext.
    * **Navigation Logic**:
      * Pushed from feed or header avatar actions.
      * Navigates to `/notification-settings`, `/edit-profile`, `/my-points`, `/help-support`, `/violations`, `/feedback`, `/faqs`, `/blocked-chats`, `/privacy-policy`, `/terms-of-use`, `/community-standards`, `/permission-grant`, `/about-us`, or replaces stack with `/sign-in` on logout confirmation.

27. **NotificationSettingsScreen**
    * **File Path**: [NotificationSettingsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/NotificationSettingsScreen.js)
    * **Route Mapping**: `/notification-settings`
    * **Description**: Setup screen containing switches to adjust application settings.
    * **Key Components**: Scroll list of options groups (Push notifications pause, Likes, Followers, Messages, Call notifications alerts).
    * **Special Behavior**: Radio button checks, local states selection toggle parameters.
    * **Navigation Logic**:
      * Pushed from user profile settings.
      * Navigates back to `/user-profile?openSettings=true`.

28. **EditProfileScreen**
    * **File Path**: [EditProfileScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/EditProfileScreen.js)
    * **Route Mapping**: `/edit-profile`
    * **Description**: Edit profile name, birthdate, and contact numbers.
    * **Key Components**: Picture upload slots, text fields, grid of interest tag selectors.
    * **Navigation Logic**:
      * Pushed from profile options.
      * Navigates back to `/user-profile`.

---

### Points Economy System

29. **MyPointsScreen**
    * **File Path**: [MyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/MyPointsScreen.js)
    * **Route Mapping**: `/my-points`
    * **Description**: Dashboard displaying the user's current points balance, points usage costs per feature, and quick-buy package options.
    * **Key Components**: Points balance hero card with gradient background, [PointsUsageIcon](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/PointsUsageIcon.js) grid showing costs for Like/Messages/Profile Boost/Super Like/Premium, [PointsPackageRow](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/PointsPackageRow.js) listing available purchase packages, [BottomTabBar](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/BottomTabBar.js).
    * **Special Behavior**: Reads balance from Zustand `pointsStore`. Displays floating watermark heart decorations on gradient background.
    * **Navigation Logic**:
      * Pushed from user profile or home header points badge.
      * Navigates to `/buy-points` (Buy Points CTA button).

30. **BuyPointsScreen**
    * **File Path**: [BuyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BuyPointsScreen.js)
    * **Route Mapping**: `/buy-points`
    * **Description**: Purchase flow screen displaying expandable plan cards, trust badges, accepted payment methods, and a purchase confirmation modal.
    * **Key Components**: [PlanCard](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/PlanCard.js) (4 tier plans with expandable feature details), [TrustBadge](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/TrustBadge.js) row, [PaymentMethodBadge](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/PaymentMethodBadge.js) row, purchase confirmation Modal, [BottomTabBar](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/BottomTabBar.js).
    * **Special Behavior**:
      * PlanCard components expand/collapse to show feature breakdowns (Like count, Messages, Profile Boost, Super Like).
      * Purchase confirmation modal with two states: confirming and success.
      * On purchase confirmation, adds points to Zustand `pointsStore` balance.
      * Theme-aware: Buy Now and View Details buttons switch to black in dark mode via `useTheme` hook.
      * Displays "Most Popular" badge on the first plan.
    * **Navigation Logic**:
      * Pushed from My Points screen.
      * Back arrow navigates back. Success modal "Done" button navigates back.

---

### Support, FAQ, Legal & Compliance Hub

31. **HelpSupportScreen**
    * **File Path**: [HelpSupportScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/HelpSupportScreen.js)
    * **Route Mapping**: `/help-support`
    * **Description**: Navigation hub listing help resources.
    * **Key Components**: Nav list.
    * **Navigation Logic**:
      * Pushed from user profile.
      * Navigates to `/customer-support-flow`, `/report-problem`, `/report-violations`, `/privacy-security-help`, `/scam-protection`, `/contact-us`, `/feedback`, `/faqs`.

32. **CustomerSupportFlowScreen**
    * **File Path**: [CustomerSupportFlowScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/CustomerSupportFlowScreen.js)
    * **Route Mapping**: `/customer-support-flow`
    * **Description**: Form to submit support tickets.
    * **Key Components**: Step 1 category grid selections, Step 2 user ticket details inputs.
    * **Special Behavior**: Dynamic step transition state layouts.
    * **Navigation Logic**:
      * Pushed from help hub.
      * Returns back to support hub on submit action.

33. **ReportProblemScreen**
    * **File Path**: [ReportProblemScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ReportProblemScreen.js)
    * **Route Mapping**: `/report-problem`
    * **Description**: Report bugs or interface rendering glitches.
    * **Key Components**: Category selector, description input field, attachment slot box.
    * **Navigation Logic**:
      * Pushed from help hub or privacy options.
      * Returns back on submit action.

34. **ReportViolationsScreen**
    * **File Path**: [ReportViolationsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ReportViolationsScreen.js)
    * **Route Mapping**: `/report-violations`
    * **Description**: Help hub safety options selector.
    * **Key Components**: Nav menu buttons.
    * **Navigation Logic**:
      * Pushed from help hub.
      * Navigates to `/reports`, `/safety-notices`, `/violations`.

35. **ReportsScreen**
    * **File Path**: [ReportsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ReportsScreen.js)
    * **Route Mapping**: `/reports`
    * **Description**: Lists active or resolved reports made by the user.
    * **Key Components**: Flat lists, community guidelines buttons.
    * **Navigation Logic**:
      * Pushed from report violations hub.
      * Navigates to `/community-standards`.

36. **SafetyNoticesScreen**
    * **File Path**: [SafetyNoticesScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/SafetyNoticesScreen.js)
    * **Route Mapping**: `/safety-notices`
    * **Description**: Displays text instructions on how to use the app safely.
    * **Key Components**: Safe messaging check lists layout views.
    * **Navigation Logic**:
      * Pushed from report violations hub.

37. **ViolationsScreen**
    * **File Path**: [ViolationsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ViolationsScreen.js)
    * **Route Mapping**: `/violations`
    * **Description**: Lists active user policy warnings.
    * **Key Components**: Warnings rows cards.
    * **Navigation Logic**:
      * Pushed from violations menu or warnings link in profile options.
      * Navigates to `/violation-details`.

38. **ViolationDetailsScreen**
    * **File Path**: [ViolationDetailsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ViolationDetailsScreen.js)
    * **Route Mapping**: `/violation-details`
    * **Description**: Details warning rules broken and resolution timelines.
    * **Key Components**: Penalties status list boxes, rules explanation guides.
    * **Navigation Logic**:
      * Pushed from warnings log rows.

39. **CommunityStandardsScreen**
    * **File Path**: [CommunityStandardsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/CommunityStandardsScreen.js)
    * **Route Mapping**: `/community-standards`
    * **Description**: Explains Rubaru's compliance standards.
    * **Key Components**: Scrollable text blocks.
    * **Navigation Logic**:
      * Pushed from user profile settings or reports view.

40. **ContactUsScreen**
    * **File Path**: [ContactUsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ContactUsScreen.js)
    * **Route Mapping**: `/contact-us`
    * **Description**: Submits contact tickets to support agents.
    * **Key Components**: Full name, email, subject, and text message boxes.
    * **Navigation Logic**:
      * Pushed from support hub.
      * Returns back on submit action.

41. **FeedbackScreen**
    * **File Path**: [FeedbackScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/FeedbackScreen.js)
    * **Route Mapping**: `/feedback`
    * **Description**: Submits ratings for user review collections.
    * **Key Components**: 5-star rating selector rows, description input text fields.
    * **Special Behavior**: Toggles star count ratings highlight colors dynamically. Theme-aware using `useTheme`.
    * **Navigation Logic**:
      * Pushed from support hub or user profile settings.
      * Returns back on submit action.

42. **FaqsScreen**
    * **File Path**: [FaqsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/FaqsScreen.js)
    * **Route Mapping**: `/faqs`
    * **Description**: Answers frequently asked questions.
    * **Key Components**: Scrollable FAQ category tabs (Account, Calls, Coins, Payments, Safety).
    * **Special Behavior**: Toggling questions dynamically expands or collapses answer text sections.
    * **Navigation Logic**:
      * Pushed from support hub or user profile settings.

43. **PrivacySecurityHelpScreen**
    * **File Path**: [PrivacySecurityHelpScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/PrivacySecurityHelpScreen.js)
    * **Route Mapping**: `/privacy-security-help`
    * **Description**: Explains security best practices.
    * **Key Components**: Text guidelines cards, report issue redirect shortcuts.
    * **Navigation Logic**:
      * Pushed from support hub.
      * Navigates to `/report-problem`.

44. **ScamProtectionScreen**
    * **File Path**: [ScamProtectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ScamProtectionScreen.js)
    * **Route Mapping**: `/scam-protection`
    * **Description**: Educational panels regarding dating scams.
    * **Key Components**: Checklist columns.
    * **Navigation Logic**:
      * Pushed from support hub.

---

### Legal, Settings & Info Pages

45. **PrivacyPolicyScreen**
    * **File Path**: [PrivacyPolicyScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/PrivacyPolicyScreen.js)
    * **Route Mapping**: `/privacy-policy`
    * **Description**: Displays the full privacy policy document with sections covering data collection, usage, sharing, security, children's privacy, policy changes, and contact information.
    * **Key Components**: ScrollView with numbered section headers and body text blocks, back chevron header, ImageBackground.
    * **Navigation Logic**:
      * Pushed from user profile settings sidebar (Others group) or BuyPointsScreen security footer.
      * Back arrow navigates to previous screen.

46. **TermsOfUseScreen**
    * **File Path**: [TermsOfUseScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/TermsOfUseScreen.js)
    * **Route Mapping**: `/terms-of-use`
    * **Description**: Displays the full terms of use/service document with sections covering account rules, user conduct, content policies, intellectual property, termination, disclaimers, and contact.
    * **Key Components**: ScrollView with numbered section headers and body text blocks, back chevron header, ImageBackground.
    * **Navigation Logic**:
      * Pushed from user profile settings sidebar (Others group) or BuyPointsScreen security footer.
      * Back arrow navigates to previous screen.

47. **BlockedChatsScreen**
    * **File Path**: [BlockedChatsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BlockedChatsScreen.js)
    * **Route Mapping**: `/blocked-chats`
    * **Description**: Manages blocked user contacts with search, unblock, and confirmation flows.
    * **Key Components**: Search input field, FlatList of blocked user cards with avatar/name/username/blocked date, unblock confirmation Alert dialog, empty state view.
    * **Special Behavior**: Supports search filtering by name or username. Uses localized strings via `useLanguage`. Android hardware back button intercepted.
    * **Navigation Logic**:
      * Pushed from user profile settings sidebar (Others group).
      * Back arrow navigates to previous screen.

48. **AboutUsScreen**
    * **File Path**: [AboutUsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/AboutUsScreen.js)
    * **Route Mapping**: `/about-us`
    * **Description**: Displays company information, app mission statement, feature highlights, and team details.
    * **Key Components**: App logo, mission statement card, feature cards grid (Chat, Calls, Stories, Reels, Groups), team member cards, version footer.
    * **Special Behavior**: Theme-aware using `useTheme` for dynamic colors. Android hardware back button intercepted.
    * **Navigation Logic**:
      * Pushed from user profile settings sidebar (Others group).
      * Back arrow navigates to previous screen.

49. **PermissionGrantScreen**
    * **File Path**: [PermissionGrantScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/PermissionGrantScreen.js)
    * **Route Mapping**: `/permission-grant`
    * **Description**: Displays and manages device permission toggles (Location, Camera, Microphone, Notifications, Contacts, Storage) with explanations for each permission's purpose.
    * **Key Components**: Permission toggle switches per category, explanation text blocks, ImageBackground, back chevron header.
    * **Special Behavior**: Theme-aware using `useTheme`. Uses localized strings via `useLanguage`. Android hardware back button intercepted. Switch toggles control local permission states.
    * **Navigation Logic**:
      * Pushed from user profile settings sidebar (Others group).
      * Back arrow navigates to previous screen.

---

## 5. Shared/Reusable Components Reference

The application contains **38 custom component definitions** located inside the **[src/components/](file:///c:/Users/Shubh/Desktop/Rubaru/src/components)** structure:

| Component Name | File Path | Props Accepted | Associated Screens / Usage |
| :--- | :--- | :--- | :--- |
| **OnboardingCarousel** | `src/components/OnboardingCarousel.js` | `{ scrollX, onSnapToItem }` | [OnboardingScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/OnboardingScreen.js) |
| **AIAssistMenu** | `src/components/common/AIAssistMenu.js` | `{ visible, onClose, onSelectOption }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **AttachmentSheet** | `src/components/common/AttachmentSheet.js` | `{ visible, onClose, onSelectImage, onOpenPoll }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **AvatarStack** | `src/components/common/AvatarStack.js` | `{ voters, totalVotes, isSent, maxVisible }` | [PollBubble.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/PollBubble.js) |
| **BottomTabBar** | `src/components/common/BottomTabBar.js` | `{ activeTab, onTabPress }` | Tab Pager & secondary screens (MyPoints, BuyPoints). |
| **ChatListItem** | `src/components/common/ChatListItem.js` | `{ item }` | [ChatsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ChatsScreen.js) |
| **CreatePollModal** | `src/components/common/CreatePollModal.js` | `{ visible, onClose, onCreatePoll }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **EmojiPickerSheet** | `src/components/common/EmojiPickerSheet.js` | `{ visible, onClose, onSelectEmoji }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **EmptyCallLogsView** | `src/components/common/EmptyCallLogsView.js` | *None* | [CallLogsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/CallLogsScreen.js) |
| **DiscoverFiltersModal** | `src/components/common/DiscoverFiltersModal.js` | `{ visible, onClose, initialFilters, onApplyFilters }` | [ConnectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ConnectionScreen.js) |
| **EmptyStateIllustration** | `src/components/common/EmptyStateIllustration.js` | *None* | [ChatsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ChatsScreen.js) |
| **FeedCard** | `src/components/common/FeedCard.js` | `{ item }` | [HomeScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/HomeScreen.js) |
| **GalleryThumbnail** | `src/components/common/GalleryThumbnail.js` | `{ item, isSelected, onPress }` | [AddStoryScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/AddStoryScreen.js) |
| **GroupCard** | `src/components/common/GroupCard.js` | `{ item }` | [GroupsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/GroupsScreen.js) |
| **HistoryRow** | `src/components/common/HistoryRow.js` | `{ item }` | [CallInfoScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/CallInfoScreen.js) |
| **ImageBubble** | `src/components/common/ImageBubble.js` | `{ imageUri, time, isSent, isRead, onLongPress }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **IncomingCallBanner** | `src/components/common/IncomingCallBanner.js` | `{ visible, contactName, avatarUri, callType, onAccept, onDecline }` | [IncomingCallContext.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/IncomingCallContext.js) |
| **IncomingCallProvider** | `src/components/common/IncomingCallContext.js` | `{ children }` | Wrapped in [app/_layout.js](file:///c:/Users/Shubh/Desktop/Rubaru/app/_layout.js) (global context wrapper). |
| **InterestChip** | `src/components/common/InterestChip.js` | `{ label, emoji, isSelected, onPress }` | [ConnectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ConnectionScreen.js) |
| **MessageBubble** | `src/components/common/MessageBubble.js` | `{ text, time, isSent, isRead, onLongPress, reaction, replyTo }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **MessageOptionsMenu** | `src/components/common/MessageOptionsMenu.js` | `{ visible, onClose, onCopy, onDelete, onReply, onAddReaction }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **NewUserCard** | `src/components/common/NewUserCard.js` | `{ item }` | [ConnectionScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ConnectionScreen.js) |
| **NotificationRow** | `src/components/common/NotificationRow.js` | `{ item }` | [NotificationScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/NotificationScreen.js) |
| **PaymentMethodBadge** | `src/components/common/PaymentMethodBadge.js` | `{ brandName }` | [BuyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BuyPointsScreen.js) |
| **PlanCard** | `src/components/common/PlanCard.js` | `{ points, price, originalPrice, discount, description, features, isMostPopular, onPress }` | [BuyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BuyPointsScreen.js) |
| **PointsPackageRow** | `src/components/common/PointsPackageRow.js` | `{ points, price, discount, onPress }` | [MyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/MyPointsScreen.js) |
| **PointsUsageIcon** | `src/components/common/PointsUsageIcon.js` | `{ label, cost, icon, iconColor, ... }` | [MyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/MyPointsScreen.js) |
| **PollBubble** | `src/components/common/PollBubble.js` | `{ poll, onVote, onViewAll, onLongPress }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **PollResultsModal** | `src/components/common/PollResultsModal.js` | `{ visible, onClose, poll }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **QuickActionAvatar** | `src/components/common/QuickActionAvatar.js` | `{ label, imageUri, showPlus, onPress }` | [GroupsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/GroupsScreen.js) |
| **ReelItem** | `src/components/common/ReelItem.js` | `{ item, height, onBackPress }` | [ReelsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ReelsScreen.js) |
| **ReplyPreviewBar** | `src/components/common/ReplyPreviewBar.js` | `{ replyingTo, displayName, onClose }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **SegmentedNotifCallsHeader** | `src/components/common/SegmentedNotifCallsHeader.js` | `{ activeTab, onBack, onTabChange }` | Notifications, Calls, Call details. |
| **SegmentedTabs** | `src/components/common/SegmentedTabs.js` | `{ onTabChange }` | [HomeScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/HomeScreen.js) |
| **StickerPicker** | `src/components/common/StickerPicker.js` | `{ visible, onClose, onSelectSticker }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **StoryAvatar** | `src/components/common/StoryAvatar.js` | `{ name, imageUrl, isFirst }` | Home, Chats inbox screen layout. |
| **StoryModeTab** | `src/components/common/StoryModeTab.js` | `{ label, isActive, onPress }` | [AddStoryScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/AddStoryScreen.js) |
| **TrustBadge** | `src/components/common/TrustBadge.js` | `{ icon, title, subtext, iconColor, bgColor }` | [BuyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BuyPointsScreen.js) |
| **VoiceMessageBubble** | `src/components/common/VoiceMessageBubble.js` | `{ uri, duration, time, isSent, isRead, onLongPress }` | [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/[id].js) |
| **ChatHeader** | `src/components/ChatHeader.js` | `{ onBackPress, onProfilePress, title, userInitials }` | *None* (Created, available for developers). |
| **ChatEmptyState** | `src/components/ChatEmptyState.js` | *None* | *None* (Created, available for developers). |
| **CustomTabBar** | `src/components/CustomTabBar.js` | `{ activeTab, onTabPress }` | *None* (Created, available for developers). |

---

## 6. Design System / Theme

Global visual styling coordinates are owned and exported by:
* **[colors.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/theme/colors.js)** — Defines `lightColors` and `darkColors` palette objects.
* **[ThemeContext.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/theme/ThemeContext.js)** — React Context providing `isDarkMode`, `colors`, `toggleTheme()`, and `setDarkMode()`.
* **[index.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/theme/index.js)** — Exports `theme` object with colors, spacing, and borderRadius tokens, plus `ThemeProvider` and `useTheme` hook.

### Dual Theme System

The app supports two visual themes toggled from the user profile settings sidebar:

#### Light Mode (Default — Mode OFF)
* **Background**: `#FFFFFF`
* **Primary Accent**: `#FF6584` (soft pink)
* **Primary Dark**: `#F04452` (coral red)
* **Primary Light**: `#FFF0F3` / `#FFE4E8`
* **Sent Bubble**: `#FF6584` (pink)
* **Send Button**: `#FF6584`
* **Story Ring**: `#FF6584`
* **Tab Active**: `#FF6584`
* **Avatar**: Pink background with `GB` initials

#### Dark Mode (Mode ON — "Black Mode")
* **Background**: `#FFFFFF` (white background retained)
* **Primary Accent**: `#1C1C1E` (near-black)
* **Primary Dark**: `#000000` (pure black)
* **Sent Bubble**: `#1C1C1E` (dark grey)
* **Send Button**: `#1C1C1E`
* **Story Ring**: `#FF8A65` (peach)
* **Tab Active**: `#F04452`
* **Avatar**: Black background with `PS` initials
* **Buy Now / View Details buttons**: Switch to `#000000` via `useTheme` hook

### Common Color Tokens (Both Themes)
* **Text Primary**: `#111827` (light) / `#000000` (dark)
* **Text Secondary**: `#6B7280` / `#8E8E93`
* **Text Muted**: `#9CA3AF` / `#AEAEB2`
* **Surface**: `#FFFFFF`
* **Border**: `#F3F4F6` / `#F2F2F7`
* **Status Online**: `#10B981` / `#34C759`

### Spacing Guidelines
* `xs`: `4` | `sm`: `8` | `md`: `16` | `lg`: `24` | `xl`: `32` | `xxl`: `40`

### Border Radius Constants
* `sm`: `6` | `md`: `12` | `lg`: `20` | `xl`: `28` | `full`: `9999`

### Custom Typography Config
Loaded globally inside the root `_layout.js` layout framework:
* **Jaro Regular**: `Jaro_400Regular` (App logo brand headers, etc.)
* **Poppins Pack**: `Poppins_400Regular`, `Poppins_600SemiBold`, `Poppins_700Bold`, `Poppins_800ExtraBold` (Secondary titles and general body texts)
* **Inter Bold Pack**: `Inter_700Bold`, `Inter_800ExtraBold` (Numbers, keypad text buttons, pill totals)

---

## 7. Localization / i18n

The app supports bilingual localization (English and Hindi) managed through a React Context system:

* **[LanguageContext.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/localization/LanguageContext.js)** — Provides `language` state (`'en'` or `'hi'`), `setLanguage()` setter, and `t(key, fallback)` translation helper function.
* **[translations.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/localization/translations.js)** — Contains key-value translation maps for both languages covering settings labels, navigation items, profile fields, and support page strings.

### Usage Pattern
```javascript
import { useLanguage } from '../localization/LanguageContext';

const { t, language, setLanguage } = useLanguage();
// t('helpAndSupport', 'Help & Support') → returns Hindi or English string
```

### Language Toggle
The language is toggled from the user profile settings sidebar using an animated flag slider (🇺🇸/🇮🇳) that switches between `'en'` and `'hi'` values.

---

## 8. State Management

### Zustand Store
The app now has an active Zustand store implementation:

* **[pointsStore.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/pointsStore.js)** — Manages the user's in-app points balance:
  * `balance` (number) — Current points balance, default `250`.
  * `addPoints(amount)` — Adds points to the current balance.
  * `setBalance(amount)` — Sets balance to a specific amount.

### React Context Providers (wrapped in `_layout.js`)
* **ThemeProvider** — Manages `isDarkMode` state and provides theme colors.
* **LanguageProvider** — Manages `language` state (`en`/`hi`).
* **IncomingCallProvider** — Manages simulated incoming call banner state.
* **QueryClientProvider** — React Query client wrapper (no active queries yet).

---

## 9. Navigation Map

Rubaru uses file-based navigation routing (Expo Router stack) coupled with horizontal tabs paging (React Native Pager View).

```mermaid
graph TD
  A[OnboardingScreen /] --> B{Choose Option}
  B -->|Sign In| C[SignInScreen /sign-in]
  B -->|Sign Up| D[SignUpOptionsScreen /signup-options]
  
  C --> H[Main Dashboard /index - tabs]
  D --> E[Email/Phone Verification]
  E --> F[OTP Verification /otp-verification]
  F --> G[Profile Setup Flow]
  G -->|BirthdayPicker| G
  G -->|Gender| G
  G -->|Interests| G
  G -->|Sync Contacts| G
  G -->|Enable notifications| H
  
  subgraph Main Tabs Pager Screen /(tabs)
    H1[Home Tab 0]
    H2[Connection Tab 1]
    H3[Reels Tab 2]
    H4[Notification Tab 3]
    H5[Groups Tab 4]
  end

  H1 -->|Chats Icon| I[ChatsScreen /chats]
  I -->|Chat Item| J[ChatDetailRoute /chat/id]
  
  H1 -->|Story Plus| S1[AddStoryScreen /add-story]
  H1 -->|Story Avatar| S2[ViewStoryScreen /view-story]
  
  H1 -->|Profile Avatar| K[UserProfileScreen /user-profile]
  K -->|Settings| L[NotificationSettingsScreen /notification-settings]
  K -->|Edit| M[EditProfileScreen /edit-profile]
  K -->|My Points| MP[MyPointsScreen /my-points]
  MP -->|Buy Points| BP[BuyPointsScreen /buy-points]
  K -->|Help| N[HelpSupportScreen /help-support]
  K -->|Warnings| O[ViolationsScreen /violations]
  K -->|Privacy Policy| PP[PrivacyPolicyScreen /privacy-policy]
  K -->|Terms of Use| TU[TermsOfUseScreen /terms-of-use]
  K -->|Blocked Chats| BC[BlockedChatsScreen /blocked-chats]
  K -->|About Us| AU[AboutUsScreen /about-us]
  K -->|Permission Grant| PG[PermissionGrantScreen /permission-grant]
  
  N --> N1[CustomerSupportFlowScreen]
  N --> N2[ReportProblemScreen]
  N --> N3[ReportViolationsScreen]
  N --> N4[FaqsScreen]
  N --> N5[FeedbackScreen]
  N3 --> O
  O --> O1[ViolationDetailsScreen]
  
  H4 -->|Calls Segment| P[CallLogsScreen /call-logs]
  P -->|Row Tap| Q[CallInfoScreen /call-info/id]
  Q -->|Dial Button| R[ActiveCallScreen /active-call]
  P -->|Dial Icon| R
```

* **Main Tab Redirections**: Route entrypoint slot files (e.g. `app/(tabs)/connection.js`, `app/(tabs)/reels.js`, etc.) redirect path hits immediately to the root tab route `/(tabs)?tab=<tabKey>` to synchronize the horizontal pager tab index state.

---

## 10. Mock Data / Backend Status

The application operates **entirely on local mock datasets**.

### Data Sources Mapped

* **[mockCallData.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/constants/mockCallData.js)**: Contains baseline arrays defining calls logs history list items (`INITIAL_CALL_LOGS` with 9 mock rows) and call info summaries (`MOCK_CALL_HISTORY_DETAILS`).
* **[emojiData.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/utils/emojiData.js)**: Holds arrays of sorted emoji structures (Smileys, Gestures, Symbols) supporting reaction selection sheets in the conversation thread.
* **[HomeScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/HomeScreen.js)**: Contains an inline mock array (`feedCardsData`) detailing home post categories (Travel, Football, Music), captions, locations, and avatar picture addresses.
* **[ChatsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ChatsScreen.js)**: Inline arrays describing user story rows (`storiesData`) and active inbox conversations (`initialChatsData`).
* **[ReelsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ReelsScreen.js)**: Inlines `reelsData` outlining mock usernames, view counts, like counts, and vertical backdrop mock photo dimensions.
* **[GroupsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/GroupsScreen.js)**: Contains `groupsMockData` representing 13 mock gaming/gossip group cards.
* **[NotificationScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/NotificationScreen.js)**: Inlines the `notificationsData` arrays managing simulated follows and likes records.
* **[FaqsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/FaqsScreen.js)**: Houses categorized question strings lists.
* **[chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js)**: Inline mock conversation arrays (`initialMessages`) featuring initial poll choices and message logs.
* **[ViewStoryScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ViewStoryScreen.js)**: Contains `USER_STORIES` mock data with multiple stories per user (Karan, Sneha, Priya, Arjun, Meera) using Unsplash image URLs.
* **[BlockedChatsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BlockedChatsScreen.js)**: Contains `INITIAL_BLOCKED_USERS` mock data for blocked contacts list.
* **[BuyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/BuyPointsScreen.js)**: Contains `PLANS_DATA` defining 4 purchasable points tiers with prices, discounts, and feature breakdowns.
* **[MyPointsScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/MyPointsScreen.js)**: Contains `usageList` and `packageList` mock data for points usage costs and quick-buy packages.
* **[pointsStore.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/pointsStore.js)**: Zustand store with initial balance of 250 points — first active global state implementation.

### Backend Integration Requirements

1. **Environment Variables**: Configure the target API server URL in the `.env` file under `EXPO_PUBLIC_API_URL`.
2. **Axios Client**: The pre-configured Axios instance inside **[api.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/services/api.js)** is ready to handle HTTP request payloads.
3. **Query/State Hooks**: Replace local React states inside screen feeds with React Query custom hooks calling endpoints via the api service client.
4. **Real-time Messaging WebSockets**: Integrate WebSockets (or services like Firebase Cloud Messaging) to replace local memory message appends inside the chat thread screen.
5. **Real-time Calling WebRTC**: Replace call simulation intervals inside `ActiveCallScreen.js` and `IncomingCallBanner.js` with calls dialing integrations (e.g. Agora SDK, Twilio voice APIs).
6. **Camera & Media Upload**: Replace local image capture/selection with server upload endpoints for story publishing and profile photo updates.
7. **Points/Payment Gateway**: Replace simulated purchase flow with actual payment gateway integration (Razorpay, Stripe, etc.) and server-side balance management.

---

## 11. Known Limitations / TODOs

Current development stubs and boundary limits are detailed below:

* **Audio recording / Web fallbacks**: In [chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js) and [VoiceMessageBubble.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/VoiceMessageBubble.js), voice recording/playback falls back to console warnings if not supported in the hosting environment (e.g. web testing environments). Recorded voice note file buffers are kept locally and are not uploaded to any server.
* **Story publishing**: Stories are captured/edited locally but not persisted or published to any backend. The "Your Story" button simulates a publish action but data is discarded on screen exit.
* **Points economy**: Points balance is managed locally in Zustand store but resets on app restart. Purchase flow is simulated without real payment gateway integration.
* **Dark mode coverage**: Theme-aware styling is implemented in key screens (Chats, BuyPoints, PlanCard, EditProfile, FeedbackScreen, AboutUs, PermissionGrant) but some screens still use hardcoded light-mode colors.
* **TanStack Query hooks**: React Query is configured in layout wrappers, but no query calls are active.
* **Forms validation**: Support requests submission forms, bug reports, and profile name change requests compile variables in React states but do not submit to databases, resetting on screen back exits.
* **Localization coverage**: Hindi translations are available for settings and common UI labels but not all screens have been fully translated.

---

## 12. Setup & Run Instructions

Follow these instructions to run the project locally.

### Prerequisites
* Install **Node.js** (version 18 or newer recommended).
* Install **npm** (included with Node.js).
* Install the **Expo Go** application on your mobile device (iOS App Store or Android Play Store).

### Step-by-Step Guide

1. **Clone the repository**:
   ```bash
   git clone <repository_url>
   cd Rubaru
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

4. **Launch on Mobile / Simulator**:
   * **Expo Go**: Scan the QR code displayed in the terminal with your phone camera (iOS) or the scan button inside the Expo Go application (Android).
   * **Android Emulator**: Press `a` in the terminal once the development server has started.
   * **iOS Simulator**: Press `i` in the terminal once the development server has started.

### Troubleshooting
* **Font Loading Issues**: If custom fonts fail to load, stop the server and restart with cache clear commands:
  ```bash
  npx expo start --clear
  ```
* **Dependency Conflicts**: If there are module resolve errors during install, clean the cache and folders before re-running installs:
  ```bash
  rm -rf node_modules package-lock.json
  npm cache clean --force
  npm install
  ```
* **Metro Bundler Issues**: If the Metro bundler hangs or produces stale bundles, use the included fix script:
  ```bash
  .\fix_metro.bat
  ```

---

## 13. Contribution Guidelines

Guidelines for collaborating on this project:

### Branching Workflow
* The team uses feature branch workflows. Branch off `main` using descriptive feature prefixes:
  ```bash
  git checkout -b feat/chat-polls
  git checkout -b fix/call-timer-reset
  ```
* Always request a peer review from the other team member before merging pull requests back into the `main` branch.

### Architecture Ownership & Structure
* Keep route files inside the **[app/](file:///c:/Users/Shubh/Desktop/Rubaru/app)** directory extremely thin. They must only serve as wrapper entrypoints importing and returning screen layouts.
* Implement UI views inside the **[src/screens/](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens)** folder. Use the `Screen` suffix in filenames (e.g. `ChatsScreen.js`).
* Shared, reusable UI widgets (cards, buttons, popups) must be placed inside the **[src/components/common/](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common)** directory.
* Use the `useTheme` hook from `src/theme` for all new screens to ensure dark mode compatibility.
* Use the `useLanguage` hook from `src/localization/LanguageContext` for all user-facing strings to support bilingual localization.

### Code Style Conventions
* **Functional Components**: Use React functional components with ES6 syntax.
* **Import Paths**: Always use absolute path alias mappings configured in `jsconfig.json` instead of relative directories:
  ```javascript
  // Correct
  import OnboardingCarousel from '@components/OnboardingCarousel';
  import { colors } from '@theme';

  // Avoid
  import OnboardingCarousel from '../components/OnboardingCarousel';
  ```
* **Styling**: Use React Native's `StyleSheet.create` for declarations. Retrieve layout dimensions, border radius coordinates, and color hex parameters from `@theme`:
  ```javascript
  import { StyleSheet } from 'react-native';
  import { theme } from '@theme';

  const styles = StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
    },
  });
  ```
* **Theme-Aware Components**: For components that need dark mode support, use the `useTheme` hook and apply dynamic inline styles:
  ```javascript
  import { useTheme } from '../theme';

  const { colors, isDarkMode } = useTheme();
  // Use colors.textPrimary, colors.surface, etc. in style arrays
  ```
