const mongoose = require('mongoose');

const FollowRelationshipSchema = new mongoose.Schema(
  {
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'REMOVED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
      index: true,
    },
    declinedAt: {
      type: Date,
      default: null,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    lastTransitionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Self-follow constraint validator
FollowRelationshipSchema.pre('validate', function (next) {
  if (this.followerId && this.followingId && this.followerId.toString() === this.followingId.toString()) {
    return next(new Error('Users cannot follow themselves.'));
  }
  next();
});

// Indexes
FollowRelationshipSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
FollowRelationshipSchema.index({ followingId: 1, status: 1, acceptedAt: -1 });
FollowRelationshipSchema.index({ followerId: 1, status: 1, acceptedAt: -1 });
FollowRelationshipSchema.index({ followingId: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model('FollowRelationship', FollowRelationshipSchema);
