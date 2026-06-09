const { Coupon, Vendor } = require('../models');
const { paginate, paginateResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

exports.list = async (req, res) => {
  try {
    const { page=1, limit=20, search, vendor_id, status, featured } = req.query;
    const where = {};
    if (search) where.title = { [Op.like]: `%${search}%` };
    if (vendor_id) where.vendor_id = vendor_id;
    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured === 'true';
    const { count, rows } = await Coupon.findAndCountAll({ where, include: ['vendor'], ...paginate(page, limit), order: [['created_at','DESC']] });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const c = await Coupon.findByPk(req.params.id, { include: ['vendor'] });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: c });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    const coupon = await Coupon.create(data);
    res.status(201).json({ success: true, data: coupon });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const data = req.body;
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    await coupon.update(data);
    res.json({ success: true, data: coupon });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    await coupon.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
