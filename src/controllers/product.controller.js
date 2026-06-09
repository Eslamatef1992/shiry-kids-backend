const { Product, Vendor, Category } = require('../models');
const { paginate, paginateResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

exports.list = async (req, res) => {
  try {
    const { page=1, limit=20, search, category_id, vendor_id, status, featured } = req.query;
    const where = {};
    if (search) where.name = { [Op.like]: `%${search}%` };
    if (category_id) where.category_id = category_id;
    if (vendor_id) where.vendor_id = vendor_id;
    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured === 'true';
    const { count, rows } = await Product.findAndCountAll({ where, include: ['vendor','category'], ...paginate(page, limit), order: [['created_at','DESC']] });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.get = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, { include: ['vendor','category'] });
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: product });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    if (req.files?.length) data.images = req.files.map(f => `/uploads/${f.filename}`);
    const product = await Product.create(data);
    res.status(201).json({ success: true, data: product });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    const data = req.body;
    if (req.files?.length) data.images = req.files.map(f => `/uploads/${f.filename}`);
    await product.update(data);
    res.json({ success: true, data: product });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    await product.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
