const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');

// Helper: Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
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
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create OTP
    const otpCode = '1234'; // Default mock OTP for developer ease, or Math.floor(1000 + Math.random() * 9000).toString()
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    const user = await User.create({
      email,
      password: hashedPassword,
      otp: {
        code: otpCode,
        expiresAt: otpExpires,
      },
      isActive: false, // Wait until OTP is verified
    });

    console.log(`[AUTH] Registered ${email}. Mock OTP is ${otpCode}`);

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent.',
      email: user.email,
      otp: otpCode,
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
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create OTP
    const otpCode = '1234'; // Default mock OTP
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    const user = await User.create({
      phone,
      password: hashedPassword,
      otp: {
        code: otpCode,
        expiresAt: otpExpires,
      },
      isActive: false,
    });

    console.log(`[AUTH] Registered ${phone}. Mock OTP is ${otpCode}`);

    res.status(201).json({
      message: 'Registration initiated. Verification OTP sent.',
      phone: user.phone,
      otp: otpCode,
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
      if (!user.isActive) {
        // Send a new OTP
        const otpCode = '1234';
        user.otp = {
          code: otpCode,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        };
        await user.save();
        console.log(`[AUTH LOGIN] User unverified: ${user.email || user.phone}`);
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
// @access  Private
const profileSetup = async (req, res) => {
  const { displayName, dateOfBirth, gender, interests, bio, locationName } = req.body;

  if (!displayName || !dateOfBirth || !gender) {
    return res.status(400).json({ message: 'Please provide name, birthdate, and gender' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found'});
    }

    let parsedInterests = [];
    if (interests) {         
      parsedInterests = typeof interests === 'string' ? JSON.parse(interests) : interests;
    }

    // Check if avatar is uploaded
    let avatarUri = 'https://i.pravatar.cc/150?img=60';
    if (req.file) {
      avatarUri = `/uploads/images/${req.file.filename}`;
    }

    // Upsert profile
    let profile = await Profile.findOne({ user: req.user._id });
    if (profile) {
      profile.displayName = displayName;
      if (dateOfBirth) profile.dateOfBirth = new Date(dateOfBirth);
      if (gender) profile.gender = gender;
      if (parsedInterests) profile.interests = parsedInterests;
      if (bio !== undefined) profile.bio = bio;
      if (avatarUri) profile.avatarUri = avatarUri;
      if (locationName) profile.locationName = locationName;
      await profile.save();
    } else {
      profile = await Profile.create({
        user: req.user._id,
        displayName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        interests: parsedInterests,
        bio: bio || '',
        avatarUri,
        locationName: locationName || '',
      });
    }

    user.isProfileSetup = true;
    await user.save();

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

module.exports = {
  registerEmail,
  registerPhone,
  register,
  verifyOtp,
  login,
  profileSetup,
  setPassword,
};
