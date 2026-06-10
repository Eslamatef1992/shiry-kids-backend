const path = require('path');

let app = null;
let triedInit = false;

/**
 * Lazily initializes the Firebase Admin SDK using a service account JSON file.
 * Set FIREBASE_SERVICE_ACCOUNT_PATH in .env to the absolute (or project-relative)
 * path of the downloaded service account key file.
 *
 * Returns the initialized `firebase-admin` module, or null if not configured /
 * initialization failed (callers should handle this gracefully).
 */
function getFirebaseAdmin() {
  if (app) return app;
  if (triedInit) return null;
  triedInit = true;

  try {
    const admin = require('firebase-admin');
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!keyPath) {
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications are disabled.');
      return null;
    }
    const resolved = path.isAbsolute(keyPath) ? keyPath : path.join(__dirname, '../../', keyPath);
    const serviceAccount = require(resolved);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    app = admin;
    console.log('✅ Firebase Admin initialized');
    return app;
  } catch (e) {
    console.warn('⚠️  Firebase Admin not initialized:', e.message);
    return null;
  }
}

module.exports = { getFirebaseAdmin };
