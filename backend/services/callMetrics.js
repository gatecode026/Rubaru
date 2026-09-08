/**
 * Observability & Metric Counters for Roobaru Calling & Signaling
 * Aggregates low-cardinality counters across call lifecycles without storing PII/user tokens
 */
class CallMetricsService {
  constructor() {
    this.counters = {
      initiation_attempts: 0,
      authorized_initiations: 0,
      denied_initiations: 0,
      incoming_calls: 0,
      accepted_calls: 0,
      rejected_calls: 0,
      cancelled_calls: 0,
      busy_results: 0,
      missed_calls: 0,
      sdp_validation_failures: 0,
      ice_validation_failures: 0,
      rate_limit_blocks: 0,
      calls_active: 0,
      socket_disconnects_active: 0,
      reconnection_successes: 0,
      reconnection_failures: 0,
      redis_infrastructure_failures: 0,
      legacy_event_invocations: 0,
      terminal_reasons: {},
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

  getMetrics() {
    return { ...this.counters };
  }

  resetMetrics() {
    for (const key of Object.keys(this.counters)) {
      if (typeof this.counters[key] === 'number') {
        this.counters[key] = 0;
      } else if (typeof this.counters[key] === 'object') {
        this.counters[key] = {};
      }
    }
  }
}

const callMetrics = new CallMetricsService();

module.exports = callMetrics;
