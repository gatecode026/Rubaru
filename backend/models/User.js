const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple nulls if registered via phone
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple nulls if registered via email
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    otp: {
      code: String,
      expiresAt: Date,
    },
    points: {
      type: Number,
      default: 250,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isProfileSetup: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    isAgeVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN'],
      default: 'USER',
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

UserSchema.methods.hasPermission = function (requiredPermission) {
  if (this.role === 'SUPER_ADMIN') {
    return true;
  }
  if (!this.permissions || !Array.isArray(this.permissions)) {
    return false;
  }
  if (this.permissions.includes('*')) {
    return true;
  }
  if (this.permissions.includes(requiredPermission)) {
    return true;
  }
  const prefix = requiredPermission.split('.')[0];
  if (this.permissions.includes(`${prefix}.*`)) {
    return true;
  }
  return false;
};

module.exports = mongoose.model('User', UserSchema);
