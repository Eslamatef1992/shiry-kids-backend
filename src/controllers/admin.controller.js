const bcrypt = require('bcryptjs');
const { Admin, Role, User, Vendor } = require('../models');
const { Op } = require('sequelize');

// ── Admins ────────────────────────────────────────────────────────────────────
exports.listAdmins = async (req, res) => {
  try {
    const admins = await Admin.findAll({ include: ['role'], attributes: { exclude: ['password'] } });
    res.json({ success: true, data: admins });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ name, email, password: hash, role_id });
    res.status(201).json({ success: true, data: { ...admin.toJSON(), password: undefined } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Not found' });
    const data = { ...req.body };
    if (data.password) data.password = await bcrypt.hash(data.password, 12);
    await admin.update(data);
    res.json({ success: true, data: { ...admin.toJSON(), password: undefined } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeAdmin = async (req, res) => {
  try {
    await Admin.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Roles ─────────────────────────────────────────────────────────────────────
exports.listRoles = async (req, res) => {
  try { res.json({ success: true, data: await Role.findAll() }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createRole = async (req, res) => {
  try { res.status(201).json({ success: true, data: await Role.create(req.body) }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateRole = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Not found' });
    await role.update(req.body);
    res.json({ success: true, data: role });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeRole = async (req, res) => {
  try {
    await Role.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Users ─────────────────────────────────────────────────────────────────────
exports.listUsers = async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = {};
    if (search) where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }];
    if (status) where.status = status;
    const users = await User.findAll({ where, attributes: { exclude: ['password'] }, order: [['created_at','DESC']] });
    res.json({ success: true, data: users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    await user.update(req.body);
    res.json({ success: true, data: { ...user.toJSON(), password: undefined } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Vendors ───────────────────────────────────────────────────────────────────
exports.listVendors = async (req, res) => {
  try { res.json({ success: true, data: await Vendor.findAll({ order: [['created_at','DESC']] }) }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createVendor = async (req, res) => {
  try {
    const data = req.body;
    if (req.file) data.logo = `/uploads/${req.file.filename}`;
    res.status(201).json({ success: true, data: await Vendor.create(data) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Not found' });
    const data = req.body;
    if (req.file) data.logo = `/uploads/${req.file.filename}`;
    await vendor.update(data);
    res.json({ success: true, data: vendor });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeVendor = async (req, res) => {
  try {
    await Vendor.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Dashboard stats ───────────────────────────────────────────────────────────
exports.stats = async (req, res) => {
  try {
    const { Order, GuestOrder, Product, Coupon } = require('../models');
    const { Op } = require('sequelize');
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalOrders, todayOrders, totalUsers, totalVendors, totalProducts, totalCoupons, revenueRow] = await Promise.all([
      Order.count(),
      Order.count({ where: { created_at: { [Op.gte]: today } } }),
      User.count(),
      Vendor.count(),
      Product.count(),
      Coupon.count(),
      Order.sum('total', { where: { payment_status: 'paid' } }),
    ]);
    res.json({ success: true, data: { totalOrders, todayOrders, totalUsers, totalVendors, totalProducts, totalCoupons, revenue: revenueRow || 0 } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
