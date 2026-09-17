# DIAGNOSIS REPORT: CALLING & VOICE MESSAGES

**Date:** September 16, 2026  
**Target Codebase:** Rubaru Mobile Client & Express/Socket.IO Backend  
**Status:** Investigation & Diagnosis Only (No Code Changes Applied)

---

# SECTION 1: Audio & Video Calling

## 1. How Calling Is Currently Built (Plain-Language Architecture)

The calling system is a custom **raw WebRTC peer-to-peer implementation** with a centralized **Socket.IO signaling layer** embedded inside the main Node.js application server. No third-party calling SDK (such as Agora, Twilio Video, Daily.co, or ZegoCloud) is present.

### A. Initiation (User A taps "Call")
1. **Trigger & Navigation**:
   * In [app/chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L928), User A taps the Call or Video icon in the header.
   * If passing through paid chat, it prompts confirmation or navigates directly to `/active-call` ([src/screens/ActiveCallScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ActiveCallScreen.js)) with route parameters: `receiverId`, `callType` (`'audio'` or `'video'`), and contact details.
2. **Controller & Local Media Request**:
   * [ActiveCallScreen.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ActiveCallScreen.js#L36) connects to [useCallController.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/hooks/useCallController.js) and the global Zustand store [useCallStore.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/callStore.js).
   * `callStore.initiateCall()` calls [webRTCService.initializeLocalMedia({ video, audio })](file:///c:/Users/Shubh/Desktop/Rubaru/src/services/webRTCService.js#L237).
   * `webRTCService.js` attempts `mediaDevices.getUserMedia({ audio: true, video })`.
   * When running in standard Expo Go or environments without compiled native binary modules, [webRTCService.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/services/webRTCService.js#L260) falls back to `SimulatedMediaStream(callType)` (which generates mock audio/video tracks that return empty URLs `toURL() => ''` and do not bind to real device hardware).
3. **Socket Initiation**:
   * `callStore.initiateCall()` emits the canonical WebSocket event `call:initiate` with `{ recipientId, callType, idempotencyKey, requestId }` via the singleton socket in [src/services/socket.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/services/socket.js).

### B. Ringing & Dispatch to Callee (User B)
1. **Signaling Server Processing**:
   * The main backend server receives `call:initiate` in [backend/socket/callingSocketHandler.js](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/callingSocketHandler.js#L39).
   * It enforces distributed rate limits, verifies wallet/paid communication balance in [callService.js](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/callService.js), creates a `CallSession` record in MongoDB, and locks the caller’s socket ID via [callLockService.js](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/callLockService.js#L74).
2. **In-App Ringing Dispatch**:
   * The server dispatches `call:incoming` (and legacy `incoming_call`) to User B's user room: `io.to('user:' + recipientId).emit('call:incoming', ...)`.
   * **Note on Push Notifications**: This transmission relies entirely on active WebSocket connectivity. If User B's application process is terminated or backgrounded without an active socket connection, no native VoIP/FCM/APNS push notification wake-up service is invoked in this flow.
   * The server marks the session status as `RINGING` and emits `call:ringing` back to User A's socket room. User A’s device triggers `callSoundService.playRingback()`.
3. **Callee Display**:
   * On User B's device, [useCallController.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/hooks/useCallController.js#L44) catches `call:incoming`, invokes `callSoundService.playRingtone()`, and displays the incoming call banner / modal ([src/components/common/IncomingCallModal.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/IncomingCallModal.js)).

### C. Acceptance & Handshake (User B accepts)
1. **Acceptance Emission**:
   * User B presses Accept. [callStore.acceptIncomingCall()](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/callStore.js#L175) stops the ringtone, requests local media tracks, and emits `call:accept` with `{ callId, requestId }`.
   * The server ([callingSocketHandler.js:137](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/callingSocketHandler.js#L137)) binds User B’s winning device socket and emits `call:accepted` to User A.
2. **SDP Offer & Answer Relay**:
   * User A catches `call:accepted` ([callStore.js:315](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/callStore.js#L315)), creates an SDP Offer via `webRTCService.createOffer()`, and emits `call:signal:offer`.
   * The server relays the offer to User B’s specific socket ([callingSocketHandler.js:319](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/callingSocketHandler.js#L319)).
   * User B catches `call:signal:offer` ([callStore.js:345](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/callStore.js#L345)), sets the remote description, creates an SDP Answer via `webRTCService.handleOfferAndCreateAnswer()`, and emits `call:signal:answer`.
   * The server relays the answer back to User A ([callingSocketHandler.js:379](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/callingSocketHandler.js#L379)). User A sets the remote description.
3. **ICE Candidate Exchange**:
   * As local ICE candidates are gathered on both devices, each client emits `call:signal:ice`.
   * The server relays candidates directly to the peer's socket ([callingSocketHandler.js:439](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/callingSocketHandler.js#L439)).
4. **Premature "Connected" State Transition**:
   * In [src/store/callStore.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/callStore.js#L210-L212) and [L333-L335](file:///c:/Users/Shubh/Desktop/Rubaru/src/store/callStore.js#L333-L335), both the caller and receiver execute a client-side timeout timer:
     ```javascript
     setTimeout(() => {
       get().emitMediaReady();
     }, 400); // 400ms on accept, 500ms on offer
     ```
   * Both clients emit `call:media-ready` to the server before verifying whether media packets or ICE transports have actually established connection.
   * Upon receiving `call:media-ready` from both sides, the backend ([callingSocketHandler.js:485](file:///c:/Users/Shubh/Desktop/Rubaru/backend/socket/callingSocketHandler.js#L485)) marks the call status as `ACTIVE` and broadcasts `call:connected` to both users.
   * Both clients display "Connected", play the connection chime, and start ticking the call duration timer (`00:01`, `00:02`...).

---

## 2. Where It Breaks: Step-by-Step Failure Trace

### Step 1: Signaling Phase
* **Status**: **Succeeds completely.**
* **Evidence**: The Socket.IO signaling exchange (`call:initiate` $\rightarrow$ `call:incoming` $\rightarrow$ `call:accept` $\rightarrow$ `call:accepted` $\rightarrow$ `call:signal:offer` $\rightarrow$ `call:signal:answer` $\rightarrow$ `call:media-ready` $\rightarrow$ `call:connected`) completes without errors. Both devices transition their state to `ACTIVE`, display the contact name, and start duration timers.

### Step 2: ICE / STUN / TURN Configuration
* **Status**: **Fails — Missing Infrastructure.**
* **Configuration Found**:
  * In [backend/services/turnService.js](file:///c:/Users/Shubh/Desktop/Rubaru/backend/services/turnService.js#L14-L28):
    ```javascript
    const turnSecret = process.env.COTURN_SECRET || process.env.TURN_SECRET;
    const turnUrls = (process.env.TURN_URLS || process.env.COTURN_URLS || 'stun:stun.l.google.com:19302');
    ...
    if (!turnSecret) {
      // Return public STUN only in development
      return {
        iceServers: [{ urls: turnUrls }],
        username: null,
        credential: null,
        expiresAt: null,
        isProductionHardened: false,
      };
    }
    ```
  * In [backend/.env](file:///c:/Users/Shubh/Desktop/Rubaru/backend/.env):
    ```env
    PORT=5000
    MONGO_URI=mongodb+srv://...
    JWT_SECRET=...
    IMAGEKIT_PUBLIC_KEY=...
    IMAGEKIT_PRIVATE_KEY=...
    IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/zjd5xircoy
    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
    FIREBASE_PROJECT_ID=dating-app-70137
    ```
* **Findings**:
  * There are **NO TURN servers configured**.
  * Neither `COTURN_SECRET`, `COTURN_URLS`, `TURN_SECRET`, nor `TURN_URLS` exist in `.env`.
  * The backend returns only Google's public STUN server (`stun:stun.l.google.com:19302`).
  * STUN allows discovery of public IP addresses on non-symmetric NATs. However, when mobile devices connect over cellular carrier networks (CGNAT, 4G, 5G) or across different Wi-Fi routers with symmetric NATs, STUN cannot establish direct peer-to-peer bindings. An intermediate TURN relay server is mathematically and architecturally required.
  * Because no TURN relay exists, WebRTC ICE candidate pairing fails (`iceConnectionState: failed`), meaning **no UDP/TCP media transport is ever opened between the two phones**.

### Step 3: Local Hardware Capture (`getUserMedia`)
* **Status**: **Fails in standard Expo Go testing environment.**
* **Evidence**:
  * The frontend uses `react-native-webrtc` (`^124.0.4`), which relies on native C++/Java/Objective-C bindings.
  * In Expo Go (which does not contain compiled `react-native-webrtc` native code), `require('react-native-webrtc')` fails.
  * In [src/services/webRTCService.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/services/webRTCService.js#L260-L264):
    ```javascript
    console.log('[WEBRTC] Running in standard Expo Go environment. Initializing simulated media stream for development & flow testing.');
    this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
    ```
  * `SimulatedMediaStream` contains stub track objects with no connection to the mobile microphone or camera hardware.

### Step 4: Remote Stream Arrival vs. UI Rendering
* **Status**: **Media never arrives (Remote track never fires).**
* **Distinction**:
  * Does the UI fail to render an arrived stream, or does media never arrive?
  * **Media never arrives.** Because there is no TURN relay, the peer connection never reaches `connected`. The underlying WebRTC `ontrack` event never fires with live RTP media packets.
  * Furthermore, even in the client fallback, `SimulatedMediaStream.toURL()` returns `""` (empty string), and [ActiveCallScreen.js:236](file:///c:/Users/Shubh/Desktop/Rubaru/src/screens/ActiveCallScreen.js#L236) checks:
    ```javascript
    {isVideoCall && remoteStream && RTCView ? (
      <RTCView streamURL={remoteStream.toURL()} ... />
    ) : ...}
    ```
  * Because `RTCView` is null (not compiled in Expo Go) and `streamURL` is empty, the screen falls back to rendering a dark linear gradient (`#0B141B`), appearing as a **completely blank screen**.
  * For audio calls, no audio packets are received over the network, resulting in **total silence**.

---

## 3. Summary of Calling Problem Classification

| Sub-system | Failure Point | Problem Classification |
| :--- | :--- | :--- |
| **NAT Traversal** | No TURN server configured in `backend/.env` | **Missing Infrastructure**: Requires provisioning Coturn or a commercial TURN provider (e.g., Twilio Network Traversal, Xirsys, Metered). |
| **Media Engine** | `react-native-webrtc` native modules missing in Expo Go | **Environment / Build Constraint**: Cannot run inside Expo Go. Requires an Expo Development Build (`npx expo run:android` / `npx expo run:ios`). |
| **Media Readiness** | `callStore.js` fires `emitMediaReady` on a fixed 400ms timer | **Code Logic Bug**: The client claims media is connected before ICE negotiation succeeds. |

---

# SECTION 2: Voice Messages

## 1. How Voice Messages Are Currently Built (Plain-Language Architecture)

The voice messaging system uses `expo-av` for native microphone audio capture, uploads files via multipart HTTP to Express, hosts them on ImageKit CDN, and renders them in chat threads via `expo-av` playback bubbles.

### A. Recording Phase
1. **User Interaction**:
   * In [app/chat/[id].js](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L785), the user presses and holds the microphone icon in the chat input bar.
2. **Capture Execution**:
   * `startRecording()` calls `Audio.requestPermissionsAsync()` to request system microphone permissions.
   * It configures audio session modes via `Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })`.
   * It creates a new recording instance via `Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)`.
   * On mobile devices, `HIGH_QUALITY` encodes audio as AAC inside an MPEG-4 container (`.m4a` format) with a sample rate of 44,100 Hz.
   * A timer interval increments `recordingTime` every second to show elapsed time in the UI.

### B. Upload & Message Creation Phase
1. **Release / Stop**:
   * When the user releases the button, `stopRecording()` executes in [app/chat/[id].js:812](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L812).
   * It executes `await recording.stopAndUnloadAsync()` and extracts the local filesystem path via `const uri = recording.getURI()`.
   * It invokes `uploadAttachment(uri, 'voice', durationString)`.
2. **Network Transmission**:
   * `uploadAttachment` in [app/chat/[id].js:631](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L631) injects an optimistic message into local state with status `'sending'`.
   * It constructs a `FormData` object containing `chatId`, `type: 'voice'`, and the file descriptor:
     ```javascript
     formData.append('attachment', {
       uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
       name: 'file.m4a',
       type: 'audio/m4a',
     });
     ```
   * It issues an HTTP `POST /api/chats/message` to the backend server.
3. **Server Processing & Storage**:
   * In [backend/routes/chatRoutes.js:22](file:///c:/Users/Shubh/Desktop/Rubaru/backend/routes/chatRoutes.js#L22), the endpoint is intercepted by Multer disk storage ([backend/middleware/upload.js](file:///c:/Users/Shubh/Desktop/Rubaru/backend/middleware/upload.js)), which writes the incoming stream into `backend/uploads/audio/`.
   * In [backend/controllers/chatController.js:264](file:///c:/Users/Shubh/Desktop/Rubaru/backend/controllers/chatController.js#L264), the controller detects `audio/` MIME type and uploads the local file to ImageKit:
     ```javascript
     const uploaded = await imagekitService.uploadLocalFile(
       req.file.path,
       req.file.filename,
       imagekitService.FOLDERS.CHAT,
       ['chat', 'voice', targetChatId.toString()]
     );
     attachmentUri = uploaded.url;
     ```
   * A `Message` document is saved in MongoDB with:
     ```javascript
     {
       chat: targetChatId,
       conversationId: targetChatId,
       sender: req.user._id,
       type: 'voice',
       text: '',
       attachmentUri: 'https://ik.imagekit.io/zjd5xircoy/rubaru/chat/...',
       isRead: false
     }
     ```
   * The server broadcasts `receive_message` with the ImageKit URL to all conversation participants over Socket.IO.

### C. Playback Phase (Receiving End)
1. **Formatting & Delivery**:
   * When messages load or arrive over the socket, [formatServerMessage](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L110) extracts:
     ```javascript
     voiceUri: (m.type === 'voice' || m.type === 'audio') ? getFullUrl(m.attachmentUri) : undefined
     ```
2. **Component Rendering**:
   * The chat `FlatList` renders [VoiceMessageBubble.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/VoiceMessageBubble.js) with `uri={item.voiceUri}`.
3. **Audio Playback**:
   * When the recipient taps Play, `handlePlayPause()` calls:
     ```javascript
     const { sound: newSound } = await Audio.Sound.createAsync(
       { uri },
       { shouldPlay: true },
       onPlaybackStatusUpdate
     );
     ```
   * The device streams the `.m4a` file from the ImageKit CDN endpoint and renders real-time progress.

---

## 2. Where It Breaks: Step-by-Step Failure Trace

### Stage 1: Recording
* **Status**: **Failed during initial manual testing due to two distinct code bugs.**
* **Root Causes Identified**:
  1. **The Audio Helper Stub**:
     * In [src/services/audioHelper.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/services/audioHelper.js), the module imported both `expo-audio` and `expo-av`.
     * Because `expo-audio` was present in `package.json`, `audioHelper.js` selected the `ExpoAudio` branch.
     * However, the `ExpoAudio` branch defined `Recording.createAsync()` as a non-functional stub:
       ```javascript
       Recording: {
         createAsync: async () => ({
           recording: {
             stopAndUnloadAsync: async () => {},
             getURI: () => null,
           }
         })
       }
       ```
     * When a user recorded audio on a real phone, `recording.getURI()` returned `null`.
     * In [app/chat/[id].js:632](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L632):
       ```javascript
       const uploadAttachment = async (uri, type, duration = '') => {
         if (!uri) return; // Silent abortion
       ```
     * Because `uri` was `null`, the function exited immediately. No audio file was created, no upload was initiated, and the recorded note disappeared silently upon release.
  2. **Paid Chat Gating Block**:
     * In [app/chat/[id].js:786](file:///c:/Users/Shubh/Desktop/Rubaru/app/chat/%5Bid%5D.js#L786), `startRecording` had a gate: `if (!isPaidActive) { handleOpenPaidConfirm('MESSAGE'); return; }`.
     * Because `isPaidActive` defaulted to `false`, new users attempting to record were blocked by an unexpected coin-payment modal.

### Stage 2: Upload
* **Status**: **Verified working once a valid URI is provided.**
* **Evidence from Live Endpoint Test**:
  * We dispatched a live multipart HTTP POST to `http://127.0.0.1:5000/api/chats/message` with an active test JWT and a 1,024-byte `.m4a` audio payload:
    ```text
    HTTP Status: 201 Created
    Response: {
      "type": "voice",
      "attachmentUri": "https://ik.imagekit.io/zjd5xircoy/rubaru/chat/attachment-1789549697950-591436996_LA0o8mxfC.m4a",
      "chat": "6aaa3250bc89d1509c1b4f85"
    }
    ```
  * The backend successfully accepted the multipart upload, stored the temporary file, uploaded it to ImageKit cloud storage, and returned a permanent CDN URL.

### Stage 3: Message Creation
* **Status**: **Verified working.**
* **Evidence**:
  * MongoDB document verification confirms the message was created in the `Message` collection with `type: 'voice'`, non-null `attachmentUri`, sequence number `16`, and correct conversation ID.

### Stage 4: Playback
* **Status**: **CDN file resolution verified; playback controller requires `expo-av`.**
* **Evidence**:
  * Direct HTTP GET request to the ImageKit URL returned:
    ```text
    Status: 200 OK
    Content-Type: audio/x-m4a
    Content-Length: 1024
    ```
  * The file is publicly accessible with valid audio headers.
  * **Playback Caveat**: In [VoiceMessageBubble.js](file:///c:/Users/Shubh/Desktop/Rubaru/src/components/common/VoiceMessageBubble.js#L54), `Audio.Sound.createAsync` passes an `onPlaybackStatusUpdate` callback to animate the progress bar and timer. If `expo-audio`'s wrapper is used instead of `expo-av`, `onPlaybackStatusUpdate` is dropped, causing the audio to play without visual progress feedback. When `expo-av` is used directly, playback and progress tracking work as designed.

---

## 3. Summary of Voice Messages Problem Classification

| Sub-system | Failure Point | Problem Classification |
| :--- | :--- | :--- |
| **Audio Capture** | `audioHelper.js` recording stub returning `null` URI | **Code Bug**: `expo-audio` branch was used for recording instead of `expo-av`. |
| **UI Interaction** | Mandatory `isPaidActive` gate blocking `startRecording` | **Product Logic Bug**: Strict coin payment requirement prevented free voice notes. |
| **Storage & CDN** | Multer $\rightarrow$ ImageKit upload pipeline | **Operational / Healthy**: No bugs found; 201 responses and 200 CDN downloads verified. |
| **Playback Controller** | Missing `onPlaybackStatusUpdate` in `expo-audio` shim | **Code Bug**: Shim dropped status updates needed for waveform progress. |

---

# SECTION 3: Executive Comparison & Diagnostic Summary

| Feature | Primary Failure Stage | Root Cause | Problem Class | What Is Required to Resolve |
| :--- | :--- | :--- | :--- | :--- |
| **Audio Calling** | Media Flow (RTP Transport) | No TURN server configured (`COTURN_SECRET` missing in `.env`). STUN alone fails across cellular/NAT networks. | **Missing Infrastructure** | Provision a TURN relay server (e.g., Coturn or Twilio Network Traversal) and add credentials to backend `.env`. |
| **Video Calling** | Native WebRTC Engine & Media Flow | 1. Missing TURN server (cross-network transport fails).<br>2. `react-native-webrtc` binary modules cannot run inside standard Expo Go. | **Missing Infrastructure & Build Constraint** | 1. Provision TURN server in backend.<br>2. Build and run a native development client (`npx expo run:android` / `run:ios`), not Expo Go. |
| **Voice Messages** | Recording & URI Generation | `audioHelper.js` had a dummy stub for `Recording.createAsync` returning `getURI: () => null`. Also blocked by paid chat gate. | **Code Bug** | Ensure `expo-av` is explicitly prioritized for recording capture, and remove mandatory paid gating from chat input handlers. |

### Key Takeaway for Decisions
* **Voice Messaging** is a **100% code-level issue** — the server, database, Multer upload pipeline, and ImageKit CDN integration are already operational and validated.
* **Audio & Video Calling** is **NOT purely a code issue**. While the signaling code works, calling will **never function on real mobile devices across cellular or separate Wi-Fi networks without a TURN server**, and video rendering cannot function inside the standard Expo Go client without building native binaries.
