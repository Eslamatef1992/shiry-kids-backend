const { Ad } = require('../models');

exports.list = async (req, res) => {
  try {
    const where = {};
    if (!req.admin) where.status = 'active'; // public: active only
    const rows = await Ad.findAll({
      where,
      include: ['product', 'coupon'],
      order: [['sort', 'ASC'], ['created_at', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id, { include: ['product', 'coupon'] });
    if (!ad) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: ad });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const sanitize = (data) => {
  // Clear the foreign keys that don't apply to the chosen link_type so
  // stale references don't linger in the DB.
  if (data.link_type === 'product') {
    data.coupon_id = null;
    data.external_link = null;
  } else if (data.link_type === 'coupon') {
    data.product_id = null;
    data.external_link = null;
  } else if (data.link_type === 'external') {
    data.product_id = null;
    data.coupon_id = null;
  } else {
    data.product_id = null;
    data.coupon_id = null;
    data.external_link = null;
  }
  if (data.product_id === '' || data.product_id === undefined) data.product_id = null;
  if (data.coupon_id === '' || data.coupon_id === undefined) data.coupon_id = null;
  return data;
};

exports.create = async (req, res) => {
  try {
    const data = sanitize({ ...req.body });
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    const ad = await Ad.create(data);
    res.status(201).json({ success: true, data: ad });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Not found' });
    const data = sanitize({ ...req.body });
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    await ad.update(data);
    res.json({ success: true, data: ad });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const ad = await Ad.findByPk(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Not found' });
    await ad.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
