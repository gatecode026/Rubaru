const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const { createCustomFirebaseToken, verifyFirebaseToken } = require('../services/firebaseAuthService');

const BASE_URL = 'http://127.0.0.1:5000';
const FIREBASE_API_KEY = 'AIzaSyABA12s3bSdE_iKSNC3x5GWpwN-0F_e9Jw';

async function exchangeCustomTokenForIdToken(customToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(`Failed to exchange custom token: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function runFirebaseVerification() {
  console.log('===============================================================');
  console.log('TESTING FIREBASE PHONE AUTH & FORGOT PASSWORD INTEGRATION');
  console.log('===============================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(' Connected to MongoDB Atlas: dating_app\n');

  // Test User Phone
  const testPhone = '+91998877' + Math.floor(1000 + Math.random() * 9000);
  const testUid = 'fb_uid_' + Date.now();

  console.log(`[1] Creating Firebase verified session for test phone: ${testPhone}...`);
  const customToken = await createCustomFirebaseToken(testUid, { phone_number: testPhone });
  console.log(' Custom token generated from Firebase Admin.');

  const idToken = await exchangeCustomTokenForIdToken(customToken);
  console.log(' Exchanged with Google Identity Toolkit for signed Firebase ID token.');

  // Verify ID token directly with Firebase Admin Service
  const decoded = await verifyFirebaseToken(idToken);
  console.log(`✅ Firebase Admin decoded ID token: UID=${decoded.uid}, Phone=${decoded.phoneNumber}`);

  // Test Backend POST /api/auth/firebase-verify
  console.log('\n[2] Testing Backend Endpoint: POST /api/auth/firebase-verify...');
  const verifyRes = await fetch(`${BASE_URL}/api/auth/firebase-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      displayName: 'Firebase Verified User',
    }),
  });
  const verifyData = await verifyRes.json();
  console.log('Firebase Verify HTTP Status:', verifyRes.status);
  console.log('Firebase Verify Response:', verifyData);

  if (verifyRes.status !== 200 || !verifyData.token) {
    throw new Error('Firebase phone verification endpoint failed');
  }

  // Check MongoDB User record
  const userInDb = await User.findOne({ phone: testPhone });
  if (!userInDb) throw new Error('User record was not created in MongoDB');
  if (!userInDb.isVerified) throw new Error('User is not marked as isVerified');
  if (userInDb.firebaseUid !== testUid) throw new Error('User firebaseUid mismatch in MongoDB');
  console.log(`✅ MongoDB User verified: ID=${userInDb._id}, Phone=${userInDb.phone}, isVerified=${userInDb.isVerified}`);

  // Test Backend POST /api/auth/firebase-reset-password
  console.log('\n[3] Testing Backend Endpoint: POST /api/auth/firebase-reset-password...');
  const newSecretPassword = 'MySecretFirebasePassword123!';
  const resetRes = await fetch(`${BASE_URL}/api/auth/firebase-reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      newPassword: newSecretPassword,
    }),
  });
  const resetData = await resetRes.json();
  console.log('Firebase Reset Password HTTP Status:', resetRes.status);
  console.log('Firebase Reset Password Response:', resetData);

  if (resetRes.status !== 200 || !resetData.token) {
    throw new Error('Firebase reset password endpoint failed');
  }

  // Verify that the new password was updated and works for login
  console.log('\n[4] Testing Login with newly reset password: POST /api/auth/login...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testPhone,
      password: newSecretPassword,
    }),
  });
  const loginData = await loginRes.json();
  console.log('Login HTTP Status:', loginRes.status);
  console.log('Login Response:', loginData);

  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error('Failed to login with newly reset password');
  }
  console.log('✅ Successfully logged in using the newly reset password!');

  console.log('\n===============================================================');
  console.log('🎉 FIREBASE PHONE AUTH & FORGOT PASSWORD INTEGRATION VERIFIED!');
  console.log('===============================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runFirebaseVerification().catch((err) => {
  console.error('\n❌ FIREBASE VERIFICATION FAILED:', err);
  process.exit(1);
});
