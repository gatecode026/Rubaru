/**
 * Central Message Interactions Configuration
 * R3-09-REQ-002, R3-09-REQ-013, R3-09-REQ-026
 */

const interactionConfig = Object.freeze({
  reactions: {
    allowed: ['LIKE', 'LOVE', 'LAUGH', 'SURPRISED', 'SAD', 'ANGRY', 'FIRE', '100'],
    aliasMap: {
      '👍': 'LIKE',
      '❤️': 'LOVE',
      '😂': 'LAUGH',
      '😮': 'SURPRISED',
      '😢': 'SAD',
      '😡': 'ANGRY',
      '🔥': 'FIRE',
      '💯': '100',
      'like': 'LIKE',
      'love': 'LOVE',
      'laugh': 'LAUGH',
      'surprised': 'SURPRISED',
      'sad': 'SAD',
      'angry': 'ANGRY',
      'fire': 'FIRE',
      '100': '100',
    },
    maxReactionsPerUserPerMessage: 1,
  },
  replies: {
    maxTextPreviewLength: 120,
  },
  polls: {
    minOptions: 2,
    maxOptions: 10,
    maxQuestionLength: 250,
    maxOptionLength: 100,
    minDurationMs: 60 * 1000,              // 1 minute minimum
    maxDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days maximum
  },
  rateLimits: {
    reactionMutationWindowMs: 5000,
    maxReactionMutationsPerWindow: 20,
    pollVoteWindowMs: 5000,
    maxPollVotesPerWindow: 20,
    pollCreationWindowMs: 60000,
    maxPollCreationsPerWindow: 10,
  },
});

module.exports = interactionConfig;
