const express = require('express');
const {
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
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/me', protect, getMe);
router.delete('/account', protect, deleteAccount);
router.post('/register-email', registerEmail);
router.post('/register-phone', registerPhone);
router.post('/register', register);
router.verifyOtp = router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/firebase-verify', firebasePhoneVerify);
router.post('/firebase-reset-password', firebaseResetPassword);
router.post('/login', login);

// Protected routes
router.post('/set-password', protect, setPassword);
router.post('/profile-setup', protect, upload.single('avatar'), profileSetup);

module.exports = router;
