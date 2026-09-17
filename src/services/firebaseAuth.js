import api from './api';
import storage from './storage';
import { connectSocket } from './socket';

const FIREBASE_API_KEY = 'AIzaSyBrOuGa96GdFuQrrDWFt2Gc0kj004KyryM';
const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

/**
 * Normalizes phone number to E.164 format (+91...)
 */
export function formatPhoneNumber(phone, countryCode = '+91') {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  const digits = cleaned.replace(/[^0-9]/g, '');
  const prefixDigits = countryCode.replace(/[^0-9]/g, '');
  if (digits.startsWith(prefixDigits)) {
    return `+${digits}`;
  }
  return `${countryCode}${digits}`;
}

/**
 * Initiates Firebase Phone OTP dispatch
 * @param {string} fullPhoneNumber - Formatted phone number with country code (+91...)
 * @returns {Promise<{ sessionInfo: string }>}
 */
export async function sendFirebasePhoneOtp(fullPhoneNumber) {
  try {
    const response = await fetch(`${IDENTITY_TOOLKIT_URL}:sendVerificationCode?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: fullPhoneNumber,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || 'Failed to send verification code';
      if (errMsg.includes('BILLING_NOT_ENABLED')) {
        throw new Error(
          'Carrier SMS requires the Firebase Blaze plan (which gives 10,000 free SMS/month). To test without billing right now, enter +917340445907 with verification code 123456.'
        );
      } else if (errMsg.includes('OPERATION_NOT_ALLOWED')) {
        throw new Error(
          'Phone Authentication or SMS Region is not enabled in Firebase Console. Please check India (+91) under Authentication > Settings > SMS Regions policy in your Firebase Console.'
        );
      } else if (errMsg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
        throw new Error('Too many requests sent. Please wait a few moments before trying again.');
      } else if (errMsg.includes('INVALID_PHONE_NUMBER')) {
        throw new Error('The phone number entered is invalid. Please check the digits and try again.');
      }
      throw new Error(errMsg);
    }

    return { sessionInfo: data.sessionInfo };
  } catch (error) {
    console.error('[FIREBASE SEND OTP ERROR]', error.message);
    throw error;
  }
}

/**
 * Confirms Firebase 6-digit OTP code and obtains Firebase ID token
 * @param {string} sessionInfo - Session token received from sendFirebasePhoneOtp
 * @param {string} code - 6-digit verification code entered by user
 * @returns {Promise<{ idToken: string, phoneNumber: string, localId: string }>}
 */
export async function confirmFirebasePhoneOtp(sessionInfo, code) {
  try {
    const response = await fetch(`${IDENTITY_TOOLKIT_URL}:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionInfo,
        code,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || 'Verification failed';
      if (errMsg.includes('INVALID_CODE')) {
        throw new Error('Incorrect verification code. Please check and re-enter.');
      } else if (errMsg.includes('SESSION_EXPIRED')) {
        throw new Error('Verification code has expired. Please tap resend.');
      }
      throw new Error(errMsg);
    }

    return {
      idToken: data.idToken,
      phoneNumber: data.phoneNumber,
      localId: data.localId,
    };
  } catch (error) {
    console.error('[FIREBASE CONFIRM OTP ERROR]', error);
    throw error;
  }
}

/**
 * Exchanges verified Firebase ID token for Rubaru session JWT
 * @param {string} idToken - Firebase ID token
 * @param {string} [displayName]
 * @returns {Promise<{ token: string, user: object, isProfileSetup: boolean }>}
 */
export async function completeFirebasePhoneLogin(idToken, displayName) {
  try {
    const response = await api.post('/auth/firebase-verify', {
      idToken,
      displayName,
    });

    const { token, user, isProfileSetup } = response.data;

    // Save session in AsyncStorage
    await storage.saveSession(token, {
      phone: user?.phone,
      email: user?.email,
      isActive: true,
      isProfileSetup,
    });

    // Set authorization header for future API calls
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Connect real-time socket
    connectSocket(token);

    return { token, user, isProfileSetup };
  } catch (error) {
    console.error('[COMPLETE FIREBASE LOGIN ERROR]', error);
    throw error;
  }
}

/**
 * Resets user password using verified Firebase ID token
 * @param {string} idToken - Firebase ID token
 * @param {string} newPassword - New password
 * @returns {Promise<{ token: string }>}
 */
export async function resetPasswordWithFirebase(idToken, newPassword) {
  try {
    const response = await api.post('/auth/firebase-reset-password', {
      idToken,
      newPassword,
    });

    const { token } = response.data;

    if (token) {
      await storage.saveSession(token, {
        isActive: true,
      });
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      connectSocket(token);
    }

    return response.data;
  } catch (error) {
    console.error('[RESET PASSWORD WITH FIREBASE ERROR]', error);
    throw error;
  }
}

export default {
  formatPhoneNumber,
  sendFirebasePhoneOtp,
  confirmFirebasePhoneOtp,
  completeFirebasePhoneLogin,
  resetPasswordWithFirebase,
};
