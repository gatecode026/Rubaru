const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Content = require('../models/Content');
const imagekitService = require('../services/imagekitService');
const otpService = require('../services/otpService');
const firebaseAuthService = require('../services/firebaseAuthService');

// Helper: Generate JWT (Long-lived for persistent login: 10 years)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '3650d',
  });
};

// @desc    Register user with Email
// @route   POST /api/auth/register-email
// @access  Public
const registerEmail = async (req, res) => {
  const { email, password = 'default_password_123456' } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please provide email' });
  }

  try {
    const userExists = await User.findOne({ email: email.trim().toLowerCase() });
    if (userExists) {
      const otpCode = otpService.generateOtp(4);
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      userExists.otp = {
        code: otpCode,
        expiresAt: otpExpires,
      };
      await userExists.save();

      const dispatchResult = await otpService.sendEmailOtp(userExists.email, otpCode);

      return res.status(200).json({
        message: 'Verification OTP sent to registered email.',
        email: userExists.email,
        messageId: dispatchResult.messageId,
        provider: dispatchResult.provider,
        otp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
        isExistingUser: true,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create real cryptographic OTP with 10 minute expiry
    const otpCode = otpService.generateOtp(4);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = await User.create({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      otp: {
        code: otpCode,
        expiresAt: otpExpires,
      },
      isActive: false, // Wait until OTP is verified
    });

    const dispatchResult = await otpService.sendEmailOtp(user.email, otpCode);

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent.',
      email: user.email,
      messageId: dispatchResult.messageId,
      provider: dispatchResult.provider,
      otp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register user with Phone
// @route   POST /api/auth/register-phone
// @access  Public
const registerPhone = async (req, res) => {
  const { phone, password = 'default_password_123456' } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Please provide phone number' });
  }

  try {
    const normalizedPhone = otpService.normalizePhone(phone);
    const userExists = await User.findOne({
      $or: [{ phone: phone.trim() }, { phone: normalizedPhone }],
    });
    if (userExists) {
      // Existing user logging in via phone OTP
      const otpCode = otpService.generateOtp(4);
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      userExists.otp = {
        code: otpCode,
        expiresAt: otpExpires,
      };
      await userExists.save();

      const dispatchResult = await otpService.sendSmsOtp(userExists.phone, otpCode);

      return res.status(200).json({
        message: 'Verification OTP sent to registered mobile.',
        phone: userExists.phone,
        messageId: dispatchResult.messageId,
        provider: dispatchResult.provider,
        otp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
        isExistingUser: true,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create real cryptographic OTP with 10 minute expiry
    const otpCode = otpService.generateOtp(4);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = await User.create({
      phone: normalizedPhone,
      password: hashedPassword,
      otp: {
        code: otpCode,
        expiresAt: otpExpires,
      },
      isActive: false,
    });

    const dispatchResult = await otpService.sendSmsOtp(user.phone, otpCode);

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent.',
      phone: user.phone,
      messageId: dispatchResult.messageId,
      provider: dispatchResult.provider,
      otp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  const { email, phone, otpCode } = req.body;

  if (!otpCode) {
    return res.status(400).json({ message: 'Please provide the OTP code' });
  }

  try {
    let query = {};
    if (email) query.email = email;
    else if (phone) query.phone = phone;
    else {
      return res.status(400).json({ message: 'Please provide email or phone' });
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check OTP
    if (!user.otp || user.otp.code !== otpCode) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: 'OTP code has expired' });
    }

    // OTP is valid
    user.isActive = true;
    user.otp = undefined; // clear OTP
    await user.save();

    res.status(200).json({
      message: 'OTP verified successfully',
      token: generateToken(user._id),
      isProfileSetup: user.isProfileSetup,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function normalizePhone(p) {
  if (!p) return '';
  const digits = p.replace(/[^0-9]/g, '');
  return digits.slice(-10);
}

// @desc    Authenticate User & Login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, phone, password } = req.body;

  if ((!email && !phone) || !password) {
    return res.status(400).json({ message: 'Please provide credentials and password' });
  }

  try {
    let query = {};
    if (email) {
      query.email = email.trim().toLowerCase();
    } else if (phone) {
      const clean = normalizePhone(phone);
      query.$or = [
        { phone: phone.trim() },
        { phone: clean },
        { phone: `+91${clean}` },
        { phone: new RegExp(`${clean}$`) },
      ];
    }

    console.log('[AUTH LOGIN] Querying candidate users with:', query);
    const candidateUsers = await User.find(query);

    let user = null;
    for (const candidate of candidateUsers) {
      if (candidate.password && (await bcrypt.compare(password, candidate.password))) {
        user = candidate;
        break;
      }
    }

    if (user) {
      if (user.accountStatus === 'DELETED') {
        return res.status(403).json({ message: 'This account has been deleted.' });
      }

      if (!user.isActive) {
        // Send a new real OTP
        const otpCode = otpService.generateOtp(4);
        user.otp = {
          code: otpCode,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        };
        await user.save();
        if (user.email) {
          await otpService.sendEmailOtp(user.email, otpCode);
        } else if (user.phone) {
          await otpService.sendSmsOtp(user.phone, otpCode);
        }
        console.log(`[AUTH LOGIN] User unverified: ${user.email || user.phone}. Sent OTP.`);
        return res.status(403).json({
          message: 'Account is not verified. A new OTP has been sent.',
          unverified: true,
        });
      }

      console.log(`[AUTH LOGIN] Successful login for: ${user.email || user.phone} (ID: ${user._id})`);
      return res.status(200).json({
        _id: user._id,
        email: user.email,
        phone: user.phone,
        points: user.points,
        isProfileSetup: user.isProfileSetup,
        token: generateToken(user._id),
      });
    } else {
      console.log(`[AUTH LOGIN] Failed login attempt. Candidates found: ${candidateUsers.length}`);
      return res.status(401).json({ message: 'Invalid email/phone or password' });
    }
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    First-time Profile Setup
// @route   POST /api/auth/profile-setup
const profileSetup = async (req, res) => {
  let { displayName, dateOfBirth, gender, interests, bio, locationName } = req.body || {};

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Robust fallbacks for onboarding fields
    if (!displayName || typeof displayName !== 'string' || displayName.trim() === '' || displayName.includes('undefined')) {
      displayName = user.email ? user.email.split('@')[0] : (user.phone ? `User_${user.phone.slice(-4)}` : 'Rubaru User');
    } else {
      displayName = displayName.trim();
    }

    let parsedDob = new Date(dateOfBirth);
    if (!dateOfBirth || isNaN(parsedDob.getTime())) {
      parsedDob = new Date('1998-01-01');
    }

    const finalGender = gender && ['Male', 'Female', 'More', 'Other'].includes(gender) ? gender : 'Female';

    let parsedInterests = [];
    if (interests) {         
      parsedInterests = typeof interests === 'string' ? JSON.parse(interests) : interests;
    }

    // Check if avatar is uploaded
    let avatarUri = null;
    if (req.file) {
      try {
        const uploadedAvatar = await imagekitService.uploadLocalFile(
          req.file.path,
          req.file.filename,
          imagekitService.FOLDERS.AVATARS,
          ['avatar', req.user._id.toString()]
        );
        avatarUri = uploadedAvatar.url;
      } catch (avatarErr) {
        console.warn('[AUTH SETUP AVATAR IMAGEKIT FALLBACK]', avatarErr.message);
        avatarUri = `/uploads/images/${req.file.filename}`;
      }
    }

    // Upsert profile
    let profile = await Profile.findOne({ user: req.user._id });
    if (profile) {
      profile.displayName = displayName;
      profile.dateOfBirth = parsedDob;
      profile.gender = finalGender;
      if (parsedInterests) profile.interests = parsedInterests;
      if (bio !== undefined) profile.bio = bio;
      if (avatarUri) profile.avatarUri = avatarUri;
      if (locationName) profile.locationName = locationName;
      await profile.save();
    } else {
      profile = await Profile.create({
        user: req.user._id,
        displayName,
        dateOfBirth: parsedDob,
        gender: finalGender,
        interests: parsedInterests,
        bio: bio || '',
        avatarUri,
        locationName: locationName || '',
      });
    }

    await User.findByIdAndUpdate(req.user._id, { isProfileSetup: true });

    res.status(201).json({
      message: 'Profile setup completed',
      profile,
    });
  } catch (error) {
    console.error('[PROFILE SETUP ERROR]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register user with both Email and Phone (mandatory)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { email, phone, password = 'default_password_123456' } = req.body;

  if (!email || !phone) {
    return res.status(400).json({ message: 'Both email and phone number are mandatory' });
  }

  try {
    const emailClean = email.toLowerCase().trim();
    const phoneClean = phone.trim();

    const emailExists = await User.findOne({ email: emailClean });
    if (emailExists) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const phoneExists = await User.findOne({ phone: phoneClean });
    if (phoneExists) {
      return res.status(400).json({ message: 'An account with this phone number already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otpCode = '1234';
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const user = await User.create({
      email: emailClean,
      phone: phoneClean,
      password: hashedPassword,
      otp: {
        code: otpCode,
        expiresAt: otpExpires,
      },
      isActive: false,
    });

    console.log(`[AUTH] Registered user with Email: ${emailClean} and Phone: ${phoneClean}. Mock OTP: ${otpCode}`);

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent.',
      email: user.email,
      phone: user.phone,
      otp: otpCode,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set password for user (mandatory after OTP verification)
// @route   POST /api/auth/set-password
// @access  Private
const setPassword = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Please provide a password' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); 
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    res.status(200).json({ message: 'Password set successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current authenticated user status
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const profile = await Profile.findOne({ user: user._id });
    res.status(200).json({
      _id: user._id,
      email: user.email,
      phone: user.phone,
      points: user.points,
      isActive: user.isActive,
      isProfileSetup: user.isProfileSetup,
      accountStatus: user.accountStatus,
      profile: profile || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete / Deactivate current user account
// @route   DELETE /api/auth/account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    user.accountStatus = 'DELETED';
    await user.save();

    await Profile.findOneAndUpdate(
      { user: userId },
      { $set: { bio: '[Deleted Account]', displayName: 'Deleted User', avatarUri: null } }
    );

    await Content.updateMany(
      { authorId: userId },
      { $set: { status: 'DELETED' } }
    );

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[AUTH DELETE ACCOUNT ERROR]', error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Resend OTP to email or phone
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
  const { email, phone } = req.body;
  if (!email && !phone) {
    return res.status(400).json({ message: 'Please provide email or phone' });
  }

  try {
    let query = {};
    if (email) {
      query.email = email.trim().toLowerCase();
    } else if (phone) {
      const normalizedPhone = otpService.normalizePhone(phone);
      query.$or = [{ phone: phone.trim() }, { phone: normalizedPhone }];
    }

    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otpCode = otpService.generateOtp(4);
    user.otp = {
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };
    await user.save();

    let dispatchResult;
    if (user.email) {
      dispatchResult = await otpService.sendEmailOtp(user.email, otpCode);
    } else {
      dispatchResult = await otpService.sendSmsOtp(user.phone, otpCode);
    }

    return res.status(200).json({
      message: 'Verification OTP resent successfully.',
      messageId: dispatchResult.messageId,
      provider: dispatchResult.provider,
      otp: process.env.NODE_ENV === 'production' ? undefined : otpCode,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Phone via Firebase ID Token (Login or Register)
// @route   POST /api/auth/firebase-verify
// @access  Public
const firebasePhoneVerify = async (req, res) => {
  const { idToken, displayName } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID token is required' });
  }

  try {
    const { uid, phoneNumber, email } = await firebaseAuthService.verifyFirebaseToken(idToken);

    if (!phoneNumber && !email) {
      return res.status(400).json({ message: 'Firebase token did not contain a verified phone or email' });
    }

    let user = null;
    if (phoneNumber) {
      const normalizedPhone = otpService.normalizePhone(phoneNumber);
      const clean10 = normalizePhone(phoneNumber);
      user = await User.findOne({
        $or: [
          { firebaseUid: uid },
          { phone: phoneNumber },
          { phone: normalizedPhone },
          { phone: clean10 },
          { phone: `+91${clean10}` },
        ],
      });
    } else if (email) {
      user = await User.findOne({
        $or: [{ firebaseUid: uid }, { email: email.trim().toLowerCase() }],
      });
    }

    if (!user) {
      const defaultPassword = await bcrypt.hash(`fb_${uid}_${Date.now()}`, 10);
      user = await User.create({
        phone: phoneNumber ? otpService.normalizePhone(phoneNumber) : undefined,
        email: email ? email.trim().toLowerCase() : undefined,
        password: defaultPassword,
        firebaseUid: uid,
        isActive: true,
        isVerified: true,
        isProfileSetup: false,
      });

      await Profile.create({
        user: user._id,
        displayName: displayName || (phoneNumber ? `User ${phoneNumber.slice(-4)}` : 'New User'),
        gender: 'OTHER',
      }).catch((e) => console.warn('[PROFILE AUTO-CREATE WARN]', e.message));
    } else {
      user.firebaseUid = uid;
      user.isActive = true;
      user.isVerified = true;
      await user.save();
    }

    const token = generateToken(user._id);
    const profile = await Profile.findOne({ user: user._id });

    return res.status(200).json({
      success: true,
      message: 'Firebase phone verification successful',
      token,
      isProfileSetup: user.isProfileSetup,
      user: {
        _id: user._id,
        phone: user.phone,
        email: user.email,
        isActive: user.isActive,
        isProfileSetup: user.isProfileSetup,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error('[FIREBASE PHONE VERIFY ERROR]', error);
    return res.status(401).json({ message: error.message });
  }
};

// @desc    Reset Password via Firebase verification
// @route   POST /api/auth/firebase-reset-password
// @access  Public
const firebaseResetPassword = async (req, res) => {
  const { idToken, newPassword } = req.body;

  if (!idToken || !newPassword) {
    return res.status(400).json({ message: 'Please provide Firebase ID token and new password' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const { uid, phoneNumber, email } = await firebaseAuthService.verifyFirebaseToken(idToken);

    let user = null;
    if (phoneNumber) {
      const normalizedPhone = otpService.normalizePhone(phoneNumber);
      const clean10 = normalizePhone(phoneNumber);
      user = await User.findOne({
        $or: [
          { firebaseUid: uid },
          { phone: phoneNumber },
          { phone: normalizedPhone },
          { phone: clean10 },
          { phone: `+91${clean10}` },
        ],
      });
    } else if (email) {
      user = await User.findOne({
        $or: [{ firebaseUid: uid }, { email: email.trim().toLowerCase() }],
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'No account found matching this verified credential' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.firebaseUid = uid;
    user.isActive = true;
    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      token,
    });
  } catch (error) {
    console.error('[FIREBASE RESET PASSWORD ERROR]', error);
    return res.status(401).json({ message: error.message });
  }
};

module.exports = {
  registerEmail,
  registerPhone,
  register,
  verifyOtp,
  resendOtp,
  firebasePhoneVerify,
  firebaseResetPassword,
  login,
  profileSetup,
  setPassword,
  getMe,
  deleteAccount,
};

