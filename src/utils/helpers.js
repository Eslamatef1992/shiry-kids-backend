const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

exports.generateOrderNumber = () =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2,4).toUpperCase()}`;

exports.generateQRCode = async (data) => {
  return await qrcode.toDataURL(data, { width: 300, margin: 1 });
};

// Decode the QR code embedded in an uploaded image (e.g. an admin-uploaded
// coupon QR image). Returns the decoded text, or null if no QR was found /
// the image couldn't be read. Used so a customer-facing scan of the printed
// QR can be matched back to the CouponQrCode record.
exports.decodeQrFromImage = async (filePath) => {
  try {
    const Jimp = require('jimp');
    const jsQR = require('jsqr');
    const image = await Jimp.read(path.resolve(filePath));
    const { data, width, height } = image.bitmap;
    const result = jsQR(new Uint8ClampedArray(data), width, height);
    return result?.data || null;
  } catch (e) {
    console.error('decodeQrFromImage error:', e.message);
    return null;
  }
};

exports.paginate = (page = 1, limit = 20) => ({
  limit: parseInt(limit),
  offset: (parseInt(page) - 1) * parseInt(limit),
});

exports.paginateResponse = (total, page, limit) => ({
  total,
  page: parseInt(page),
  limit: parseInt(limit),
  pages: Math.ceil(total / limit),
});
