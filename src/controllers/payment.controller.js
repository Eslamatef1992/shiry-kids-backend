const { Order, GuestOrder, User, CouponQrCode } = require('../models');
const { assignCouponQrCodes } = require('./order.controller');
const { sendOrderConfirmationEmail } = require('../utils/email');
const { getTapConfig, createCharge, retrieveCharge } = require('../utils/tap');

const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
const API_PREFIX = '/api/v1';

const PAID_STATUSES = ['CAPTURED', 'PAID'];
const FAILED_STATUSES = ['FAILED', 'DECLINED', 'CANCELLED', 'CANCELED', 'RESTRICTED', 'VOID', 'TIMEDOUT', 'UNKNOWN', 'ABANDONED'];

// Public: tells the app whether Tap is configured and which mode/publishable
// key to use. NEVER returns secret keys.
exports.config = async (req, res) => {
  try {
    const { mode, secretKey, publishableKey } = await getTapConfig();
    res.json({ success: true, data: { mode, configured: !!secretKey, publishable_key: publishableKey || '' } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

async function findOrder(orderType, orderId) {
  const type = orderType === 'guest_order' || orderType === 'guest' ? 'guest_order' : 'order';
  const Model = type === 'guest_order' ? GuestOrder : Order;
  const order = await Model.findByPk(orderId);
  return { order, type, Model };
}

// Applies a Tap charge result to the order: updates payment_status and, for
// logged-in user orders that just became paid, sends the confirmation email.
async function applyChargeResult(order, type, chargeData) {
  const status = String(chargeData.status || '').toUpperCase();
  let payment_status = order.payment_status;
  if (PAID_STATUSES.includes(status)) payment_status = 'paid';
  else if (FAILED_STATUSES.includes(status)) payment_status = 'failed';

  const wasUnpaid = order.payment_status !== 'paid';
  if (payment_status !== order.payment_status || (chargeData.id && chargeData.id !== order.tap_charge_id)) {
    await order.update({ payment_status, tap_charge_id: chargeData.id || order.tap_charge_id });
  }

  if (payment_status === 'paid' && wasUnpaid) {
    try {
      // Assign QR codes now that payment is confirmed (was deferred at order creation)
      const resolvedItems = Array.isArray(order.items) ? order.items : [];
      await assignCouponQrCodes(resolvedItems, order.id, type);
    } catch (e) { console.error('QR assignment error:', e.message); }

    if (type === 'order') {
      try {
        const user = await User.findByPk(order.user_id);
        const coupon_qr_codes = await CouponQrCode.findAll({ where: { order_id: order.id, order_type: 'order' } });
        if (user) sendOrderConfirmationEmail(user, order, coupon_qr_codes);
      } catch { /* never block on email */ }
    }
  }

  return payment_status;
}

// Builds the customer block Tap requires from the order/guest order.
async function buildCustomer(order, type) {
  if (type === 'order') {
    const user = await User.findByPk(order.user_id);
    const phoneDigits = String(user?.phone || '00000000').replace(/\D/g, '').slice(-8);
    return {
      first_name: user?.name || 'Customer',
      email: user?.email || undefined,
      phone: { country_code: '965', number: phoneDigits || '00000000' },
    };
  }
  const phoneDigits = String(order.phone || '00000000').replace(/\D/g, '').slice(-8);
  return {
    first_name: order.name || 'Customer',
    phone: { country_code: '965', number: phoneDigits || '00000000' },
  };
}

// Creates a Tap charge for an existing (pending) order/guest order and
// returns the redirect URL the app should open in a WebView.
// Body: { order_id, order_type: 'order'|'guest_order', method: 'knet'|'visa', token_id? }
exports.createTapCharge = async (req, res) => {
  try {
    const { order_id, order_type, method, token_id } = req.body;
    if (!order_id || !order_type) return res.status(400).json({ success: false, message: 'order_id and order_type are required' });

    const { secretKey } = await getTapConfig();
    if (!secretKey) return res.status(503).json({ success: false, message: 'Online payments are not configured yet' });

    const { order, type } = await findOrder(order_type, order_id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.payment_status === 'paid') return res.status(409).json({ success: false, message: 'Order is already paid' });

    let source;
    if (method === 'knet') {
      source = { id: 'src_kw.knet' };
    } else if (method === 'visa' || method === 'card') {
      if (!token_id) return res.status(400).json({ success: false, message: 'token_id is required for card payments' });
      source = { id: token_id };
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported payment method' });
    }

    const redirectUrl = `${APP_URL}${API_PREFIX}/payments/tap/return?order_id=${order.id}&order_type=${type}`;
    const postUrl = `${APP_URL}${API_PREFIX}/payments/tap/webhook`;

    const payload = {
      amount: parseFloat(order.total),
      currency: 'KWD',
      threeDSecure: true,
      save_card: false,
      description: `Shiry Kids Order #${order.order_number}`,
      statement_descriptor: 'Shiry Kids',
      reference: { order: order.order_number },
      metadata: { order_id: String(order.id), order_type: type },
      customer: await buildCustomer(order, type),
      source,
      redirect: { url: redirectUrl },
      post: { url: postUrl },
    };

    const { ok, data } = await createCharge(secretKey, payload);
    if (!ok || data.error) {
      return res.status(502).json({ success: false, message: data?.error?.description || data?.message || 'Failed to create payment charge' });
    }

    await order.update({ tap_charge_id: data.id });

    res.json({
      success: true,
      data: {
        charge_id: data.id,
        status: data.status,
        redirect_url: data.transaction?.url || null,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Tap redirects the browser/WebView here after KNET auth (or card 3DS),
// with ?tap_id=chg_xxx in the query string. We confirm the final status with
// Tap's API, update the order, and render a minimal status page.
exports.tapReturn = async (req, res) => {
  let status = 'pending';
  try {
    const { tap_id, order_id, order_type } = req.query;
    const { secretKey } = await getTapConfig();
    if (tap_id && secretKey && order_id) {
      const { ok, data } = await retrieveCharge(secretKey, tap_id);
      if (ok) {
        const { order, type } = await findOrder(order_type, order_id);
        if (order) status = await applyChargeResult(order, type, data);
      }
    }
  } catch { /* fall through to render a generic page */ }

  const ok = status === 'paid';
  const failed = status === 'failed';
  const title = ok ? 'Payment Successful' : failed ? 'Payment Failed' : 'Payment Processing';
  const color = ok ? '#1DB76A' : failed ? '#FF383C' : '#999999';
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7f7;">
  <div style="text-align:center;padding:24px;">
    <h2 style="color:${color};margin-bottom:8px;">${title}</h2>
    <p style="color:#555;">You can close this window and return to the app.</p>
  </div>
</body></html>`);
};

// Tap server-to-server webhook (async fallback in case the user closes the
// WebView before the redirect completes).
exports.tapWebhook = async (req, res) => {
  try {
    const data = req.body || {};
    const meta = data.metadata || {};
    if (data.id && meta.order_id && meta.order_type) {
      const { secretKey } = await getTapConfig();
      let chargeData = data;
      if (secretKey) {
        const r = await retrieveCharge(secretKey, data.id);
        if (r.ok) chargeData = r.data;
      }
      const { order, type } = await findOrder(meta.order_type, meta.order_id);
      if (order) await applyChargeResult(order, type, chargeData);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Polled by the Flutter app after the payment WebView closes, to learn the
// final payment_status for the order.
exports.tapStatus = async (req, res) => {
  try {
    const { order_id, order_type } = req.query;
    if (!order_id || !order_type) return res.status(400).json({ success: false, message: 'order_id and order_type are required' });
    const { order } = await findOrder(order_type, order_id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: { payment_status: order.payment_status } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
