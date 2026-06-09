const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

exports.generateOrderNumber = () =>
  `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2,4).toUpperCase()}`;

exports.generateQRCode = async (data) => {
  return await qrcode.toDataURL(data, { width: 300, margin: 1 });
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
