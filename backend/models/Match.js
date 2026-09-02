const mongoose = require('mongoose');
const { MatchStatuses } = require('./enums');

const MatchSchema = new mongoose.Schema(
  {
    canonicalPair: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    status: {
      type: String,
      enum: Object.values(MatchStatuses),
      default: MatchStatuses.ACTIVE,
      index: true,
    },
    initiatorInteraction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DatingInteraction',
      required: true,
    },
    acceptorInteraction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DatingInteraction',
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    matchedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    endReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

function applyCanonicalSort(doc) {
  let id1 = doc.user1 ? doc.user1.toString() : null;
  let id2 = doc.user2 ? doc.user2.toString() : null;

  if ((!id1 || !id2) && Array.isArray(doc.users) && doc.users.length === 2) {
    id1 = doc.users[0] ? doc.users[0].toString() : null;
    id2 = doc.users[1] ? doc.users[1].toString() : null;
  }

  if (id1 && id2) {
    if (id1 === id2) {
      doc.invalidate('user2', 'Self-matches are strictly prohibited');
      return;
    }
    const [lowerId, higherId] = [id1, id2].sort();
    doc.user1 = lowerId;
    doc.user2 = higherId;
    doc.users = [lowerId, higherId];
    doc.canonicalPair = `${lowerId}:${higherId}`;
  }
}

// Pre-validate hook
MatchSchema.pre('validate', function () {
  applyCanonicalSort(this);
});

// Composite index for finding matches for a user
MatchSchema.index({ users: 1, status: 1 });

module.exports = mongoose.model('Match', MatchSchema);
