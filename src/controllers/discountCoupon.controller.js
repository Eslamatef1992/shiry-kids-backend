const { DiscountCoupon } = require('../models');
const { Op } = require('sequelize');

exports.list = async (req, res) => {
  try {
    const { page=1, limit=20, status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) where.code = { [Op.like]: `%${search}%` };
    const { count, rows } = await DiscountCoupon.findAndCountAll({ where, limit: parseInt(limit), offset: (parseInt(page)-1)*parseInt(limit), order: [['created_at','DESC']] });
    res.json({ success: true, data: rows, total: count });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.validate = async (req, res) => {
  try {
    const { code } = req.params;
    const dc = await DiscountCoupon.findOne({ where: { code: code.toUpperCase(), status: 'active' } });
    if (!dc) return res.status(404).json({ success: false, message: 'Invalid or expired code' });
    if (dc.expiry_date && new Date(dc.expiry_date) < new Date()) return res.status(400).json({ success: false, message: 'Coupon expired' });
    if (dc.max_uses && dc.used_count >= dc.max_uses) return res.status(400).json({ success: false, message: 'Coupon fully used' });
    res.json({ success: true, data: { type: dc.type, value: dc.value, min_order: dc.min_order } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const dc = await DiscountCoupon.create({ ...req.body, code: req.body.code?.toUpperCase() });
    res.status(201).json({ success: true, data: dc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const dc = await DiscountCoupon.findByPk(req.params.id);
    if (!dc) return res.status(404).json({ success: false, message: 'Not found' });
    await dc.update(req.body);
    res.json({ success: true, data: dc });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await DiscountCoupon.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
