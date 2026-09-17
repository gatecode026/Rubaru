const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

function getFirebaseAdminApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, '../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      const app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'dating-app-70137',
      });
      console.log('[FIREBASE ADMIN] Initialized successfully with service account credential.');
      return app;
    } catch (err) {
      console.error('[FIREBASE ADMIN] Failed to initialize with service account:', err.message);
    }
  } else {
    console.warn(`[FIREBASE ADMIN] Service account key not found at ${serviceAccountPath}. Initializing default app.`);
    try {
      return initializeApp();
    } catch (e) {
      console.error('[FIREBASE ADMIN] Default initialization failed:', e.message);
    }
  }

  return getApp();
}

/**
 * Verifies a Firebase ID token sent from the client (mobile/web)
 * @param {string} idToken
 * @returns {Promise<{ uid: string, phoneNumber: string|null, email: string|null, decodedToken: object }>}
 */
async function verifyFirebaseToken(idToken) {
  if (!idToken) {
    throw new Error('Firebase ID token is required');
  }

  const app = getFirebaseAdminApp();
  const auth = getAuth(app);

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number || null,
      email: decodedToken.email || null,
      decodedToken,
    };
  } catch (error) {
    console.error('[FIREBASE AUTH ERROR] Token verification failed:', error.message);
    throw new Error(`Invalid or expired Firebase token: ${error.message}`);
  }
}

/**
 * Creates a custom Firebase token for server-side testing or user linking
 */
async function createCustomFirebaseToken(uid, claims = {}) {
  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  return auth.createCustomToken(uid, claims);
}

module.exports = {
  getFirebaseAdminApp,
  verifyFirebaseToken,
  createCustomFirebaseToken,
  getAuth,
};
