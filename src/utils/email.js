const fs = require('fs');
const path = require('path');
const { getMailgunClient } = require('../config/mailgun');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../uploads');

const APP_NAME = 'Shiry Kids';

// Logo bundled with the backend, embedded as an inline (cid:) attachment so
// it shows up reliably across email clients without hotlinking an image.
const LOGO_PATH = path.join(__dirname, '../assets/email/logo.png');
const LOGO_CID = 'shiry-kids-logo.png';

const getLogoAttachment = () => {
  try {
    if (!fs.existsSync(LOGO_PATH)) return null;
    return { filename: LOGO_CID, data: fs.readFileSync(LOGO_PATH) };
  } catch (e) {
    console.error('getLogoAttachment error:', e.message);
    return null;
  }
};

const FROM = () => {
  const email = process.env.MAILGUN_FROM_EMAIL || `no-reply@${process.env.MAILGUN_DOMAIN || 'shirykids.com'}`;
  const name = process.env.MAILGUN_FROM_NAME || APP_NAME;
  return `${name} <${email}>`;
};

// Wraps body HTML in a simple branded layout.
const layout = (title, bodyHtml) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f7f7f7;padding:24px 0;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
      <div style="background:#FF383C;padding:20px 24px;text-align:center;">
        <img src="cid:${LOGO_CID}" alt="${APP_NAME}" style="height:48px;width:auto;display:inline-block;vertical-align:middle;" />
      </div>
      <div style="padding:24px;color:#333;">
        <h2 style="margin-top:0;font-size:18px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#fafafa;color:#999;font-size:12px;text-align:center;">
        © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
      </div>
    </div>
  </div>
`;

// Converts a data URL (e.g. "data:image/png;base64,....") into a Buffer + filename.
const dataUrlToAttachment = (dataUrl, filename) => {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { filename, data: Buffer.from(match[2], 'base64') };
};

// Reads a stored upload (e.g. "/uploads/xxx.png") from disk into an attachment.
const uploadPathToAttachment = (uploadPath, filename) => {
  try {
    if (!uploadPath) return null;
    const rel = uploadPath.replace(/^\/?uploads\//, '');
    const fullPath = path.join(UPLOAD_DIR, rel);
    if (!fs.existsSync(fullPath)) return null;
    return { filename: filename || path.basename(fullPath), data: fs.readFileSync(fullPath) };
  } catch (e) {
    console.error('uploadPathToAttachment error:', e.message);
    return null;
  }
};

/**
 * Generic email sender. Never throws — logs and returns false on failure so
 * email sending never breaks the calling request flow.
 */
async function sendEmail({ to, subject, html, attachment, inline }) {
  try {
    if (!to) return false;
    const mg = getMailgunClient();
    const domain = process.env.MAILGUN_DOMAIN;
    if (!mg || !domain) {
      console.warn('⚠️  Mailgun not configured — skipping email to', to);
      return false;
    }
    const messageData = { from: FROM(), to, subject, html };
    if (attachment && attachment.length) messageData.attachment = attachment.filter(Boolean);
    if (inline && inline.length) messageData.inline = inline.filter(Boolean);
    await mg.messages.create(domain, messageData);
    return true;
  } catch (e) {
    console.error('sendEmail error:', e.message);
    return false;
  }
}

// ── Password reset ────────────────────────────────────────────────────────────
async function sendPasswordResetEmail(user, code) {
  const html = layout('Reset Your Password', `
    <p>Hi ${user.name || ''},</p>
    <p>We received a request to reset your password. Use the code below to continue:</p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;font-size:28px;font-weight:700;letter-spacing:6px;background:#f3f3f3;padding:12px 24px;border-radius:8px;color:#FF383C;">${code}</span>
    </div>
    <p>This code will expire in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
  `);
  const inline = [getLogoAttachment()].filter(Boolean);
  return sendEmail({ to: user.email, subject: `${APP_NAME} - Password Reset Code`, html, inline });
}

// ── Order confirmation (incl. coupon QR codes if any) ──────────────────────────
async function sendOrderConfirmationEmail(user, order, couponQrCodes = []) {
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${it.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${it.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(it.total).toFixed(3)}</td>
    </tr>
  `).join('');

  const inline = [getLogoAttachment()].filter(Boolean);

  // Note: we intentionally do NOT attach the generic order.qr_code here —
  // QR codes are only relevant for Coupon items, and those are sent below
  // as the per-unit assigned coupon QR codes.
  let couponHtml = '';
  const validCoupons = (couponQrCodes || []).map((c, i) => {
    const filename = `coupon-qr-${i + 1}.png`;
    const att = uploadPathToAttachment(c.image, filename);
    if (!att) return null;
    inline.push(att);
    return filename;
  }).filter(Boolean);

  if (validCoupons.length) {
    couponHtml = `
      <p style="margin-top:24px;">Your coupon QR code${validCoupons.length > 1 ? 's are' : ' is'} attached to this email${validCoupons.length > 1 ? '' : ''} — present it to redeem:</p>
      <div style="text-align:center;">
        ${validCoupons.map(f => `<img src="cid:${f}" alt="Coupon QR Code" style="width:160px;height:160px;margin:8px;" />`).join('')}
      </div>
    `;
  }

  const html = layout('Order Confirmed!', `
    <p>Hi ${user.name || ''},</p>
    <p>Thanks for your order <strong>#${order.order_number}</strong>. Here's a summary:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr>
          <th style="padding:8px;text-align:left;border-bottom:2px solid #FF383C;">Item</th>
          <th style="padding:8px;text-align:center;border-bottom:2px solid #FF383C;">Qty</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #FF383C;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="width:100%;margin-top:12px;">
      <tr><td>Subtotal</td><td style="text-align:right;">${parseFloat(order.subtotal).toFixed(3)}</td></tr>
      ${parseFloat(order.discount) > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${parseFloat(order.discount).toFixed(3)}</td></tr>` : ''}
      <tr><td>Delivery</td><td style="text-align:right;">${parseFloat(order.delivery_fees).toFixed(3)}</td></tr>
      <tr><td style="font-weight:700;padding-top:6px;">Total</td><td style="text-align:right;font-weight:700;padding-top:6px;">${parseFloat(order.total).toFixed(3)}</td></tr>
    </table>
    ${qrHtml}
    ${couponHtml}
    <p style="margin-top:24px;">We'll notify you when your order is on its way.</p>
  `);

  return sendEmail({ to: user.email, subject: `${APP_NAME} - Order Confirmation #${order.order_number}`, html, inline });
}

module.exports = { sendEmail, sendPasswordResetEmail, sendOrderConfirmationEmail };
