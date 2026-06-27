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
    const { Op, fn, col, literal } = require('sequelize');
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalOrders, totalGuestOrders, todayOrders, todayGuestOrders,
      totalUsers, totalVendors, totalProducts, totalCoupons,
      revenueRow, todayRevenueRow, guestRevenueRow, pendingOrders,
    ] = await Promise.all([
      Order.count(),
      GuestOrder.count(),
      Order.count({ where: { created_at: { [Op.gte]: today } } }),
      GuestOrder.count({ where: { created_at: { [Op.gte]: today } } }),
      User.count(),
      Vendor.count(),
      Product.count(),
      Coupon.count(),
      Order.sum('total', { where: { payment_status: 'paid' } }),
      Order.sum('total', { where: { payment_status: 'paid', created_at: { [Op.gte]: today } } }),
      GuestOrder.sum('total', { where: { payment_status: 'paid' } }),
      Order.count({ where: { payment_status: 'pending' } }),
    ]);

    // Monthly orders for the last 6 months (Order + GuestOrder combined)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const [orderRows, guestOrderRows] = await Promise.all([
      Order.findAll({
        attributes: [[fn('DATE_FORMAT', col('created_at'), '%Y-%m'), 'month'], [fn('COUNT', col('id')), 'count']],
        where: { created_at: { [Op.gte]: sixMonthsAgo } },
        group: [literal('month')],
        raw: true,
      }),
      GuestOrder.findAll({
        attributes: [[fn('DATE_FORMAT', col('created_at'), '%Y-%m'), 'month'], [fn('COUNT', col('id')), 'count']],
        where: { created_at: { [Op.gte]: sixMonthsAgo } },
        group: [literal('month')],
        raw: true,
      }),
    ]);

    const monthlyMap = {};
    [...orderRows, ...guestOrderRows].forEach(r => {
      monthlyMap[r.month] = (monthlyMap[r.month] || 0) + parseInt(r.count, 10);
    });
    const monthlyOrders = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlyOrders.push({ month: d.toLocaleString('en', { month: 'short' }), count: monthlyMap[key] || 0 });
    }

    // Order status breakdown (Order + GuestOrder combined)
    const [orderStatusRows, guestStatusRows] = await Promise.all([
      Order.findAll({ attributes: ['order_status', [fn('COUNT', col('id')), 'count']], group: ['order_status'], raw: true }),
      GuestOrder.findAll({ attributes: ['order_status', [fn('COUNT', col('id')), 'count']], group: ['order_status'], raw: true }),
    ]);
    const statusMap = { processing: 0, shipped: 0, arrived: 0, cancelled: 0 };
    [...orderStatusRows, ...guestStatusRows].forEach(r => {
      if (statusMap[r.order_status] !== undefined) statusMap[r.order_status] += parseInt(r.count, 10);
    });

    // Most selling coupon & product (parse JSON items from all orders)
    const [allOrders, allGuestOrders] = await Promise.all([
      Order.findAll({ attributes: ['items'], raw: true }),
      GuestOrder.findAll({ attributes: ['items'], raw: true }),
    ]);
    const itemMap = {};
    [...allOrders, ...allGuestOrders].forEach(o => {
      let items = o.items;
      if (typeof items === 'string') try { items = JSON.parse(items); } catch { return; }
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        const key = `${item.type}::${item.id}`;
        if (!itemMap[key]) itemMap[key] = { id: item.id, type: item.type, name: item.name, image: item.image, qty: 0 };
        itemMap[key].qty += (item.quantity || 1);
      });
    });
    const allItems = Object.values(itemMap);
    const mostSellingCoupon = allItems.filter(i => i.type === 'coupon').sort((a, b) => b.qty - a.qty)[0] || null;
    const mostSellingProduct = allItems.filter(i => i.type === 'product').sort((a, b) => b.qty - a.qty)[0] || null;

    const BASE_URL = process.env.APP_URL || '';
    const addBase = (img) => img ? (img.startsWith('http') ? img : `${BASE_URL}${img}`) : null;

    res.json({ success: true, data: {
      totalOrders,
      totalGuestOrders,
      totalAllOrders: totalOrders + totalGuestOrders,
      todayOrders: todayOrders + todayGuestOrders,
      pendingOrders,
      totalUsers,
      totalVendors,
      totalProducts,
      totalCoupons,
      revenue: (revenueRow || 0) + (guestRevenueRow || 0),
      todayRevenue: todayRevenueRow || 0,
      monthlyOrders,
      orderStatusCounts: statusMap,
      mostSellingCoupon: mostSellingCoupon ? { ...mostSellingCoupon, image: addBase(mostSellingCoupon.image) } : null,
      mostSellingProduct: mostSellingProduct ? { ...mostSellingProduct, image: addBase(mostSellingProduct.image) } : null,
    } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
