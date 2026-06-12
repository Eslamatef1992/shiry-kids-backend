const { PushNotification, DeviceToken } = require('../models');
const { getFirebaseAdmin } = require('../config/firebase');
const { paginate, paginateResponse } = require('../utils/helpers');

const APP_URL = process.env.APP_URL || '';
const toAbsolute = (url) => (url && url.startsWith('/') ? `${APP_URL}${url}` : url);

// ── Register / refresh a device's FCM token ───────────────────────────────────
// Called by the app on launch and whenever the FCM token refreshes. Works for
// both logged-in users (req.user set by optionalUserAuth) and guests.
exports.registerToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    const user_id = req.user ? req.user.id : null;
    const [device, created] = await DeviceToken.findOrCreate({
      where: { token },
      defaults: { token, platform: platform || null, user_id },
    });
    if (!created) {
      const updates = {};
      if (platform && device.platform !== platform) updates.platform = platform;
      if (user_id && device.user_id !== user_id) updates.user_id = user_id;
      if (Object.keys(updates).length) await device.update(updates);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Admin: send a broadcast push notification to all registered devices ──────
exports.send = async (req, res) => {
  try {
    const { title, title_ar, body, body_ar, link_type, link_target } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title and body are required' });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const tokens = (await DeviceToken.findAll({ attributes: ['id', 'token'] }));
    const tokenList = tokens.map(t => t.token);

    let sentCount = 0;
    const fbAdmin = getFirebaseAdmin();

    if (fbAdmin && tokenList.length > 0) {
      const message = {
        notification: {
          title,
          body,
          ...(image ? { imageUrl: toAbsolute(image) } : {}),
        },
        data: {
          link_type: link_type || 'none',
          link_target: link_target ? String(link_target) : '',
        },
        tokens: tokenList,
      };

      const response = await fbAdmin.messaging().sendEachForMulticast(message);
      sentCount = response.successCount;

      // Remove tokens that are no longer valid (app uninstalled, etc.)
      const invalidIds = [];
      const errors = [];
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code || '';
          errors.push({ code, message: r.error?.message || '' });
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            invalidIds.push(tokens[idx].id);
          }
        }
      });
      if (invalidIds.length) await DeviceToken.destroy({ where: { id: invalidIds } });
      if (errors.length) console.error('FCM send errors:', JSON.stringify(errors));
      req._fcmErrors = errors;
    }

    const notif = await PushNotification.create({
      title, title_ar: title_ar || null, body, body_ar: body_ar || null,
      image, link_type: link_type || 'none', link_target: link_target || null,
      recipients: tokenList.length, sent_count: sentCount,
      admin_id: req.admin ? req.admin.id : null,
    });

    res.status(201).json({
      success: true,
      data: notif,
      firebase_configured: !!fbAdmin,
      message: fbAdmin
        ? `Sent to ${sentCount} of ${tokenList.length} device(s)`
        : 'Saved, but Firebase is not configured yet — no push was sent.',
      // Temporary diagnostics for Task #95 — remove once push delivery is confirmed working.
      fcm_errors: req._fcmErrors || [],
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Admin: notification history ───────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { count, rows } = await PushNotification.findAndCountAll({
      ...paginate(page, limit),
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
