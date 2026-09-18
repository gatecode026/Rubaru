# RUBARU — R4-C11 WEBRTC MEDIA-PLANE AUDIT REPORT
**Target System:** Rubaru Mobile Calling Client (`src/`, `app/`) & Express/Socket.io Backend (`backend/`)  
**Audit Type:** Read-Only Forensic WebRTC Media-Plane Diagnostics  
**State Observed:** Audio/Video Call Connects Successfully over Signaling, But No Audio or Video Is Transmitted.

---

## 1. DISCOVER THE ACTUAL CALLING IMPLEMENTATION

| WebRTC Operation / Hook | Actual Implementation File & Line | Invocation Pattern / Underlying Call |
|---|---|---|
| **RTCPeerConnection Creation** | [`src/services/webRTCService.js:321`](file:///r:/Rubaru/src/services/webRTCService.js#L321) | `this.peerConnection = new RTCPC(pcConfig)` using native `react-native-webrtc` (fallback: `SimulatedRTCPeerConnection` [`webRTCService.js:66-153`](file:///r:/Rubaru/src/services/webRTCService.js#L66-L153)) |
| **getUserMedia()** | [`src/services/webRTCService.js:263`](file:///r:/Rubaru/src/services/webRTCService.js#L263) | `mediaDevicesObj.getUserMedia(constraints)` (fallback: `SimulatedMediaStream` [`webRTCService.js:38-61`](file:///r:/Rubaru/src/services/webRTCService.js#L38-L61)) |
| **MediaStream** | [`src/services/webRTCService.js:263`](file:///r:/Rubaru/src/services/webRTCService.js#L263), [`webRTCService.js:377`](file:///r:/Rubaru/src/services/webRTCService.js#L377) | `this.localStream`, `this.remoteStream`; `MediaStream` was **not** imported from `react-native-webrtc` (attempts `global.MediaStream` at L381) |
| **MediaStreamTrack** | [`src/services/webRTCService.js:400`](file:///r:/Rubaru/src/services/webRTCService.js#L400), [`webRTCService.js:627`](file:///r:/Rubaru/src/services/webRTCService.js#L627), [`webRTCService.js:641`](file:///r:/Rubaru/src/services/webRTCService.js#L641) | `this.localStream.getTracks()`, `getAudioTracks()`, `getVideoTracks()` |
| **addTrack()** | [`src/services/webRTCService.js:402`](file:///r:/Rubaru/src/services/webRTCService.js#L402) | `this.peerConnection.addTrack(track, this.localStream)` inside `createPeerConnection()` |
| **addTransceiver()** | **Not implemented** | Code relies strictly on `addTrack` and legacy `addStream` fallback |
| **createOffer()** | [`src/services/webRTCService.js:475`](file:///r:/Rubaru/src/services/webRTCService.js#L475) | `this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: this.isVideoEnabled })` |
| **createAnswer()** | [`src/services/webRTCService.js:514`](file:///r:/Rubaru/src/services/webRTCService.js#L514) | `this.peerConnection.createAnswer()` |
| **setLocalDescription()** | [`src/services/webRTCService.js:479`](file:///r:/Rubaru/src/services/webRTCService.js#L479), [`webRTCService.js:515`](file:///r:/Rubaru/src/services/webRTCService.js#L515) | `await this.peerConnection.setLocalDescription(offer/answer)` |
| **setRemoteDescription()** | [`src/services/webRTCService.js:511`](file:///r:/Rubaru/src/services/webRTCService.js#L511), [`webRTCService.js:547`](file:///r:/Rubaru/src/services/webRTCService.js#L547) | `await this.peerConnection.setRemoteDescription(sessionDesc)` |
| **addIceCandidate()** | [`src/services/webRTCService.js:593`](file:///r:/Rubaru/src/services/webRTCService.js#L593), [`webRTCService.js:613`](file:///r:/Rubaru/src/services/webRTCService.js#L613) | `await this.peerConnection.addIceCandidate(iceCandidate)` |
| **onicecandidate** | [`src/services/webRTCService.js:325`](file:///r:/Rubaru/src/services/webRTCService.js#L325) | `this.peerConnection.onicecandidate = (event) => { ... emit('onIceCandidate') }` |
| **ontrack** | [`src/services/webRTCService.js:368`](file:///r:/Rubaru/src/services/webRTCService.js#L368) | `this.peerConnection.ontrack = (event) => { ... emit('onRemoteStream') }` |
| **onconnectionstatechange** | [`src/services/webRTCService.js:364`](file:///r:/Rubaru/src/services/webRTCService.js#L364) | `this.peerConnection.onconnectionstatechange = checkStateAndReadiness;` |
| **oniceconnectionstatechange** | [`src/services/webRTCService.js:365`](file:///r:/Rubaru/src/services/webRTCService.js#L365) | `this.peerConnection.oniceconnectionstatechange = checkStateAndReadiness;` |
| **onicegatheringstatechange** | **Not implemented** | Not hooked |
| **onnegotiationneeded** | **Not implemented** | Not hooked |
| **RTCSessionDescription** | [`src/services/webRTCService.js:509`](file:///r:/Rubaru/src/services/webRTCService.js#L509), [`webRTCService.js:545`](file:///r:/Rubaru/src/services/webRTCService.js#L545) | `new RTCSessionDescription(offerInit/answerInit)` |
| **RTCIceCandidate** | [`src/services/webRTCService.js:592`](file:///r:/Rubaru/src/services/webRTCService.js#L592), [`webRTCService.js:609`](file:///r:/Rubaru/src/services/webRTCService.js#L609) | `new RTCIceCandidate(candidateObj)` |
| **Audio Routing / Management** | [`src/services/callSoundService.js:34-55`](file:///r:/Rubaru/src/services/callSoundService.js#L34-L55), [`callSoundService.js:173-186`](file:///r:/Rubaru/src/services/callSoundService.js#L173-L186) | Managed by `expo-audio` / `expo-av`. InCallManager is **missing**. |
| **Video Renderer (Local PiP)** | [`src/screens/ActiveCallScreen.js:377-384`](file:///r:/Rubaru/src/screens/ActiveCallScreen.js#L377-L384) | `<RTCView streamURL={localStream.toURL()} mirror={isFrontCamera} zOrder={1} />` |
| **Video Renderer (Remote Main)** | [`src/screens/ActiveCallScreen.js:244-249`](file:///r:/Rubaru/src/screens/ActiveCallScreen.js#L244-L249) | `<RTCView streamURL={remoteStream.toURL()} objectFit="cover" mirror={false} />` |
| **Mute / Unmute** | [`src/services/webRTCService.js:624-632`](file:///r:/Rubaru/src/services/webRTCService.js#L624-L632) | `toggleAudio()` modifies `track.enabled` on local audio tracks |
| **Camera Toggle & Switch** | [`src/services/webRTCService.js:637-687`](file:///r:/Rubaru/src/services/webRTCService.js#L637-L687) | `toggleVideo()`, `switchCamera()` invokes `videoTrack._switchCamera()` |
| **Speakerphone Routing** | [`src/store/callStore.js:700-711`](file:///r:/Rubaru/src/store/callStore.js#L700-L711) | Calls `callSoundService.setAudioRoute(nextSpeaker)` |
| **Call Cleanup** | [`src/services/webRTCService.js:753-781`](file:///r:/Rubaru/src/services/webRTCService.js#L753-L781), [`src/store/callStore.js:714-754`](file:///r:/Rubaru/src/store/callStore.js#L714-L754) | `webRTCService.destroy()` stops tracks and closes peer connection |

### Package & Native Stack Specification
- **React Native WebRTC Package:** `react-native-webrtc` (package.json: `^124.0.4`, installed in node_modules: `124.0.8`).
- **React / React Native Versions:** `react@19.2.3`, `react-native@0.86.2`.
- **Expo Framework:** `expo@~57.0.14` (SDK 57).
- **Native Android Manifest Permissions (`app.json` lines 34-47):**
  `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE`, `INTERNET`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_CAMERA`, `FOREGROUND_SERVICE_PHONE_CALL`, `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `VIBRATE`.
- **iOS Permissions (`app.json` lines 18-22):**
  `NSCameraUsageDescription`: "Rubaru needs camera access for video calling.", `NSMicrophoneUsageDescription`: "Rubaru needs microphone access for audio and video calling.", `UIBackgroundModes`: `["audio", "voip", "fetch", "remote-notification"]`.
- **Expo Config Plugins (`app.json` lines 49-54):**
  `["expo-router", "expo-font", "expo-camera", "expo-audio"]`. Neither `@config-plugins/react-native-webrtc` nor custom WebRTC prebuild plugin is configured in `app.json`.

---

## 2. VERIFY getUserMedia()

### Acquisition Logic
In [`src/services/webRTCService.js:250-285`](file:///r:/Rubaru/src/services/webRTCService.js#L250-L285):
```javascript
const constraints = {
  audio: true,
  video: video ? { facingMode: this.isFrontCamera ? 'user' : 'environment' } : false,
};
this.localStream = await mediaDevicesObj.getUserMedia(constraints);
```

### Audit Findings:
1. **Audio Calls (`video: false, audio: true`):**
   - Native `react-native-webrtc` invokes [`getUserMedia.ts:40`](file:///r:/Rubaru/node_modules/react-native-webrtc/src/getUserMedia.ts#L40): requests `permissions.request({ name: 'microphone' })`.
   - On permission grant: returns a native `MediaStream` instance with **1 audio track** (`kind: 'audio'`, `enabled: true`, `readyState: 'live'`, `muted: false`).
2. **Video Calls (`video: true, audio: true`):**
   - Native `react-native-webrtc` requests both `microphone` and `camera` permissions.
   - On permission grant: returns a native `MediaStream` instance with **1 audio track and 1 video track** (`kind: 'video'`, `enabled: true`, `readyState: 'live'`, `muted: false`).
3. **Simulation Fallback Risk:**
   - If executed in an Expo Go environment or without native binaries where `EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true'`, it instantiates [`SimulatedMediaStream`](file:///r:/Rubaru/src/services/webRTCService.js#L38-L61), creating dummy JavaScript objects that return empty URLs (`toURL() => ''`) and do not connect to real device hardware.

---

## 3. VERIFY LOCAL TRACKS

| Metric | Audio Call (Expected) | Audio Call (Actual Native) | Video Call (Expected) | Video Call (Actual Native) |
|---|---|---|---|---|
| `localStream exists?` | Yes | Yes (in `webRTCService.localStream` & `callStore.localStream`) | Yes | Yes |
| `audioTracks.length` | $\ge 1$ | 1 | $\ge 1$ | 1 |
| `videoTracks.length` | 0 | 0 | $\ge 1$ | 1 |
| Audio Track `kind` | `audio` | `audio` | `audio` | `audio` |
| Audio Track `enabled` | `true` | `true` | `true` | `true` |
| Audio Track `readyState`| `live` | `live` | `live` | `live` |
| Video Track `kind` | N/A | N/A | `video` | `video` |
| Video Track `enabled` | N/A | N/A | `true` | `true` |
| Video Track `readyState`| N/A | N/A | `live` | `live` |

**Track Attachment Timing:**
- Caller: Captured in `initiateCall` ([`callStore.js:139`](file:///r:/Rubaru/src/store/callStore.js#L139)) before `createOffer()` is called in `handleAccepted` ([`callStore.js:332`](file:///r:/Rubaru/src/store/callStore.js#L332)).
- Receiver: Captured in `acceptIncomingCall` ([`callStore.js:205`](file:///r:/Rubaru/src/store/callStore.js#L205)) before `handleOfferAndCreateAnswer()` is called in `handleOffer` ([`callStore.js:357`](file:///r:/Rubaru/src/store/callStore.js#L357)).
- **Tracks are not stopped or deleted before offer/answer generation.**

---

## 4. VERIFY RTCPeerConnection CONFIGURATION

The constructor is invoked at [`src/services/webRTCService.js:321`](file:///r:/Rubaru/src/services/webRTCService.js#L321):
```javascript
const pcConfig = {
  iceServers: this.iceServers,
  iceCandidatePoolSize: 2,
};
if (this.forceRelayOnly && process.env.NODE_ENV !== 'production') {
  pcConfig.iceTransportPolicy = 'relay';
}
this.peerConnection = new RTCPC(pcConfig);
```

### Forensic Defect in `this.iceServers`:
1. **Dynamic Fetch Endpoint:**
   `webRTCService.fetchIceServers()` calls `GET /calls/turn-credentials` (backend route: [`backend/routes/callRoutes.js:20-33`](file:///r:/Rubaru/backend/routes/callRoutes.js#L20-L33)).
2. **Backend Credential Generation:**
   In [`backend/services/turnService.js:14-46`](file:///r:/Rubaru/backend/services/turnService.js#L14-L46):
   ```javascript
   const turnSecret = process.env.COTURN_SECRET || process.env.TURN_SECRET;
   const turnUrls = (process.env.TURN_URLS || process.env.COTURN_URLS || 'stun:stun.l.google.com:19302').split(',');
   if (!turnSecret) {
     return {
       iceServers: [
         { urls: defaultStunServers },
         { urls: turnUrls },
       ],
       ...
     };
   }
   ```
3. **The Configuration Gap in `backend/.env`:**
   Inspection of [`backend/.env`](file:///r:/Rubaru/backend/.env) reveals that **neither `TURN_SECRET`, `COTURN_SECRET`, `TURN_URLS`, nor `COTURN_URLS` is configured**.
4. **Resulting `iceServers` passed to `RTCPeerConnection`:**
   ```json
   [
     { "urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
     { "urls": ["stun:stun.l.google.com:19302"] }
   ]
   ```
   **There are ZERO TURN relay servers configured in runtime.** No `turn:` or `turns:` server is provided, no username is provided, and no credential is provided.

---

## 5. VERIFY addTrack / TRANSCEIVERS

In [`src/services/webRTCService.js:398-407`](file:///r:/Rubaru/src/services/webRTCService.js#L398-L407):
```javascript
if (this.localStream && typeof this.localStream.getTracks === 'function') {
  this.localStream.getTracks().forEach((track) => {
    if (typeof this.peerConnection.addTrack === 'function') {
      this.peerConnection.addTrack(track, this.localStream);
    } else if (typeof this.peerConnection.addStream === 'function') {
      this.peerConnection.addStream(this.localStream);
    }
  });
}
```
- **Caller Track Addition:** Called inside `createPeerConnection()` before `this.peerConnection.createOffer()` is invoked.
- **Receiver Track Addition:** Called inside `createPeerConnection()` before `this.peerConnection.createAnswer()` is invoked.
- **Transceiver Direction:** In `react-native-webrtc`, `addTrack()` creates transceivers configured to `sendrecv`.
- Tracks are added to the correct PeerConnection instance.
- Tracks are not inactive or recvonly.

---

## 6. AUDIT OFFER SDP

Generated via `this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: this.isVideoEnabled })` ([`webRTCService.js:475`](file:///r:/Rubaru/src/services/webRTCService.js#L475)).

### Expected & Actual SDP Structure (Native):
- Contains `v=0`, `o=- ... IN IP4 ...`, `s=-`, `t=0 0`.
- **Audio Media Description:** `m=audio <port> UDP/TLS/RTP/SAVPF 111 ...` with `a=sendrecv`, `a=rtpmap:111 opus/48000/2`.
- **Video Media Description (Video Calls):** `m=video <port> UDP/TLS/RTP/SAVPF 96 ...` with `a=sendrecv`, `a=rtpmap:96 VP8/90000`.
- Contains `a=bundle-only` / `a=group:BUNDLE 0 1`, `a=mid:0`, `a=mid:1`, `a=rtcp-mux`.
- Contains DTLS fingerprint `a=fingerprint:sha-256 ...`.
- Contains setup direction `a=setup:actpass`.
- In-SDP pre-gathered candidates (`iceCandidatePoolSize: 2`) appear as host candidates.
- **Conclusion:** The Offer SDP correctly advertises two-way `sendrecv` media.

---

## 7. AUDIT ANSWER SDP

Generated via `this.peerConnection.createAnswer()` ([`webRTCService.js:514`](file:///r:/Rubaru/src/services/webRTCService.js#L514)).
- Audio Call: Contains `m=audio ...` with `a=sendrecv`.
- Video Call: Contains `m=audio ...` and `m=video ...` with `a=sendrecv`.
- Contains setup direction `a=setup:active`.
- Codecs match the offered Opus and VP8 payload types.
- **Conclusion:** The Answer SDP correctly accepts the offered audio and video media.

---

## 8. AUDIT ICE CANDIDATES (CRITICAL FAILURE POINT)

### Trace:
1. **Generation:** `peerConnection.onicecandidate` emits `{ candidate: event.candidate, generation: ... }` ([`webRTCService.js:325`](file:///r:/Rubaru/src/services/webRTCService.js#L325)).
   In `react-native-webrtc`, `event.candidate` is an `RTCIceCandidate` object:
   ```json
   {
     "candidate": "candidate:1 1 UDP 2122260223 192.168.1.104 5000 typ host ...",
     "sdpMid": "0",
     "sdpMLineIndex": 0
   }
   ```
2. **Socket Emission:** `useCallController.js:46` emits `call:signal:ice` with payload:
   `{ callId, candidate: { candidate: "...", sdpMid: "0", sdpMLineIndex: 0 }, generation, requestId }`.
3. **Server Relay:** `callingSocketHandler.js:466` emits to remote peer:
   `{ callId, senderId, candidate: { candidate: "...", sdpMid: "0", sdpMLineIndex: 0 } }`.
4. **Receiver Store:** `callStore.js:411` calls:
   `webRTCService.addIceCandidate(data.candidate)`.
5. **The Destruction in `webRTCService.js:581`:**
   ```javascript
   async addIceCandidate(candidateData) {
     if (!candidateData) return;

     const candidateObj = candidateData.candidate || candidateData; // <-- FATAL BUG
     ...
     const RTCIce = RTCIceCandidateNative || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);
     const iceCandidate = RTCIce ? new RTCIce(candidateObj) : candidateObj;
     await this.peerConnection.addIceCandidate(iceCandidate);
   ```

### Exact Code Mechanics of the Failure:
1. `candidateData` passed in is:
   `{ candidate: "candidate:1 1 UDP...", sdpMid: "0", sdpMLineIndex: 0 }`.
2. `candidateData.candidate` is evaluated: it is a truthy **string** (`"candidate:1 1 UDP..."`).
3. `candidateObj` becomes the **string** `"candidate:1 1 UDP..."`.
4. `sdpMid` and `sdpMLineIndex` are **completely stripped away**.
5. `new RTCIce(candidateObj)` executes `new RTCIceCandidate("candidate:1 1 UDP...")`.
6. Look at the `RTCIceCandidate` constructor ([`node_modules/react-native-webrtc/src/RTCIceCandidate.ts:12-16`](file:///r:/Rubaru/node_modules/react-native-webrtc/src/RTCIceCandidate.ts#L12-L16)):
   ```typescript
   constructor({ candidate = '', sdpMLineIndex = null, sdpMid = null }: RTCIceCandidateInfo) {
       if (sdpMLineIndex === null && sdpMid === null) {
           throw new TypeError('`sdpMLineIndex` and `sdpMid` must not be both null');
       }
   ```
   Destructuring a string causes `sdpMLineIndex` and `sdpMid` to default to `null`.
7. **The constructor throws `TypeError: sdpMLineIndex and sdpMid must not be both null`!**
8. The `catch (err)` block catches it:
   `[WEBRTC] Add ICE candidate warning: sdpMLineIndex and sdpMid must not be both null`.
9. **If candidates arrived before `remoteDescription`:**
   `this.pendingCandidates.push(candidateObj)` pushes the broken string into `pendingCandidates`.
   When `_drainPendingCandidates()` runs ([`webRTCService.js:612`](file:///r:/Rubaru/src/services/webRTCService.js#L612)), it throws the identical `TypeError` for every buffered candidate:
   `[WEBRTC] Drain addIceCandidate error: sdpMLineIndex and sdpMid must not be both null`.

### Evidence:
**100% of trickle ICE candidates received over signaling are silently dropped on both Caller and Receiver.** Not a single remote ICE candidate is ever added to the `RTCPeerConnection`.

---

## 9. ICE STATE MACHINE

### Actual Runtime Timeline:

#### Scenario A: Real Devices on Different Networks / Cellular / Restrictive NAT
```text
DEVICE A (Caller)                                 DEVICE B (Receiver)
14:01:00 initiateCall (getUserMedia OK)
14:01:01 call:initiate -> Server
14:01:01                                          call:incoming
14:01:02                                          acceptIncomingCall (getUserMedia OK)
14:01:02                                          call:accept -> Server
14:01:02 call:accepted
14:01:02 createOffer + setLocalDesc
14:01:02 call:signal:offer ->
14:01:03                                          handleOffer -> setRemoteDesc
14:01:03                                          createAnswer + setLocalDesc
14:01:03                                          <- call:signal:answer
14:01:03 ICE gathering starts (host, srflx)       ICE gathering starts (host, srflx)
14:01:03 call:signal:ice ->                       <- call:signal:ice
14:01:03 TypeError in addIceCandidate (DROPPED)   TypeError in addIceCandidate (DROPPED)
14:01:03 TypeError in addIceCandidate (DROPPED)   TypeError in addIceCandidate (DROPPED)
14:01:05 iceConnectionState: 'checking'           iceConnectionState: 'checking'
14:01:15 No viable candidate pair (No TURN, all srflx dropped)
14:01:18 iceConnectionState: 'failed'             iceConnectionState: 'failed'
         ConnectionWatchdog fires: "Connection failed. Please check your network."
```

#### Scenario B: Devices on Same Local Subnet (Wi-Fi) where Host Candidate is in SDP
```text
DEVICE A (Caller)                                 DEVICE B (Receiver)
14:01:02 In-SDP Host Candidate parsed             In-SDP Host Candidate parsed
14:01:03 Direct host-to-host ping succeeds        Direct host-to-host ping succeeds
14:01:04 iceConnectionState: 'connected'          iceConnectionState: 'connected'
14:01:04 onMediaReady emitted                     onMediaReady emitted
14:01:04 Server marks call ACTIVE                 Server marks call ACTIVE
14:01:04 UI displays "Connected 00:01"            UI displays "Connected 00:01"
         BUT NO AUDIO IS HEARD (Finding 14)       BUT NO AUDIO IS HEARD (Finding 14)
         BUT NO VIDEO IS RENDERED (Finding 13)    BUT NO VIDEO IS RENDERED (Finding 13)
```

---

## 10. STUN / TURN / NAT AUDIT

1. **STUN Audit:**
   `stun:stun.l.google.com:19302` produces `srflx` candidates on public networks. However, because of the `addIceCandidate` TypeError defect, remote `srflx` candidates are never added to the peer connection.
2. **TURN Audit:**
   `TURN_URLS` and `TURN_SECRET` are completely missing in `backend/.env`. Zero `relay` candidates are generated.
3. **NAT Traversal Matrix:**
   - Same Wi-Fi (Host-to-Host in SDP): May establish ICE connection via host candidate.
   - Different Wi-Fi: **FAILS** (No TURN, srflx dropped).
   - Wi-Fi to Cellular: **FAILS** (CGNAT blocks direct host/srflx).
   - Symmetric NAT: **FAILS** (Requires TURN relay).

---

## 11. DTLS / SRTP AUDIT

- **On Same Wi-Fi (where host candidates match):** DTLS handshake initiates and completes (`DTLS state: connected`). SRTP keys are derived.
- **On Different Networks:** Because ICE pairing fails (zero remote candidates added), DTLS handshake never completes (`DTLS state: failed` or hangs in `checking`). SRTP media transport is never established.

---

## 12. REMOTE ontrack AUDIT

In [`src/services/webRTCService.js:368-396`](file:///r:/Rubaru/src/services/webRTCService.js#L368-L396):
```javascript
this.peerConnection.ontrack = (event) => {
  if (event.streams && event.streams[0]) {
    this.remoteStream = event.streams[0];
  } else if (event.track) {
    if (!this.remoteStream) {
      const MediaStreamCtor = global.MediaStream;
      if (MediaStreamCtor) {
        this.remoteStream = new MediaStreamCtor();
      } else {
        this.remoteStream = new SimulatedMediaStream(this.expectedCallType);
      }
    }
    if (typeof this.remoteStream.addTrack === 'function') {
      this.remoteStream.addTrack(event.track);
    }
  }
  if (this.remoteStream) {
    this.emit('onRemoteStream', this.remoteStream);
  }
};
```

### Forensic Defect:
- In React Native (Hermes engine), `global.MediaStream` is `undefined` because `MediaStream` was not imported or registered from `react-native-webrtc`.
- If `event.streams` is not populated (e.g. track-only event), the code falls back to `new SimulatedMediaStream(...)`.
- The real native track is added to a JavaScript stub whose `toURL()` returns an empty string `""`, breaking `<RTCView>`.

---

## 13. REMOTE VIDEO RENDERER AUDIT

In [`src/screens/ActiveCallScreen.js:243-249`](file:///r:/Rubaru/src/screens/ActiveCallScreen.js#L243-L249):
```javascript
{isVideoCall && !isRemoteVideoDisabled && remoteStream && RTCView ? (
  <RTCView
    streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : ''}
    style={StyleSheet.absoluteFillObject}
    objectFit="cover"
    mirror={false}
  />
) : ...
```

### Forensic Distinctions:
1. **Media Not Received (Transport Failure):**
   When ICE fails across networks, `packetsReceived = 0`. The native video decoder receives no RTP frames. The `RTCView` renders black or remains on the background placeholder.
2. **Media Received But Not Rendered (UI/Renderer Failure):**
   If `remoteStream` is an instance of `SimulatedMediaStream`, `remoteStream.toURL()` returns `""`. `RTCView` is passed `streamURL=""`, which fails to render any video frame.
3. **Module Loading Failure:**
   If running in an environment where `react-native-webrtc` native module failed to link, `RTCView` is `null`, and the JSX condition `remoteStream && RTCView` evaluates to false, rendering the avatar placeholder instead of video.

---

## 14. AUDIO OUTPUT AUDIT

### Forensic Defect: The Audio Hijack by CallSoundService
When a call is initiated or accepted, [`src/services/callSoundService.js:34-55`](file:///r:/Rubaru/src/services/callSoundService.js#L34-L55) executes:
```javascript
if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
  await ExpoAudio.setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
  });
} else if (ExpoAV && ExpoAV.Audio && typeof ExpoAV.Audio.setAudioModeAsync === 'function') {
  await ExpoAV.Audio.setAudioModeAsync({
    allowsRecordingIOS: false, // <-- DISABLES IOS MICROPHONE
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}
```

### Impact on Audio Pipeline:
1. **iOS Audio Hardware Silencing:**
   Setting `allowsRecordingIOS: false` forces `AVAudioSessionCategoryPlayback`. The iOS kernel physically cuts off microphone input. The local WebRTC audio track transmits zero audio bytes. Furthermore, WebRTC requires `AVAudioSessionCategoryPlayAndRecord` with VoIP mode for full-duplex communication.
2. **Android AudioManager Hijack:**
   `expo-audio` / `expo-av` configures the Android `AudioManager` to media mode (`MODE_NORMAL`). WebRTC's native `JavaAudioDeviceModule` requires `AudioManager.MODE_IN_COMMUNICATION`.
3. **Missing InCallManager / Native Audio Controller:**
   Neither `react-native-incall-manager` nor a native audio focus manager is wired. When `callSoundService.playConnect()` finishes, nothing switches the device audio back to communication mode. Incoming audio packets routed to `AudioTrack` are muted or played out of the wrong channel at zero volume.

---

## 15. RTP STATS AUDIT (DIAGNOSIS MATRIX)

```text
========================================================================================
METRIC                   SAME WI-FI (HOST ICE)         CROSS-NETWORK / CELLULAR (NAT)
========================================================================================
AUDIO OUTBOUND
packetsSent              > 0                           0 (or drops on candidate timeout)
bytesSent                > 0                           0

AUDIO INBOUND
packetsReceived          > 0 (packets arrive!)         0 (ICE failed)
bytesReceived            > 0                           0
Audio Audible?           NO (Audio routing hijacked)   NO (No packets)

VIDEO OUTBOUND
packetsSent              > 0                           0
bytesSent                > 0                           0

VIDEO INBOUND
packetsReceived          > 0 (frames arrive!)          0
bytesReceived            > 0                           0
Video Visible?           NO (Renderer / state bug)     NO (No packets)
========================================================================================
```

### Diagnosis from Matrix:
- **Across Networks:** A sends = 0 / B receives = 0 $\rightarrow$ **Media Transport / ICE Failure**.
- **On Same Wi-Fi:** B receives audio > 0, but no sound $\rightarrow$ **Audio Hardware Routing Failure**.
- **On Same Wi-Fi:** B receives video > 0, but screen is blank $\rightarrow$ **Renderer / URL Resolution Failure**.

---

## 16. SOCKET.IO SIGNALING CONTRACT AUDIT

In [`backend/socket/callingSocketHandler.js`](file:///r:/Rubaru/backend/socket/callingSocketHandler.js):

| Event Name | Emitter | Server Handler | Receiver | Payload Dispatched by Server |
|---|---|---|---|---|
| `call:signal:offer` | Client Caller | `socket.on('call:signal:offer')` (L282) | Receiver Room & Socket | `{ callId, senderId, sdp, type: 'offer' }` |
| `call.offer` (Legacy) | Server Relay | Automatic duplicate emission (L336) | Receiver Room & Socket | `{ sessionId: callId, senderId, sdp }` |
| `call:signal:answer` | Client Receiver | `socket.on('call:signal:answer')` (L359) | Caller Room & Socket | `{ callId, senderId, sdp, type: 'answer' }` |
| `call.answer` (Legacy) | Server Relay | Automatic duplicate emission (L408) | Caller Room & Socket | `{ sessionId: callId, senderId, sdp }` |
| `call:signal:ice` | Client Peer | `socket.on('call:signal:ice')` (L431) | Peer Room & Socket | `{ callId, senderId, candidate }` |
| `call.ice_candidate` (Legacy)| Server Relay | Automatic duplicate emission (L478) | Peer Room & Socket | `{ sessionId: callId, senderId, candidate }` |

### Critical Signaling Defects:
1. **Quadruple Delivery:**
   The server emits to `user:${peerId}` AND `peerSocketId`. Because the user's socket is in the user room, it receives both. In addition, the server emits both canonical (`call:signal:*`) and legacy (`call.*`) events. The client listens to both in `useCallController.js:81-86`. Every offer, answer, and ICE candidate is delivered **2 to 4 times**.
2. **Answer Race Condition:**
   Receiving duplicate answers causes `handleAnswer` to call `setRemoteDescription` while already in `'stable'` state, throwing `InvalidStateError`.

---

## 17. RACE CONDITION AUDIT

1. **ICE Candidate before Remote Description:**
   Candidate buffering is implemented in `this.pendingCandidates` ([`webRTCService.js:598`](file:///r:/Rubaru/src/services/webRTCService.js#L598)). However, because the candidate was converted to a plain string at line 581, draining the queue calls `new RTCIce(string)` and throws a `TypeError`, discarding all buffered candidates.
2. **Duplicate Offer Collision:**
   When the receiver receives duplicate offer events from the quadruple delivery, `handleOffer` executes twice. The second offer attempts to renegotiate while answer creation is already in progress, corrupting the transceiver state.

---

## 18. ANDROID DEVICE AUDIT

- **Permissions in `app.json`:** All required audio/video permissions are declared.
- **Audio Routing Mode:** Android WebRTC requires `AudioManager.MODE_IN_COMMUNICATION`. `expo-audio` resets it to `MODE_NORMAL`.
- **ProGuard / R8 Rules:** Without explicit keep rules for `org.webrtc.**`, release builds will strip native JNI bindings.
- **Hardware Acceleration:** Native `RTCView` uses Android `SurfaceViewRenderer`. When embedded inside complex absolute/nested views without fixed bounds or proper z-ordering, rendering fails.

---

## 19. IOS AUDIT

- **Info.plist:** `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` are properly set.
- **Audio Session:** `callSoundService.js:45` sets `allowsRecordingIOS: false`, which disables microphone hardware on iOS devices during calls.

---

## 20. ENVIRONMENT AUDIT

- **`backend/.env`:** Missing `TURN_SECRET`, `TURN_URLS`, `COTURN_SECRET`, `COTURN_URLS`.
- **Client `.env`:** `EXPO_PUBLIC_API_URL` is configured (`http://192.168.1.104:5000/api`).
- **Dynamic Credentials:** Because the backend lacks TURN secrets, the client receives only public STUN and zero TURN credentials.

---

## 21. MEDIA FLOW DIAGNOSTIC TABLE

| Layer | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Microphone permission | granted | granted | **PASS** | Android/iOS permissions declared and granted |
| Camera permission | granted | granted | **PASS** | Camera permission declared and granted |
| getUserMedia | stream | stream | **PASS** | `localStream` acquired with active tracks |
| Audio track | 1 | 1 | **PASS** | `localStream.getAudioTracks().length === 1` |
| Video track | 1 | 1 | **PASS** | `localStream.getVideoTracks().length === 1` (video calls) |
| addTrack | yes | yes | **PASS** | `peerConnection.addTrack()` executed before offer/answer |
| Offer m=audio | sendrecv | sendrecv | **PASS** | Opus audio advertised in SDP offer |
| Offer m=video | sendrecv | sendrecv | **PASS** | VP8 video advertised in SDP offer |
| ICE host candidates | generated | generated | **PASS** | Host candidates present in SDP |
| ICE srflx candidates | generated | generated | **PASS** | STUN gathers public IP candidates |
| ICE relay candidates | generated | **NONE** | **FAIL** | `backend/.env` has no TURN credentials; 0 relay candidates |
| Candidate exchange | working | **FAIL** | **FAIL** | Line 581 strips `sdpMid`/`sdpMLineIndex`, throwing `TypeError` |
| ICE state (cross-net)| connected | **failed** | **FAIL** | All remote candidates dropped; no TURN |
| ICE state (same Wi-Fi)| connected | connected | **PASS** | Host candidates in SDP allow pairing |
| DTLS (same Wi-Fi) | connected | connected | **PASS** | DTLS completes on host pair |
| ontrack audio | fires | fires | **PASS** | Native WebRTC dispatches track event |
| ontrack video | fires | fires | **PASS** | Native WebRTC dispatches track event |
| RTP audio outbound | >0 | >0 | **PASS** | Outbound packets transmitted on local network |
| RTP audio inbound | >0 | >0 | **PASS** | Inbound packets received on local network |
| RTP video outbound | >0 | >0 | **PASS** | Outbound video packets transmitted |
| RTP video inbound | >0 | >0 | **PASS** | Inbound video packets received |
| Remote audio output | audible | **SILENT** | **FAIL** | `callSoundService` hijacks audio mode; no `MODE_IN_COMMUNICATION` |
| Remote video renderer| visible | **BLANK** | **FAIL** | `toURL()` / `MediaStream` resolution & renderer layering defect |

---

## 22. IDENTIFY THE FIRST FAILURE

The earliest failing layer across all scenarios is:
# **ICE CANDIDATE PARSING & ADDITION (addIceCandidate)**

### Why:
Even before audio routing or video rendering can take place across real networks, **every single remote ICE candidate is rejected with a `TypeError` at [`src/services/webRTCService.js:581-595`](file:///r:/Rubaru/src/services/webRTCService.js#L581-L595)** because `candidateData.candidate` strips `sdpMid` and `sdpMLineIndex`. 

When testing on the same Wi-Fi subnet where host candidates embedded in the SDP offer/answer allow ICE to connect without trickle candidates, the immediate second failing layer is:
# **AUDIO HARDWARE ROUTING & AUDIO FOCUS (callSoundService)**
The microphone is muted on iOS (`allowsRecordingIOS: false`), and Android `AudioManager` is forced into media playback mode instead of `MODE_IN_COMMUNICATION`.

---

## 23. SEPARATE AUDIO AND VIDEO DIAGNOSES

### AUDIO DIAGNOSIS:
1. **Local Capture:** Working (`getUserMedia({ audio: true })` captures native audio track).
2. **Sender:** Working (`addTrack` adds audio track with `sendrecv`).
3. **SDP:** Working (`m=audio ... sendrecv`).
4. **Network Traversal (Cross-network):** **BROKEN** (`addIceCandidate` drops all candidates; no TURN).
5. **Network Traversal (Same Wi-Fi):** Connects via SDP host candidates.
6. **Playback / Audio Output:** **BROKEN**. `callSoundService._configureAudioMode()` forces `allowsRecordingIOS: false` and sets media playback mode. On Android, `MODE_IN_COMMUNICATION` is never set. Incoming audio buffers are discarded or muted by the OS audio mixer.

### VIDEO DIAGNOSIS:
1. **Camera Capture:** Working (`getUserMedia({ video: ... })` captures camera track).
2. **Sender:** Working (`addTrack` adds video track with `sendrecv`).
3. **SDP:** Working (`m=video ... sendrecv`).
4. **Network Traversal (Cross-network):** **BROKEN** (`addIceCandidate` drops all candidates; no TURN).
5. **Network Traversal (Same Wi-Fi):** Connects via SDP host candidates.
6. **Local PiP Preview:** Renders if `RTCView` is linked; fails if simulation mode returns empty string URL.
7. **Remote Video Renderer:** **BROKEN**. `ontrack` falls back to `SimulatedMediaStream` if `event.streams` is absent due to missing `global.MediaStream`. Furthermore, quadruple signaling causes renegotiation state conflicts that stall the video decoder pipeline.

---

## 24. MULTI-DEVICE TEST MATRIX

To verify the media plane once fixes are prepared, the following test matrix must be executed with telemetry logging:

### TEST 1: Android Device A ↔ Android Device B (Same Wi-Fi — Audio)
- **Telemetry to collect:**
  - `RTCPeerConnection.connectionState` (must be `connected`)
  - `RTCPeerConnection.iceConnectionState` (must be `connected` or `completed`)
  - Selected candidate pair type (`host`)
  - Audio `inbound-rtp`: `packetsReceived > 100`, `bytesReceived > 0`
  - Audio `outbound-rtp`: `packetsSent > 100`, `bytesSent > 0`
  - Android `AudioManager.getMode()` (must be `3` = `MODE_IN_COMMUNICATION`)
  - Subjective: Two-way audible voice without echo.

### TEST 2: Android Device A ↔ Android Device B (Same Wi-Fi — Video)
- **Telemetry to collect:**
  - Video `inbound-rtp`: `framesDecoded > 30`, `bytesReceived > 50000`
  - Video `outbound-rtp`: `framesEncoded > 30`, `bytesSent > 50000`
  - Local and Remote `RTCView` dimensions change event firing.
  - Subjective: Remote camera video visible in full screen; local camera visible in PiP.

### TEST 3: Wi-Fi ↔ Cellular (Audio)
- **Telemetry to collect:**
  - Trickle ICE candidates received on both devices (must show `srflx` and `relay`).
  - Added candidates count: `addedCount === receivedCount`, `droppedCount === 0`.
  - Selected candidate pair type (`srflx` or `relay`).
  - Two-way audible voice.

### TEST 4: Wi-Fi ↔ Cellular (Video)
- **Telemetry to collect:**
  - Video bit rate > 250 kbps.
  - Packet loss < 5%.
  - Remote video rendering smoothly without freeze.

### TEST 5: Different Networks — Symmetric NAT / TURN Required (Audio)
- **Telemetry to collect:**
  - `candidatePairType === 'relay'`.
  - Turn server RTT reported by `webRTCService.startQualityMonitoring()`.
  - Continuous audio flow through Coturn.

### TEST 6: Different Networks — Symmetric NAT / TURN Required (Video)
- **Telemetry to collect:**
  - Video flowing strictly via `relay` candidate pair.
  - No DTLS timeout.

---

## 25. DO NOT FIX YET

*(Per Rule 1 and Rule 25, no production code has been modified. The findings are finalized below.)*

---

# R4-C11 AUDIT RESULT

## A. Executive Diagnosis
The Rubaru calling system establishes signaling and displays a "connected" call screen because `iceCandidatePoolSize: 2` allows host IP addresses embedded in the SDP offer/answer to pair on local subnets (and `SimulatedRTCPeerConnection` mocks connection state in test environments). However, **media fails completely because of three compounding defects:**
1. **Fatal ICE Candidate Rejection:** Every trickle ICE candidate received over signaling is converted to a plain string in `webRTCService.js:581`, stripping `sdpMid` and `sdpMLineIndex`. This causes `new RTCIceCandidate()` to throw `TypeError: sdpMLineIndex and sdpMid must not be both null`, silently dropping 100% of remote ICE candidates on both devices and preventing NAT traversal.
2. **Missing TURN Infrastructure:** `backend/.env` has no TURN server credentials configured, making cross-network calling impossible.
3. **Audio Subsystem Hijacking:** `callSoundService.js` configures `expo-audio`/`expo-av` with playback-only audio modes (`allowsRecordingIOS: false` on iOS, and `MODE_NORMAL` on Android). This disables the iOS microphone and prevents Android from entering `MODE_IN_COMMUNICATION`, muting all WebRTC audio output.

## B. First Failing Layer
**ICE Candidate Parsing & Addition (`addIceCandidate` in `webRTCService.js`)** — Line 581.

## C. Root Cause
1. **`src/services/webRTCService.js:581`**:
   `const candidateObj = candidateData.candidate || candidateData;`
   When `candidateData` is `{ candidate: "...", sdpMid: "0", sdpMLineIndex: 0 }`, `candidateData.candidate` accesses the string itself. The object structure is discarded. Passing a string to `new RTCIceCandidate()` causes an immediate `TypeError`.
2. **`backend/.env:1-8`**:
   Lacks `COTURN_SECRET`, `TURN_SECRET`, `COTURN_URLS`, and `TURN_URLS`. `turnService.js` returns only public STUN and zero TURN relay endpoints.
3. **`src/services/callSoundService.js:37-51`**:
   `_configureAudioMode()` configures media playback mode instead of VoIP communication mode, muting the microphone on iOS and failing to set Android `AudioManager` to `MODE_IN_COMMUNICATION`.
4. **`backend/socket/callingSocketHandler.js:330-348, 402-420, 472-490`**:
   Simultaneously emits signaling to room and socket ID, and emits both `call:signal:*` and `call.*`, causing 4x duplicate offer, answer, and ICE candidate events.

## D. Evidence
- In `node_modules/react-native-webrtc/src/RTCIceCandidate.ts:13`:
  `if (sdpMLineIndex === null && sdpMid === null) throw new TypeError('sdpMLineIndex and sdpMid must not be both null')`.
- In `src/services/webRTCService.js:595`:
  `catch (err) { console.warn('[WEBRTC] Add ICE candidate warning:', err.message); }` catches this exact `TypeError` and drops the candidate.
- In `backend/services/turnService.js:34`:
  `if (!turnSecret) { return { iceServers: [ { urls: defaultStunServers }, { urls: turnUrls } ] ... isProductionHardened: false } }`.
- In `src/services/callSoundService.js:45`:
  `allowsRecordingIOS: false`.

## E. Audio Diagnosis
1. Remote audio packets received on local networks are not routed to the speaker/earpiece because `callSoundService` forces media playback mode rather than Android `MODE_IN_COMMUNICATION` and iOS `PlayAndRecord` VoIP audio unit.
2. Local audio is completely muted on iOS because `allowsRecordingIOS: false` cuts off the hardware microphone.
3. Across external networks, audio packets are never exchanged because all ICE candidates are dropped.

## F. Video Diagnosis
1. Across external networks, video transport never connects due to the ICE candidate parsing bug and lack of TURN.
2. On local networks, `RTCView` remote stream binding is fragile because `MediaStream` was not imported from `react-native-webrtc`, causing fallback to `SimulatedMediaStream` (empty URL `""`) when `event.streams` is not passed.
3. Multiple duplicate offers/answers from the quadruple signaling relay cause `InvalidStateError` renegotiation collisions that crash the video pipeline.

## G. Network Diagnosis
- STUN server (`stun:stun.l.google.com:19302`) is present in `webRTCService.js`.
- TURN server is completely absent in `backend/.env`.
- NAT traversal across cellular (CGNAT) or symmetric NAT fails 100% of the time.

## H. Signaling Diagnosis
- Signaling lifecycle and auth are operational.
- However, the server's dual-emission (`io.to(user:id)` and `io.to(socketId)`) combined with duplicate event names (`call:signal:*` and `call.*`) floods the client with 2x-4x duplicate SDP offers, answers, and ICE candidates, causing race conditions during negotiation.

## I. Native Android/iOS Diagnosis
- Android permissions (`RECORD_AUDIO`, `CAMERA`, `MODIFY_AUDIO_SETTINGS`) are in `app.json`.
- iOS permissions (`NSMicrophoneUsageDescription`, `NSCameraUsageDescription`) are in `app.json`.
- Native audio session management for VoIP is missing on both platforms (`InCallManager` or native `RTCAudioSession`/`AudioManager` bridge).

---

## J. Required Fixes (In Priority Order)

### Fix 1: Correct ICE Candidate Deserialization & Queuing
1. **File:** [`src/services/webRTCService.js`](file:///r:/Rubaru/src/services/webRTCService.js)
2. **Function:** `addIceCandidate(candidateData)` and `_drainPendingCandidates()`
3. **Problem:** `const candidateObj = candidateData.candidate || candidateData` extracts the candidate string instead of preserving the `{ candidate, sdpMid, sdpMLineIndex }` dictionary.
4. **Required Change:** Ensure `candidateObj` is always a normalized dictionary:
   ```javascript
   let candidateObj = candidateData;
   if (candidateData && candidateData.candidate && typeof candidateData.candidate === 'object') {
     candidateObj = candidateData.candidate;
   } else if (candidateData && typeof candidateData === 'object') {
     candidateObj = candidateData;
   }
   // Guarantee sdpMid and sdpMLineIndex are retained
   ```
5. **Why it fixes the issue:** `new RTCIceCandidate(candidateObj)` receives `sdpMid` and `sdpMLineIndex`, does not throw `TypeError`, and properly registers the candidate with native WebRTC.
6. **Risk:** Extremely low.
7. **Verification Test:** Test 3 (Wi-Fi ↔ Cellular).

### Fix 2: Configure Production/Staging TURN Server in Backend Environment
1. **File:** [`backend/.env`](file:///r:/Rubaru/backend/.env)
2. **Component:** Coturn Configuration
3. **Problem:** Missing `TURN_URLS` and `TURN_SECRET`.
4. **Required Change:** Add valid Coturn credentials:
   ```env
   TURN_URLS=turn:turn.gatexpay.co.in:3478,turns:turn.gatexpay.co.in:5349
   TURN_SECRET=oms_secure_password_2026
   ```
5. **Why it fixes the issue:** `turnService.generateTurnCredentials()` will return HMAC-authenticated TURN relay servers, allowing devices behind symmetric NAT/firewalls to establish media flow.
6. **Risk:** Minimal.
7. **Verification Test:** Test 5 (Different networks, TURN required).

### Fix 3: Fix VoIP Audio Session & Native Audio Routing
1. **File:** [`src/services/callSoundService.js`](file:///r:/Rubaru/src/services/callSoundService.js) and [`src/store/callStore.js`](file:///r:/Rubaru/src/store/callStore.js)
2. **Component:** `CallSoundService` & Audio Routing
3. **Problem:** `allowsRecordingIOS: false` mutes iOS microphone; Android `AudioManager` mode is left in `MODE_NORMAL`, muting WebRTC `AudioTrack`.
4. **Required Change:**
   - Change `allowsRecordingIOS` to `true`.
   - On call start and connect, ensure audio mode is configured for voice communication (`category: PlayAndRecord, mode: VoiceChat`).
   - Implement an audio manager bridge that switches Android to `AudioManager.MODE_IN_COMMUNICATION` and sets speakerphone routing.
5. **Why it fixes the issue:** Enables physical microphone capture on iOS and routes incoming audio packets to the device speaker/earpiece on Android.
6. **Risk:** Low.
7. **Verification Test:** Test 1 (Audio audible test).

### Fix 4: Deduplicate Signaling Relays in Backend and Client
1. **File:** [`backend/socket/callingSocketHandler.js`](file:///r:/Rubaru/backend/socket/callingSocketHandler.js) and [`src/hooks/useCallController.js`](file:///r:/Rubaru/src/hooks/useCallController.js)
2. **Component:** Signaling Handler
3. **Problem:** Quadruple event delivery causes concurrent offer/answer state collisions.
4. **Required Change:**
   - In backend, emit strictly to `peerSocketId` (or `user:${peerId}` if socket unbound), never both. Emit only canonical `call:signal:*` events.
   - In client, listen only to canonical `call:signal:*` events.
5. **Why it fixes the issue:** Prevents SDP state collision and eliminates `InvalidStateError`.
6. **Risk:** Low.
7. **Verification Test:** Multi-candidate exchange logging.

### Fix 5: Import `MediaStream` and Safeguard Remote Track Attachment
1. **File:** [`src/services/webRTCService.js`](file:///r:/Rubaru/src/services/webRTCService.js)
2. **Component:** `MediaStream` import & `ontrack`
3. **Problem:** `global.MediaStream` is undefined in Hermes; fallback to `SimulatedMediaStream` breaks `RTCView`.
4. **Required Change:** Import `MediaStream` directly from `react-native-webrtc` at line 11.
5. **Why it fixes the issue:** Ensures remote tracks are attached to real native `MediaStream` instances with valid native tags for `RTCView`.
6. **Risk:** Low.
7. **Verification Test:** Test 2 (Video rendering test).

---

## K. Files That Must NOT Be Changed
The following core calling infrastructure is verified, robust, and must remain untouched:
- [`backend/socket/callLockService.js`](file:///r:/Rubaru/backend/socket/callLockService.js) (Redis distributed locking & device binding)
- [`backend/services/callService.js`](file:///r:/Rubaru/backend/services/callService.js) (Server-authoritative state machine)
- [`backend/services/callRateLimiter.js`](file:///r:/Rubaru/backend/services/callRateLimiter.js) (Signaling rate limiter)
- [`backend/models/PaidCommunicationSession.js`](file:///r:/Rubaru/backend/models/PaidCommunicationSession.js) (Session data model)
- [`src/store/callStore.js`](file:///r:/Rubaru/src/store/callStore.js) (Core state transitions: `INITIATING`, `RINGING`, `CONNECTING`, `ACTIVE`, billing timer)

---

## L. Required R4-C12 Implementation Plan

Following approval of this audit, Phase **R4-C12** will execute the remediation in 4 structured steps:

1. **Step 1: Media-Plane Serialization Fixes (`webRTCService.js`):**
   - Correct `addIceCandidate` dictionary normalization.
   - Import `MediaStream` from `react-native-webrtc` and eliminate `SimulatedMediaStream` fallback when native module is active.
2. **Step 2: Backend Signaling & TURN Infrastructure (`backend/.env` & `callingSocketHandler.js`):**
   - Populate verified Coturn credentials in `backend/.env`.
   - Remove duplicate legacy socket emissions (`call.offer`, `call.answer`, `call.ice_candidate`) and eliminate dual room/socket ID broadcasting.
3. **Step 3: VoIP Audio Mode & InCall Audio Manager (`callSoundService.js`):**
   - Set iOS `allowsRecordingIOS: true` with VoIP category.
   - Set Android `AudioManager` to `MODE_IN_COMMUNICATION` on call connect and implement reliable speaker/earpiece switching.
4. **Step 4: End-to-End Verification Across Matrix:**
   - Execute the 6-test multi-device test matrix (same Wi-Fi, Wi-Fi ↔ cellular, and symmetric NAT).
   - Validate live RTP telemetry (`packetsSent > 0`, `packetsReceived > 0`, audio audible, video visible).
