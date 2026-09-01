const express = require('express');
const {
  registerEmail,
  registerPhone,
  register,
  verifyOtp,
  login,
  profileSetup,
  setPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/register-email', registerEmail);
router.post('/register-phone', registerPhone);
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

// Protected routes
router.post('/set-password', protect, setPassword);
router.post('/profile-setup', protect, upload.single('avatar'), profileSetup);

module.exports = router;
