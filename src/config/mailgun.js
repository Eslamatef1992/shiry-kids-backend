let client = null;
let triedInit = false;

/**
 * Lazily initializes the Mailgun client using credentials from .env:
 *   MAILGUN_API_KEY  - the Mailgun "Sending Key" (NEVER commit this)
 *   MAILGUN_DOMAIN   - e.g. mg.shirykids.com
 *
 * Returns the initialized mailgun.js client, or null if not configured /
 * initialization failed (callers should handle this gracefully so email
 * sending never breaks the main request flow).
 */
function getMailgunClient() {
  if (client) return client;
  if (triedInit) return null;
  triedInit = true;

  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  MAILGUN_API_KEY not set — transactional emails are disabled.');
      return null;
    }
    const formData = require('form-data');
    const Mailgun = require('mailgun.js');
    const mailgun = new Mailgun(formData);
    client = mailgun.client({ username: 'api', key: apiKey });
    console.log('✅ Mailgun client initialized');
    return client;
  } catch (e) {
    console.warn('⚠️  Mailgun client not initialized:', e.message);
    return null;
  }
}

module.exports = { getMailgunClient };
