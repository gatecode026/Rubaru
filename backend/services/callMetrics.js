/**
 * Observability & Metric Counters for Rubaru Calling & Signaling (R4-C20 / R4-C21)
 * Aggregates low-cardinality counters, setup latencies, connectivity types,
 * media health, and client diagnostic telemetry without storing PII/user tokens.
 */
class CallMetricsService {
  constructor() {
    this.resetMetrics();
  }

  resetMetrics() {
    this.counters = {
      // Volume
      initiation_attempts: 0,
      authorized_initiations: 0,
      denied_initiations: 0,
      incoming_calls: 0,
      accepted_calls: 0,
      rejected_calls: 0,
      cancelled_calls: 0,
      completed_calls: 0,
      failed_calls: 0,
      busy_results: 0,
      missed_calls: 0,

      // Signaling & Infrastructure
      sdp_validation_failures: 0,
      ice_validation_failures: 0,
      rate_limit_blocks: 0,
      calls_active: 0,
      socket_disconnects_active: 0,
      reconnection_successes: 0,
      reconnection_failures: 0,
      redis_infrastructure_failures: 0,
      legacy_event_invocations: 0,

      // Connectivity
      ice_failures: 0,
      dtls_failures: 0,
      turn_relay_connections: 0,
      direct_connections: 0,
      stun_srflx_connections: 0,

      // Media
      rtp_failures: 0,
      video_decode_failures: 0,

      // Client-side Errors
      mic_permission_denied: 0,
      camera_permission_denied: 0,
      audio_capture_failures: 0,
      audio_routing_failures: 0,
      video_capture_failures: 0,
      webrtc_errors: 0,

      // Billing
      billable_calls: 0,
      non_connected_calls: 0,
      billing_failures: 0,
      duplicate_billing_blocks: 0,

      terminal_reasons: {},
    };

    // Statistical sample buffers (bounded to max 100 items each to prevent memory growth)
    this.sampleBuffers = {
      setup_duration_ms: [],
      time_to_ice_ms: [],
      time_to_dtls_ms: [],
      time_to_first_rtp_ms: [],
      packet_loss_pct: [],
      jitter_ms: [],
      rtt_ms: [],
    };
  }

  increment(metricName, by = 1) {
    if (typeof this.counters[metricName] === 'number') {
      this.counters[metricName] += by;
    }
  }

  recordTerminalReason(reason) {
    const key = reason || 'UNKNOWN';
    this.counters.terminal_reasons[key] = (this.counters.terminal_reasons[key] || 0) + 1;
  }

  _addSample(bufferName, val) {
    if (typeof val === 'number' && !isNaN(val) && val >= 0) {
      const buf = this.sampleBuffers[bufferName];
      if (buf) {
        if (buf.length >= 100) buf.shift();
        buf.push(val);
      }
    }
  }

  _calculateAvg(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / arr.length) * 10) / 10;
  }

  _calculateP95(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return Math.round(sorted[idx] * 10) / 10;
  }

  /**
   * Ingest sanitized client diagnostics summary
   * @param {Object} diagnostics
   */
  recordClientDiagnostics(diagnostics) {
    if (!diagnostics || typeof diagnostics !== 'object') return;

    // 1. Ingest timeline durations
    const timeline = diagnostics.timeline || {};
    if (timeline.setupDurationMs) this._addSample('setup_duration_ms', timeline.setupDurationMs);
    if (timeline.timeToIceMs) this._addSample('time_to_ice_ms', timeline.timeToIceMs);
    if (timeline.timeToDtlsMs) this._addSample('time_to_dtls_ms', timeline.timeToDtlsMs);
    if (timeline.timeToFirstRtpMs) this._addSample('time_to_first_rtp_ms', timeline.timeToFirstRtpMs);

    // 2. Ingest connection type
    const conn = diagnostics.connection || {};
    const candidateType = conn.candidateType || '';
    if (candidateType.includes('TURN') || candidateType.includes('RELAY')) {
      this.increment('turn_relay_connections');
    } else if (candidateType.includes('DIRECT')) {
      this.increment('direct_connections');
    } else if (candidateType.includes('STUN') || candidateType.includes('SRFLX')) {
      this.increment('stun_srflx_connections');
    }

    // 3. Ingest quality metrics
    const quality = diagnostics.qualityMetrics || {};
    if (quality.packetLossPct !== undefined) this._addSample('packet_loss_pct', quality.packetLossPct);
    if (quality.avgJitterMs !== undefined) this._addSample('jitter_ms', quality.avgJitterMs);
    if (quality.avgRttMs !== undefined) this._addSample('rtt_ms', quality.avgRttMs);

    // 4. Ingest failure classifications
    const termination = diagnostics.termination || {};
    const failureCat = termination.failureCategory || '';
    if (failureCat.includes('ICE FAILURE')) this.increment('ice_failures');
    if (failureCat.includes('DTLS FAILURE')) this.increment('dtls_failures');
    if (failureCat.includes('RTP FAILURE')) this.increment('rtp_failures');
    if (failureCat.includes('AUDIO CAPTURE')) this.increment('audio_capture_failures');
    if (failureCat.includes('AUDIO PLAYBACK') || failureCat.includes('ROUTING')) this.increment('audio_routing_failures');
    if (failureCat.includes('VIDEO CAPTURE')) this.increment('video_capture_failures');
    if (failureCat.includes('VIDEO DECODE') || failureCat.includes('RENDER')) this.increment('video_decode_failures');

    if (termination.permissionDenied) {
      if (termination.permissionType === 'camera') this.increment('camera_permission_denied');
      else this.increment('mic_permission_denied');
    }
  }

  /**
   * Return formatted metrics object
   */
  getMetrics() {
    return {
      counters: { ...this.counters },
      averages: {
        avgSetupDurationMs: this._calculateAvg(this.sampleBuffers.setup_duration_ms),
        p95SetupDurationMs: this._calculateP95(this.sampleBuffers.setup_duration_ms),
        avgTimeToIceMs: this._calculateAvg(this.sampleBuffers.time_to_ice_ms),
        avgTimeToDtlsMs: this._calculateAvg(this.sampleBuffers.time_to_dtls_ms),
        avgTimeToFirstRtpMs: this._calculateAvg(this.sampleBuffers.time_to_first_rtp_ms),
        avgPacketLossPct: this._calculateAvg(this.sampleBuffers.packet_loss_pct),
        avgJitterMs: this._calculateAvg(this.sampleBuffers.jitter_ms),
        avgRttMs: this._calculateAvg(this.sampleBuffers.rtt_ms),
      },
    };
  }

  /**
   * Return high-level operational health status and active alert evaluation
   */
  getOperationalHealth() {
    const metrics = this.getMetrics();
    const c = metrics.counters;
    const a = metrics.averages;

    const totalInitiations = c.initiation_attempts || 0;
    const completed = c.completed_calls || 0;
    const failed = c.failed_calls || 0;
    const totalFinished = completed + failed;

    const successRate = totalFinished > 0 ? Math.round((completed / totalFinished) * 1000) / 10 : 100;
    const iceFailureRate = totalInitiations > 0 ? Math.round((c.ice_failures / totalInitiations) * 1000) / 10 : 0;

    const alerts = [];

    // Alert 1: High ICE Failure Rate
    if (totalInitiations >= 10 && iceFailureRate > 15) {
      alerts.push({
        severity: 'HIGH',
        code: 'ICE_FAILURE_RATE_HIGH',
        message: `ICE failure rate is ${iceFailureRate}% (exceeds 15% threshold). Check TURN server reachability.`,
      });
    }

    // Alert 2: High Call Failure Rate
    if (totalFinished >= 10 && successRate < 80) {
      alerts.push({
        severity: 'HIGH',
        code: 'CALL_SUCCESS_RATE_LOW',
        message: `Call success rate is ${successRate}% (below 80% threshold).`,
      });
    }

    // Alert 3: Signaling Validation / Injection Spikes
    if (c.sdp_validation_failures > 20 || c.ice_validation_failures > 50) {
      alerts.push({
        severity: 'MEDIUM',
        code: 'SIGNALING_VALIDATION_ERRORS_HIGH',
        message: `High volume of invalid SDP or ICE candidate payloads received.`,
      });
    }

    // Alert 4: Billing Failures
    if (c.billing_failures > 0) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'BILLING_FAILURE_DETECTED',
        message: `${c.billing_failures} billing ledger deductions failed.`,
      });
    }

    // Alert 5: DTLS Failure Spike
    if (c.dtls_failures >= 5) {
      alerts.push({
        severity: 'HIGH',
        code: 'DTLS_FAILURE_SPIKE',
        message: `${c.dtls_failures} DTLS handshake failures detected. Check certificate expiration or crypto negotiation.`,
      });
    }

    // Alert 6: Reconnect Storm
    if (c.reconnection_failures >= 10 || (c.socket_disconnects_active > 15 && c.calls_active > 0)) {
      alerts.push({
        severity: 'HIGH',
        code: 'RECONNECT_STORM_DETECTED',
        message: `High volume of active reconnection failures or disconnects during calls. Check socket cluster stability.`,
      });
    }

    // Alert 7: Media Silent Stop / RTP Failure Spike
    if (c.rtp_failures >= 5) {
      alerts.push({
        severity: 'HIGH',
        code: 'RTP_MEDIA_FAILURE_SPIKE',
        message: `${c.rtp_failures} media stream RTP dropouts or silent stops detected.`,
      });
    }

    // Alert 8: Redis Infrastructure Failure
    if (c.redis_infrastructure_failures > 0) {
      alerts.push({
        severity: 'CRITICAL',
        code: 'REDIS_INFRASTRUCTURE_FAILURE',
        message: `${c.redis_infrastructure_failures} Redis cluster or locking operations failed. Fail-closed protection active.`,
      });
    }

    const isHealthy = alerts.filter((al) => al.severity === 'CRITICAL' || al.severity === 'HIGH').length === 0;

    return {
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      evaluatedAt: new Date().toISOString(),
      summary: {
        totalInitiationAttempts: totalInitiations,
        completedCalls: completed,
        failedCalls: failed,
        successRatePercent: successRate,
        iceFailureRatePercent: iceFailureRate,
        turnRelayConnections: c.turn_relay_connections,
        directConnections: c.direct_connections,
        billableCalls: c.billable_calls,
        activeCalls: c.calls_active,
        avgSetupDurationMs: a.avgSetupDurationMs,
        p95SetupDurationMs: a.p95SetupDurationMs,
      },
      alerts,
      metrics,
    };
  }
}

const callMetrics = new CallMetricsService();

module.exports = callMetrics;
