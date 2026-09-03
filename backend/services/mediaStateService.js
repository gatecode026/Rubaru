/**
 * Media State Lifecycle Manager
 * Centralizes allowed states and enforces validated state transitions for UploadSession and MediaAsset.
 */

const MediaProcessingStates = {
  INITIATED: 'INITIATED',
  AUTHORIZED: 'AUTHORIZED',
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  UPLOADED: 'UPLOADED',
  VERIFYING: 'VERIFYING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
  REJECTED: 'REJECTED',
  QUARANTINED: 'QUARANTINED',
  CANCELLED: 'CANCELLED',
  ORPHANED: 'ORPHANED',
  DELETED: 'DELETED',
};

// Allowed State Transitions Graph
const AllowedTransitions = {
  [MediaProcessingStates.INITIATED]: [
    MediaProcessingStates.AUTHORIZED,
    MediaProcessingStates.CANCELLED,
    MediaProcessingStates.FAILED_PERMANENT,
  ],
  [MediaProcessingStates.AUTHORIZED]: [
    MediaProcessingStates.PENDING_UPLOAD,
    MediaProcessingStates.UPLOADED,
    MediaProcessingStates.CANCELLED,
    MediaProcessingStates.ORPHANED,
    MediaProcessingStates.FAILED_RETRYABLE,
    MediaProcessingStates.FAILED_PERMANENT,
  ],
  [MediaProcessingStates.PENDING_UPLOAD]: [
    MediaProcessingStates.UPLOADED,
    MediaProcessingStates.CANCELLED,
    MediaProcessingStates.ORPHANED,
    MediaProcessingStates.FAILED_RETRYABLE,
    MediaProcessingStates.FAILED_PERMANENT,
  ],
  [MediaProcessingStates.UPLOADED]: [
    MediaProcessingStates.VERIFYING,
    MediaProcessingStates.PROCESSING,
    MediaProcessingStates.CANCELLED,
    MediaProcessingStates.FAILED_RETRYABLE,
    MediaProcessingStates.FAILED_PERMANENT,
  ],
  [MediaProcessingStates.VERIFYING]: [
    MediaProcessingStates.PROCESSING,
    MediaProcessingStates.READY,
    MediaProcessingStates.QUARANTINED,
    MediaProcessingStates.REJECTED,
    MediaProcessingStates.FAILED_RETRYABLE,
    MediaProcessingStates.FAILED_PERMANENT,
  ],
  [MediaProcessingStates.PROCESSING]: [
    MediaProcessingStates.READY,
    MediaProcessingStates.QUARANTINED,
    MediaProcessingStates.REJECTED,
    MediaProcessingStates.FAILED_RETRYABLE,
    MediaProcessingStates.FAILED_PERMANENT,
  ],
  [MediaProcessingStates.READY]: [
    MediaProcessingStates.DELETED,
    MediaProcessingStates.QUARANTINED, // If retroactive moderation flags it
  ],
  [MediaProcessingStates.FAILED_RETRYABLE]: [
    MediaProcessingStates.PENDING_UPLOAD,
    MediaProcessingStates.UPLOADED,
    MediaProcessingStates.PROCESSING,
    MediaProcessingStates.CANCELLED,
    MediaProcessingStates.FAILED_PERMANENT,
    MediaProcessingStates.DELETED,
  ],
  [MediaProcessingStates.FAILED_PERMANENT]: [
    MediaProcessingStates.DELETED,
  ],
  [MediaProcessingStates.REJECTED]: [
    MediaProcessingStates.DELETED,
  ],
  [MediaProcessingStates.QUARANTINED]: [
    MediaProcessingStates.DELETED, // Only authorized safety purge
  ],
  [MediaProcessingStates.CANCELLED]: [
    MediaProcessingStates.DELETED,
  ],
  [MediaProcessingStates.ORPHANED]: [
    MediaProcessingStates.DELETED,
  ],
  [MediaProcessingStates.DELETED]: [],
};

class MediaStateService {
  /**
   * Validate if a transition from currentState to targetState is allowed
   * @param {string} currentState
   * @param {string} targetState
   * @returns {boolean}
   */
  canTransition(currentState, targetState) {
    if (currentState === targetState) return true; // Idempotent same-state
    const allowed = AllowedTransitions[currentState];
    return Array.isArray(allowed) && allowed.includes(targetState);
  }

  /**
   * Enforce and transition state or throw validation error
   */
  assertTransition(currentState, targetState, context = '') {
    if (!this.canTransition(currentState, targetState)) {
      const err = new Error(
        `Illegal media state transition from '${currentState}' to '${targetState}'${context ? ` in ${context}` : ''}`
      );
      err.code = 'ILLEGAL_STATE_TRANSITION';
      err.statusCode = 400;
      throw err;
    }
  }

  getStates() {
    return { ...MediaProcessingStates };
  }
}

const mediaStateService = new MediaStateService();

module.exports = {
  MediaProcessingStates,
  mediaStateService,
};
