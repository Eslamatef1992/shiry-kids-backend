const { Coupon, Vendor, CouponQrCode } = require('../models');
const { paginate, paginateResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

const TRUE_VALUES = ['true', '1', 1, true];
const buildCouponData = (body) => {
  const data = { ...body };
  if (data.featured !== undefined) data.featured = TRUE_VALUES.includes(data.featured);
  return data;
};

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
    const data = buildCouponData(req.body);
    if (req.file) data.image = `/uploads/${req.file.filename}`;
    const coupon = await Coupon.create(data);
    res.status(201).json({ success: true, data: coupon });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const data = buildCouponData(req.body);
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

// ── Coupon QR Codes (per-unit images, assigned to orders FIFO) ────────────────

exports.listQrCodes = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const items = await CouponQrCode.findAll({ where: { coupon_id: req.params.id }, order: [['id', 'ASC']] });
    const summary = {
      total: items.length,
      unassigned: items.filter(i => i.status === 'unassigned').length,
      assigned: items.filter(i => i.status === 'assigned').length,
      used: items.filter(i => i.status === 'used').length,
    };
    res.json({ success: true, data: items, summary });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.uploadQrCodes = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Not found' });
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ success: false, message: 'No files uploaded' });
    const created = await Promise.all(
      files.map(f => CouponQrCode.create({ coupon_id: coupon.id, image: `/uploads/${f.filename}` }))
    );
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeQrCode = async (req, res) => {
  try {
    const item = await CouponQrCode.findOne({ where: { id: req.params.qrId, coupon_id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    if (item.status !== 'unassigned') {
      return res.status(400).json({ success: false, message: 'Cannot delete an assigned/used QR code' });
    }
    await item.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
