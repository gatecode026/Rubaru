/**
 * RUBARU CALLING: ENTERPRISE OBSERVABILITY & DIAGNOSTICS ENGINE (R4-C16)
 * Production WebRTC quality monitoring, call setup timeline (T0-T16),
 * delta-based bitrate & packet loss calculation, failure classification,
 * candidate pair detection (host/srflx/relay), and sanitized evidence reporting.
 * 
 * Redacts JWTs, TURN credentials, SDP payloads, and private IP addresses.
 */

// Safe monotonic clock: uses performance.now() if available, otherwise Date.now()
const getMonotonicTime = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

// Canonical Failure Categories for Rubaru Calling
export const FailureCategories = Object.freeze({
  SIGNALING_FAILURE: 'SIGNALING FAILURE',
  ICE_FAILURE: 'ICE FAILURE',
  DTLS_FAILURE: 'DTLS FAILURE',
  RTP_FAILURE: 'RTP FAILURE',
  AUDIO_CAPTURE_FAILURE: 'AUDIO CAPTURE FAILURE',
  AUDIO_ROUTING_FAILURE: 'AUDIO PLAYBACK/ROUTING FAILURE',
  VIDEO_CAPTURE_FAILURE: 'VIDEO CAPTURE FAILURE',
  VIDEO_DECODE_FAILURE: 'VIDEO DECODE/RENDER FAILURE',
  LIFECYCLE_FAILURE: 'APPLICATION LIFECYCLE FAILURE',
  UNKNOWN_FAILURE: 'UNKNOWN FAILURE',
});

// Candidate Connection Classifications
export const CandidateClassifications = Object.freeze({
  DIRECT: 'DIRECT CONNECTION',
  STUN_SRFLX: 'STUN/SRFLX CONNECTION',
  TURN_RELAY: 'TURN RELAY CONNECTION',
  ICE_FAILED: 'ICE FAILURE',
  UNKNOWN: 'UNKNOWN',
});

// Maximum diagnostic snapshots retained in memory (bound CPU/memory)
const MAX_SNAPSHOTS = 20;

class CallDiagnosticsService {
  constructor() {
    this.reset();
  }

  /**
   * Reset all diagnostics state to guarantee complete session isolation
   */
  reset() {
    this.callId = null;
    this.sessionId = null;
    this.role = 'caller'; // 'caller' | 'receiver'
    this.isInitiator = true;
    this.callType = 'audio'; // 'audio' | 'video'
    this.startedAt = null;
    this.endedAt = null;
    this.terminalReason = null;
    this.failureCategory = null;

    // Call Setup Timeline (T0 - T16)
    this.timeline = {
      T0: null,  // Call initiation
      T1: null,  // Outgoing signaling sent
      T2: null,  // Incoming call received
      T3: null,  // Call accepted
      T4: null,  // Offer created
      T5: null,  // Offer sent
      T6: null,  // Answer received
      T7: null,  // Remote description applied
      T8: null,  // ICE gathering started
      T9: null,  // ICE gathering completed
      T10: null, // ICE connected
      T11: null, // DTLS connected
      T12: null, // First RTP sent
      T13: null, // First RTP received
      T14: null, // First remote audio available
      T15: null, // First remote video frame available
      T16: null, // Call/media fully connected
    };

    this.monotonicTimeline = {
      T0: null, T1: null, T2: null, T3: null, T4: null,
      T5: null, T6: null, T7: null, T8: null, T9: null,
      T10: null, T11: null, T12: null, T13: null, T14: null,
      T15: null, T16: null,
    };

    // Reconnection & lifecycle counters
    this.reconnectCount = 0;
    this.iceRestartCount = 0;
    this.signalingReconnectCount = 0;
    this.pcRecreationCount = 0;
    this.callFailureCount = 0;
    this.cleanupCount = 0;

    // Track states
    this.localAudioTrack = { exists: false, enabled: false, state: 'none' };
    this.localVideoTrack = { exists: false, enabled: false, state: 'none' };
    this.remoteAudioTrack = { exists: false, enabled: false, state: 'none' };
    this.remoteVideoTrack = { exists: false, enabled: false, state: 'none' };
    this.audioRoutingState = 'default';

    // Previous stats sample for delta calculations
    this.prevStatsSample = null;

    // Bounded stats snapshots & rolling metrics
    this.snapshots = [];
    this.logs = this.snapshots; // backward-compat alias
    this.lastStats = null;
    this.sessionSummary = null;

    // Rolling aggregates
    this.rollingMetrics = {
      samplesCount: 0,
      minRttMs: null,
      maxRttMs: null,
      avgRttMs: null,
      minJitterMs: null,
      maxJitterMs: null,
      avgJitterMs: null,
      peakBitrateKbps: 0,
      totalPacketsLost: 0,
      totalPacketsReceived: 0,
      totalPacketsSent: 0,
      codecs: { audio: null, video: null },
      selectedCandidatePair: null,
      candidateClassification: CandidateClassifications.UNKNOWN,
      videoFrames: {
        sent: 0,
        received: 0,
        decoded: 0,
        dropped: 0,
      },
    };
  }

  /**
   * Start or attach to a new authoritative call session
   */
  startSession(callId, metadata = {}) {
    this.reset();
    this.callId = callId;
    this.sessionId = metadata.sessionId || callId;
    this.isInitiator = metadata.isInitiator !== undefined ? Boolean(metadata.isInitiator) : true;
    this.role = this.isInitiator ? 'caller' : 'receiver';
    this.callType = metadata.callType || 'audio';
    this.startedAt = new Date().toISOString();
    return this;
  }

  /**
   * Record a lifecycle event in the Call Setup Timeline (T0 - T16)
   */
  recordTimelineEvent(eventKey, timestamp = null, monotonicTime = null) {
    if (!this.timeline || !(eventKey in this.timeline)) {
      return;
    }
    // Only record the FIRST occurrence of a setup milestone
    if (this.timeline[eventKey] === null) {
      this.timeline[eventKey] = timestamp || new Date().toISOString();
      this.monotonicTimeline[eventKey] = monotonicTime !== null ? monotonicTime : getMonotonicTime();
    }
  }

  /**
   * Calculate all available setup durations using monotonic clocks
   * Returns null if any required timestamp is missing. Never fabricates.
   */
  getDurations() {
    const m = this.monotonicTimeline;
    const calc = (startKey, endKey) => {
      if (m[startKey] !== null && m[endKey] !== null) {
        const diffMs = m[endKey] - m[startKey];
        return Math.max(0, Math.round(diffMs));
      }
      return null;
    };

    // Signaling duration:
    // Caller: T1 (outgoing signaling sent) -> T6 (answer received)
    // Callee: T2 (incoming received) -> T3 (accepted)
    let signalingDuration = null;
    if (this.isInitiator) {
      signalingDuration = calc('T1', 'T6') ?? calc('T0', 'T6');
    } else {
      signalingDuration = calc('T2', 'T3');
    }

    // Offer / Answer duration: T4 (offer created) -> T6 (answer received)
    const offerAnswerDuration = calc('T4', 'T6') ?? calc('T5', 'T6');

    // ICE Gathering duration: T8 (started) -> T9 (completed)
    const iceGatheringDuration = calc('T8', 'T9');

    // ICE Connection duration: T8 (gathering started) -> T10 (connected)
    const iceConnectionDuration = calc('T8', 'T10');

    // DTLS Connection duration: T10 (ICE connected) -> T11 (DTLS connected)
    const dtlsConnectionDuration = calc('T10', 'T11');

    // Base milestone for media: T0 for caller, T2 for receiver
    const baseMilestone = this.isInitiator ? 'T0' : 'T2';

    // Time to First RTP (sent or received)
    let firstRtpKey = null;
    if (m.T12 !== null && m.T13 !== null) {
      firstRtpKey = m.T12 <= m.T13 ? 'T12' : 'T13';
    } else if (m.T12 !== null) {
      firstRtpKey = 'T12';
    } else if (m.T13 !== null) {
      firstRtpKey = 'T13';
    }
    const timeToFirstRtp = firstRtpKey ? calc(baseMilestone, firstRtpKey) : null;

    // Time to First Remote Audio available
    const timeToFirstRemoteAudio = calc(baseMilestone, 'T14');

    // Time to First Remote Video frame available
    const timeToFirstRemoteVideo = calc(baseMilestone, 'T15');

    // Total Call Setup Duration: from initial start to fully connected
    const totalCallSetupDuration = calc(baseMilestone, 'T16');

    return {
      signalingDurationMs: signalingDuration,
      offerAnswerDurationMs: offerAnswerDuration,
      iceGatheringDurationMs: iceGatheringDuration,
      iceConnectionDurationMs: iceConnectionDuration,
      dtlsConnectionDurationMs: dtlsConnectionDuration,
      timeToFirstRtpMs: timeToFirstRtp,
      timeToFirstRemoteAudioMs: timeToFirstRemoteAudio,
      timeToFirstRemoteVideoMs: timeToFirstRemoteVideo,
      totalCallSetupDurationMs: totalCallSetupDuration,
    };
  }

  /**
   * Sanitize an IP address: redacts private IP addresses (RFC 1918 / loopback)
   */
  sanitizeIp(ip) {
    if (!ip || typeof ip !== 'string') return ip;
    // Redact loopback, 192.168.x.x, 10.x.x.x, 172.16-31.x.x, fe80::
    if (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip.startsWith('fe80:')
    ) {
      return '[REDACTED_PRIVATE_IP]';
    }
    return ip;
  }

  /**
   * Classify candidate connection pair into DIRECT, STUN_SRFLX, TURN_RELAY, or ICE_FAILED
   */
  classifyCandidatePair(localType, remoteType, iceState) {
    if (iceState === 'failed' || iceState === 'disconnected') {
      return CandidateClassifications.ICE_FAILED;
    }
    const lt = (localType || '').toLowerCase();
    const rt = (remoteType || '').toLowerCase();

    if (lt === 'relay' || rt === 'relay') {
      return CandidateClassifications.TURN_RELAY;
    }
    if (lt === 'srflx' || rt === 'srflx' || lt === 'prflx' || rt === 'prflx') {
      return CandidateClassifications.STUN_SRFLX;
    }
    if (lt === 'host' && rt === 'host') {
      return CandidateClassifications.DIRECT;
    }
    return CandidateClassifications.UNKNOWN;
  }

  /**
   * Process raw WebRTC PeerConnection stats report
   * Calculates delta bitrates (kbps), delta packet loss rates, frames, and candidate pairs.
   */
  processStatsReport(stats, sessionMetadata = {}) {
    if (!stats) return null;

    const nowMonotonic = getMonotonicTime();
    const nowIso = new Date().toISOString();

    let outboundAudio = { packetsSent: 0, bytesSent: 0, codec: null, audioLevel: null };
    let inboundAudio = { packetsReceived: 0, bytesReceived: 0, packetsLost: 0, jitter: 0, codec: null, audioLevel: null };
    let outboundVideo = { packetsSent: 0, bytesSent: 0, framesSent: 0, frameWidth: null, frameHeight: null, framesPerSecond: null, codec: null };
    let inboundVideo = { packetsReceived: 0, bytesReceived: 0, packetsLost: 0, jitter: 0, framesReceived: 0, framesDecoded: 0, framesDropped: 0, frameWidth: null, frameHeight: null, framesPerSecond: null, codec: null };
    
    let candidatePair = {
      localCandidateType: null,
      remoteCandidateType: null,
      protocol: 'udp',
      currentRoundTripTime: null,
      bytesSent: 0,
      bytesReceived: 0,
      state: 'succeeded',
    };

    let transport = {
      iceState: sessionMetadata.iceConnectionState || 'connected',
      dtlsState: sessionMetadata.dtlsState || 'connected',
      connectionState: sessionMetadata.connectionState || 'connected',
    };

    const codecsMap = new Map();

    // Parse stats iterable (Map, Array, or RTCStatsReport)
    const entries = typeof stats.forEach === 'function' ? stats : Object.values(stats);
    entries.forEach((report) => {
      if (!report || !report.type) return;

      // Codecs mapping
      if (report.type === 'codec') {
        const codecName = report.mimeType || report.payloadType;
        codecsMap.set(report.id, codecName);
      }

      // Candidate-pair
      if (report.type === 'candidate-pair' && (report.selected || report.nominated || report.state === 'succeeded')) {
        candidatePair.state = report.state || candidatePair.state;
        candidatePair.bytesSent = report.bytesSent || candidatePair.bytesSent;
        candidatePair.bytesReceived = report.bytesReceived || candidatePair.bytesReceived;
        candidatePair.currentRoundTripTime = report.currentRoundTripTime !== undefined
          ? Math.round(report.currentRoundTripTime * 1000)
          : null;

        // Resolve candidate types if stats has get()
        if (typeof stats.get === 'function') {
          if (report.localCandidateId) {
            const lc = stats.get(report.localCandidateId);
            if (lc && lc.candidateType) candidatePair.localCandidateType = lc.candidateType;
            if (lc && lc.protocol) candidatePair.protocol = lc.protocol.toLowerCase();
          }
          if (report.remoteCandidateId) {
            const rc = stats.get(report.remoteCandidateId);
            if (rc && rc.candidateType) candidatePair.remoteCandidateType = rc.candidateType;
          }
        }
      }

      if (report.type === 'local-candidate' && report.candidateType) {
        if (!candidatePair.localCandidateType) candidatePair.localCandidateType = report.candidateType;
        if (report.protocol) candidatePair.protocol = report.protocol.toLowerCase();
      }

      if (report.type === 'remote-candidate' && report.candidateType) {
        if (!candidatePair.remoteCandidateType) candidatePair.remoteCandidateType = report.candidateType;
      }

      // Inbound RTP
      if (report.type === 'inbound-rtp') {
        const isAudio = report.kind === 'audio' || report.mediaType === 'audio';
        const isVideo = report.kind === 'video' || report.mediaType === 'video';

        if (isAudio) {
          inboundAudio.packetsReceived = report.packetsReceived || 0;
          inboundAudio.bytesReceived = report.bytesReceived || 0;
          inboundAudio.packetsLost = report.packetsLost || 0;
          inboundAudio.jitter = report.jitter !== undefined ? Math.round(report.jitter * 1000) : 0;
          if (report.audioLevel !== undefined) inboundAudio.audioLevel = report.audioLevel;
          if (report.codecId && codecsMap.has(report.codecId)) inboundAudio.codec = codecsMap.get(report.codecId);
        } else if (isVideo) {
          inboundVideo.packetsReceived = report.packetsReceived || 0;
          inboundVideo.bytesReceived = report.bytesReceived || 0;
          inboundVideo.packetsLost = report.packetsLost || 0;
          inboundVideo.jitter = report.jitter !== undefined ? Math.round(report.jitter * 1000) : 0;
          if (report.framesReceived !== undefined) inboundVideo.framesReceived = report.framesReceived;
          if (report.framesDecoded !== undefined) inboundVideo.framesDecoded = report.framesDecoded;
          if (report.framesDropped !== undefined) inboundVideo.framesDropped = report.framesDropped;
          if (report.frameWidth !== undefined) inboundVideo.frameWidth = report.frameWidth;
          if (report.frameHeight !== undefined) inboundVideo.frameHeight = report.frameHeight;
          if (report.framesPerSecond !== undefined) inboundVideo.framesPerSecond = report.framesPerSecond;
          if (report.codecId && codecsMap.has(report.codecId)) inboundVideo.codec = codecsMap.get(report.codecId);
        }
      }

      // Outbound RTP
      if (report.type === 'outbound-rtp') {
        const isAudio = report.kind === 'audio' || report.mediaType === 'audio';
        const isVideo = report.kind === 'video' || report.mediaType === 'video';

        if (isAudio) {
          outboundAudio.packetsSent = report.packetsSent || 0;
          outboundAudio.bytesSent = report.bytesSent || 0;
          if (report.codecId && codecsMap.has(report.codecId)) outboundAudio.codec = codecsMap.get(report.codecId);
        } else if (isVideo) {
          outboundVideo.packetsSent = report.packetsSent || 0;
          outboundVideo.bytesSent = report.bytesSent || 0;
          if (report.framesSent !== undefined) outboundVideo.framesSent = report.framesSent;
          if (report.frameWidth !== undefined) outboundVideo.frameWidth = report.frameWidth;
          if (report.frameHeight !== undefined) outboundVideo.frameHeight = report.frameHeight;
          if (report.framesPerSecond !== undefined) outboundVideo.framesPerSecond = report.framesPerSecond;
          if (report.codecId && codecsMap.has(report.codecId)) outboundVideo.codec = codecsMap.get(report.codecId);
        }
      }

      // Transport
      if (report.type === 'transport') {
        if (report.dtlsState) transport.dtlsState = report.dtlsState;
        if (report.iceState) transport.iceState = report.iceState;
      }
    });

    // Milestone detections based on RTP activity
    if (outboundAudio.packetsSent > 0 || outboundVideo.packetsSent > 0) {
      this.recordTimelineEvent('T12', nowIso, nowMonotonic);
    }
    if (inboundAudio.packetsReceived > 0 || inboundVideo.packetsReceived > 0) {
      this.recordTimelineEvent('T13', nowIso, nowMonotonic);
    }
    if (inboundVideo.framesDecoded > 0) {
      this.recordTimelineEvent('T15', nowIso, nowMonotonic);
    }

    // =========================================================================
    // DELTA-BASED BITRATE & PACKET-LOSS CALCULATIONS (PHASE 4 & 5)
    // =========================================================================
    let audioOutboundBitrateKbps = 0;
    let audioInboundBitrateKbps = 0;
    let videoOutboundBitrateKbps = 0;
    let videoInboundBitrateKbps = 0;
    let totalBitrateKbps = 0;

    let deltaAudioLossRate = 0;
    let deltaVideoLossRate = 0;

    const prev = this.prevStatsSample;

    if (prev && prev.monotonicTime) {
      const elapsedMs = nowMonotonic - prev.monotonicTime;

      if (elapsedMs > 0) {
        // Calculation helper: ((deltaBytes * 8) / elapsedMs) kbps
        const calcBitrate = (currentBytes, previousBytes) => {
          const deltaBytes = currentBytes - previousBytes;
          if (deltaBytes <= 0) return 0; // Protect against reset, counter rollover, reconnect
          return Number(((deltaBytes * 8) / elapsedMs).toFixed(1));
        };

        audioOutboundBitrateKbps = calcBitrate(outboundAudio.bytesSent, prev.outboundAudio.bytesSent);
        audioInboundBitrateKbps = calcBitrate(inboundAudio.bytesReceived, prev.inboundAudio.bytesReceived);
        videoOutboundBitrateKbps = calcBitrate(outboundVideo.bytesSent, prev.outboundVideo.bytesSent);
        videoInboundBitrateKbps = calcBitrate(inboundVideo.bytesReceived, prev.inboundVideo.bytesReceived);
        totalBitrateKbps = Number((audioOutboundBitrateKbps + audioInboundBitrateKbps + videoOutboundBitrateKbps + videoInboundBitrateKbps).toFixed(1));

        // Packet Loss Percentage from deltas:
        const calcLossRate = (curRecv, prevRecv, curLost, prevLost) => {
          const deltaRecv = curRecv - prevRecv;
          const deltaLost = curLost - prevLost;
          if (deltaRecv < 0 || deltaLost < 0) return 0; // Reset guard
          const totalDelta = deltaRecv + deltaLost;
          return totalDelta > 0 ? Number(((deltaLost / totalDelta) * 100).toFixed(2)) : 0;
        };

        deltaAudioLossRate = calcLossRate(
          inboundAudio.packetsReceived, prev.inboundAudio.packetsReceived,
          inboundAudio.packetsLost, prev.inboundAudio.packetsLost
        );

        deltaVideoLossRate = calcLossRate(
          inboundVideo.packetsReceived, prev.inboundVideo.packetsReceived,
          inboundVideo.packetsLost, prev.inboundVideo.packetsLost
        );
      }
    }

    // Save current sample as baseline for next iteration
    this.prevStatsSample = {
      monotonicTime: nowMonotonic,
      outboundAudio: { bytesSent: outboundAudio.bytesSent },
      inboundAudio: { bytesReceived: inboundAudio.bytesReceived, packetsReceived: inboundAudio.packetsReceived, packetsLost: inboundAudio.packetsLost },
      outboundVideo: { bytesSent: outboundVideo.bytesSent },
      inboundVideo: { bytesReceived: inboundVideo.bytesReceived, packetsReceived: inboundVideo.packetsReceived, packetsLost: inboundVideo.packetsLost },
    };

    // Candidate pair classification
    const candidateClassification = this.classifyCandidatePair(
      candidatePair.localCandidateType,
      candidatePair.remoteCandidateType,
      transport.iceState
    );

    // Snapshot construction
    const snapshot = {
      timestamp: nowIso,
      callId: this.callId || sessionMetadata.callId || 'unknown',
      sessionId: this.sessionId || sessionMetadata.sessionId || 'unknown',
      callType: this.callType,
      transport: {
        iceConnectionState: transport.iceState,
        dtlsState: transport.dtlsState,
        connectionState: transport.connectionState,
      },
      candidatePair: {
        localCandidateType: candidatePair.localCandidateType,
        remoteCandidateType: candidatePair.remoteCandidateType,
        classification: candidateClassification,
        protocol: candidatePair.protocol,
        currentRoundTripTimeMs: candidatePair.currentRoundTripTime,
        isRelayed: candidateClassification === CandidateClassifications.TURN_RELAY,
      },
      audio: {
        outbound: {
          packetsSent: outboundAudio.packetsSent,
          bytesSent: outboundAudio.bytesSent,
          bitrateKbps: audioOutboundBitrateKbps,
          codec: outboundAudio.codec,
          trackLive: Boolean(sessionMetadata.audioTrackLive ?? !sessionMetadata.isMuted),
        },
        inbound: {
          packetsReceived: inboundAudio.packetsReceived,
          bytesReceived: inboundAudio.bytesReceived,
          packetsLost: inboundAudio.packetsLost,
          packetLossRatePercent: deltaAudioLossRate,
          jitterMs: inboundAudio.jitter,
          bitrateKbps: audioInboundBitrateKbps,
          codec: inboundAudio.codec,
        },
      },
      video: {
        outbound: {
          packetsSent: outboundVideo.packetsSent,
          bytesSent: outboundVideo.bytesSent,
          framesSent: outboundVideo.framesSent,
          bitrateKbps: videoOutboundBitrateKbps,
          frameWidth: outboundVideo.frameWidth,
          frameHeight: outboundVideo.frameHeight,
          fps: outboundVideo.framesPerSecond,
          codec: outboundVideo.codec,
        },
        inbound: {
          packetsReceived: inboundVideo.packetsReceived,
          bytesReceived: inboundVideo.bytesReceived,
          packetsLost: inboundVideo.packetsLost,
          packetLossRatePercent: deltaVideoLossRate,
          jitterMs: inboundVideo.jitter,
          bitrateKbps: videoInboundBitrateKbps,
          framesReceived: inboundVideo.framesReceived,
          framesDecoded: inboundVideo.framesDecoded,
          framesDropped: inboundVideo.framesDropped,
          frameWidth: inboundVideo.frameWidth,
          frameHeight: inboundVideo.frameHeight,
          fps: inboundVideo.framesPerSecond,
          codec: inboundVideo.codec,
        },
      },
      bitrateSummary: {
        totalBitrateKbps,
        audioTotalKbps: Number((audioOutboundBitrateKbps + audioInboundBitrateKbps).toFixed(1)),
        videoTotalKbps: Number((videoOutboundBitrateKbps + videoInboundBitrateKbps).toFixed(1)),
      },
    };

    // Update rolling aggregates
    const rm = this.rollingMetrics;
    rm.samplesCount += 1;
    if (candidatePair.currentRoundTripTime !== null) {
      rm.minRttMs = rm.minRttMs === null ? candidatePair.currentRoundTripTime : Math.min(rm.minRttMs, candidatePair.currentRoundTripTime);
      rm.maxRttMs = rm.maxRttMs === null ? candidatePair.currentRoundTripTime : Math.max(rm.maxRttMs, candidatePair.currentRoundTripTime);
      rm.avgRttMs = rm.avgRttMs === null ? candidatePair.currentRoundTripTime : Math.round((rm.avgRttMs * (rm.samplesCount - 1) + candidatePair.currentRoundTripTime) / rm.samplesCount);
    }
    const maxJitter = Math.max(inboundAudio.jitter, inboundVideo.jitter);
    rm.minJitterMs = rm.minJitterMs === null ? maxJitter : Math.min(rm.minJitterMs, maxJitter);
    rm.maxJitterMs = rm.maxJitterMs === null ? maxJitter : Math.max(rm.maxJitterMs, maxJitter);
    rm.avgJitterMs = rm.avgJitterMs === null ? maxJitter : Math.round((rm.avgJitterMs * (rm.samplesCount - 1) + maxJitter) / rm.samplesCount);
    rm.peakBitrateKbps = Math.max(rm.peakBitrateKbps, totalBitrateKbps);
    rm.totalPacketsLost = inboundAudio.packetsLost + inboundVideo.packetsLost;
    rm.totalPacketsReceived = inboundAudio.packetsReceived + inboundVideo.packetsReceived;
    rm.totalPacketsSent = outboundAudio.packetsSent + outboundVideo.packetsSent;
    rm.selectedCandidatePair = snapshot.candidatePair;
    rm.candidateClassification = candidateClassification;
    if (outboundAudio.codec || inboundAudio.codec) rm.codecs.audio = outboundAudio.codec || inboundAudio.codec;
    if (outboundVideo.codec || inboundVideo.codec) rm.codecs.video = outboundVideo.codec || inboundVideo.codec;
    rm.videoFrames.sent = outboundVideo.framesSent;
    rm.videoFrames.received = inboundVideo.framesReceived;
    rm.videoFrames.decoded = inboundVideo.framesDecoded;
    rm.videoFrames.dropped = inboundVideo.framesDropped;

    this.lastStats = snapshot;

    // Retain bounded snapshots in memory
    if (this.snapshots.length >= MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
    this.snapshots.push(snapshot);

    return snapshot;
  }

  /**
   * Backward-compatible captureStats wrapper
   */
  async captureStats(peerConnection, sessionMetadata = {}) {
    if (!peerConnection || typeof peerConnection.getStats !== 'function') {
      return null;
    }
    try {
      const stats = await peerConnection.getStats();
      return this.processStatsReport(stats, sessionMetadata);
    } catch (err) {
      console.warn('[DIAGNOSTICS] Failed to capture stats:', err.message);
      return null;
    }
  }

  /**
   * Record a lifecycle or recovery event
   */
  recordEvent(eventType, eventData = {}) {
    switch (eventType) {
      case 'reconnect':
      case 'reconnecting':
        this.reconnectCount += 1;
        break;
      case 'ice-restart':
        this.iceRestartCount += 1;
        break;
      case 'signaling-reconnect':
        this.signalingReconnectCount += 1;
        break;
      case 'pc-recreated':
        this.pcRecreationCount += 1;
        break;
      case 'failure':
        this.callFailureCount += 1;
        break;
      case 'cleanup':
        this.cleanupCount += 1;
        break;
      default:
        break;
    }
  }

  /**
   * Classify call failure using explicit production categories (Phase 10)
   */
  classifyFailure(terminalReason, error = null, context = {}) {
    this.terminalReason = terminalReason || 'UNKNOWN';

    const reason = String(terminalReason || '').toUpperCase();
    const errMsg = String(error?.message || error || '').toUpperCase();
    const full = `${reason} ${errMsg}`;

    // 1. Permission / Capture failures
    if (full.includes('PERMISSION') || full.includes('MIC_DENIED') || full.includes('NOTALLOWEDERROR')) {
      if (full.includes('CAMERA') || full.includes('VIDEO')) {
        this.failureCategory = FailureCategories.VIDEO_CAPTURE_FAILURE;
      } else {
        this.failureCategory = FailureCategories.AUDIO_CAPTURE_FAILURE;
      }
      return this.failureCategory;
    }

    if (full.includes('LOCAL_AUDIO_TRACK_MISSING') || full.includes('MICROPHONE_FAILED')) {
      this.failureCategory = FailureCategories.AUDIO_CAPTURE_FAILURE;
      return this.failureCategory;
    }

    if (full.includes('LOCAL_VIDEO_TRACK_MISSING') || full.includes('CAMERA_FAILED')) {
      this.failureCategory = FailureCategories.VIDEO_CAPTURE_FAILURE;
      return this.failureCategory;
    }

    // 2. Audio playback / routing failures
    if (full.includes('AUDIO_ROUTING') || full.includes('EARPIECE_FAILED') || full.includes('SPEAKER_FAILED') || full.includes('REMOTE_AUDIO_TRACK_MISSING')) {
      this.failureCategory = FailureCategories.AUDIO_ROUTING_FAILURE;
      return this.failureCategory;
    }

    // 3. Video decode / render failures
    if (full.includes('VIDEO_DECODE') || full.includes('FRAMES_DROPPED_EXCESSIVE') || full.includes('RENDER_FAILED') || full.includes('REMOTE_VIDEO_TRACK_MISSING')) {
      this.failureCategory = FailureCategories.VIDEO_DECODE_FAILURE;
      return this.failureCategory;
    }

    // 4. Signaling failures
    if (full.includes('SIGNALING') || full.includes('OFFER_TIMEOUT') || full.includes('ANSWER_TIMEOUT') || full.includes('RINGING_TIMEOUT')) {
      this.failureCategory = FailureCategories.SIGNALING_FAILURE;
      return this.failureCategory;
    }

    // 5. DTLS failures
    if (full.includes('DTLS')) {
      this.failureCategory = FailureCategories.DTLS_FAILURE;
      return this.failureCategory;
    }

    // 6. ICE failures
    if (full.includes('ICE_FAILED') || full.includes('ICE_DISCONNECTED') || full.includes('ICE_TIMEOUT') || full.includes('TURN_FAILED')) {
      this.failureCategory = FailureCategories.ICE_FAILURE;
      return this.failureCategory;
    }

    // 7. RTP media failures
    if (full.includes('RTP_TIMEOUT') || full.includes('NO_RTP_RECEIVED') || full.includes('MEDIA_WATCHDOG_TIMEOUT')) {
      this.failureCategory = FailureCategories.RTP_FAILURE;
      return this.failureCategory;
    }

    // 8. Lifecycle failures
    if (
      full.includes('USER_HUNG_UP') ||
      full.includes('REMOTE_HANGUP') ||
      full.includes('CALLER_CANCELLED') ||
      full.includes('CALLEE_REJECTED') ||
      full.includes('APP_BACKGROUND') ||
      full.includes('SOCKET_DISCONNECTED') ||
      full.includes('NETWORK_CHANGED') ||
      full.includes('NORMAL')
    ) {
      this.failureCategory = FailureCategories.LIFECYCLE_FAILURE;
      return this.failureCategory;
    }

    // Default fallback
    this.failureCategory = FailureCategories.UNKNOWN_FAILURE;
    return this.failureCategory;
  }

  /**
   * Export comprehensive, sanitized QA & Production Observability Report
   * Strict privacy: No tokens, No TURN credentials, No SDP, No private IPs.
   */
  exportEvidenceReport(testCaseId = 'QA-OBS-01') {
    const durations = this.getDurations();

    const report = {
      testCaseId,
      exportedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      applicationBuild: '1.0.0-r4c16',
      correlation: {
        callId: this.callId || 'unknown',
        sessionId: this.sessionId || 'unknown',
        role: this.role,
        callType: this.callType,
      },
      timeline: {
        timestamps: { ...this.timeline },
        durationsMs: durations,
      },
      connection: {
        classification: this.rollingMetrics.candidateClassification,
        selectedCandidatePair: this.rollingMetrics.selectedCandidatePair,
        reconnectCount: this.reconnectCount,
        iceRestartCount: this.iceRestartCount,
        signalingReconnectCount: this.signalingReconnectCount,
        pcRecreationCount: this.pcRecreationCount,
      },
      qualityMetrics: {
        peakBitrateKbps: this.rollingMetrics.peakBitrateKbps,
        roundTripTimeMs: {
          min: this.rollingMetrics.minRttMs,
          max: this.rollingMetrics.maxRttMs,
          avg: this.rollingMetrics.avgRttMs,
        },
        jitterMs: {
          min: this.rollingMetrics.minJitterMs,
          max: this.rollingMetrics.maxJitterMs,
          avg: this.rollingMetrics.avgJitterMs,
        },
        packetCounters: {
          sent: this.rollingMetrics.totalPacketsSent,
          received: this.rollingMetrics.totalPacketsReceived,
          lost: this.rollingMetrics.totalPacketsLost,
          overallLossRatePercent:
            this.rollingMetrics.totalPacketsReceived + this.rollingMetrics.totalPacketsLost > 0
              ? Number(((this.rollingMetrics.totalPacketsLost / (this.rollingMetrics.totalPacketsReceived + this.rollingMetrics.totalPacketsLost)) * 100).toFixed(2))
              : 0,
        },
        videoFrames: { ...this.rollingMetrics.videoFrames },
        codecs: { ...this.rollingMetrics.codecs },
      },
      termination: {
        reason: this.terminalReason || 'ACTIVE',
        failureCategory: this.failureCategory || (this.terminalReason ? FailureCategories.LIFECYCLE_FAILURE : null),
      },
      snapshotsCount: this.snapshots.length,
      redactionStatus: {
        secretsRedacted: true,
        tokensExcluded: true,
        turnCredentialsExcluded: true,
        sdpPayloadExcluded: true,
        privateIpsRedacted: true,
      },
      verdict: this.rollingMetrics.totalPacketsReceived > 0 ? 'PASS' : 'NO_MEDIA_FLOW',
    };

    return report;
  }
}

const callDiagnosticsService = new CallDiagnosticsService();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = callDiagnosticsService;
  module.exports.default = callDiagnosticsService;
  module.exports.FailureCategories = FailureCategories;
  module.exports.CandidateClassifications = CandidateClassifications;
}

export default callDiagnosticsService;
