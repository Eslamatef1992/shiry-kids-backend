const { Order, GuestOrder, User, DiscountCoupon, Product, Coupon } = require('../models');
const { paginate, paginateResponse, generateOrderNumber, generateQRCode } = require('../utils/helpers');
const { Op } = require('sequelize');

// Resolve client-supplied items ({id, type, qty}) into priced line items using
// authoritative DB prices (Product or Coupon), and compute the subtotal.
async function resolveOrderItems(items) {
  const resolved = [];
  let subtotal = 0;
  for (const it of (Array.isArray(items) ? items : [])) {
    const qty = Math.max(1, parseInt(it.qty ?? it.quantity ?? 1, 10) || 1);
    if (it.type === 'coupon') {
      const c = await Coupon.findByPk(it.id);
      if (!c) continue;
      const price = parseFloat(c.price);
      const lineTotal = price * qty;
      subtotal += lineTotal;
      resolved.push({ id: c.id, type: 'coupon', name: c.title, image: c.image, price, quantity: qty, total: lineTotal });
    } else {
      const p = await Product.findByPk(it.id);
      if (!p) continue;
      const price = parseFloat(p.price);
      const lineTotal = price * qty;
      subtotal += lineTotal;
      resolved.push({ id: p.id, type: 'product', name: p.name, image: (p.images && p.images[0]) || null, price, quantity: qty, total: lineTotal });
    }
  }
  return { resolved, subtotal };
}

exports.createOrder = async (req, res) => {
  try {
    const { items, payment_method, discount_code, address } = req.body;
    const { resolved, subtotal } = await resolveOrderItems(items);
    if (resolved.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid items found in order' });
    }
    let discount = 0;
    if (discount_code) {
      const dc = await DiscountCoupon.findOne({ where: { code: discount_code, status: 'active' } });
      if (dc && subtotal >= parseFloat(dc.min_order)) {
        discount = dc.type === 'percentage' ? subtotal * parseFloat(dc.value) / 100 : parseFloat(dc.value);
        await dc.increment('used_count');
      }
    }
    const delivery_fees = 1.5;
    const total = subtotal - discount + delivery_fees;
    const order_number = generateOrderNumber();
    const qr_data = `SHIRY-ORDER-${order_number}`;
    const qr_code = await generateQRCode(qr_data);
    const order = await Order.create({
      order_number, user_id: req.user.id, items: resolved, subtotal, discount,
      delivery_fees, total, payment_method, discount_code, qr_code,
    });
    res.status(201).json({ success: true, data: { ...order.toJSON(), qr_data } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createGuestOrder = async (req, res) => {
  try {
    const { name, phone, address, items, payment_method, discount_code } = req.body;
    const { resolved, subtotal } = await resolveOrderItems(items);
    if (resolved.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid items found in order' });
    }
    let discount = 0;
    if (discount_code) {
      const dc = await DiscountCoupon.findOne({ where: { code: discount_code, status: 'active' } });
      if (dc && subtotal >= parseFloat(dc.min_order)) {
        discount = dc.type === 'percentage' ? subtotal * parseFloat(dc.value) / 100 : parseFloat(dc.value);
        await dc.increment('used_count');
      }
    }
    const delivery_fees = 1.5;
    const total = subtotal - discount + delivery_fees;
    const order_number = generateOrderNumber();
    const qr_code = await generateQRCode(`SHIRY-ORDER-${order_number}`);
    const order = await GuestOrder.create({
      order_number, name: name || 'Guest', phone: phone || 'N/A', address: address || 'N/A',
      items: resolved, subtotal, discount, delivery_fees, total, payment_method, discount_code, qr_code,
    });
    res.status(201).json({ success: true, data: order });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.myOrders = async (req, res) => {
  try {
    const { page=1, limit=20, payment_status } = req.query;
    const where = { user_id: req.user.id };
    if (payment_status) where.payment_status = payment_status;
    const { count, rows } = await Order.findAndCountAll({ where, ...paginate(page, limit), order: [['created_at','DESC']] });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.adminListOrders = async (req, res) => {
  try {
    const { page=1, limit=20, payment_status, order_status, search } = req.query;
    const where = {};
    if (payment_status) where.payment_status = payment_status;
    if (order_status) where.order_status = order_status;
    if (search) where.order_number = { [Op.like]: `%${search}%` };
    const { count, rows } = await Order.findAndCountAll({ where, include: ['user'], ...paginate(page, limit), order: [['created_at','DESC']] });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.adminListGuestOrders = async (req, res) => {
  try {
    const { page=1, limit=20, payment_status, order_status } = req.query;
    const where = {};
    if (payment_status) where.payment_status = payment_status;
    if (order_status) where.order_status = order_status;
    const { count, rows } = await GuestOrder.findAndCountAll({ where, ...paginate(page, limit), order: [['created_at','DESC']] });
    res.json({ success: true, data: rows, meta: paginateResponse(count, page, limit) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { type = 'order' } = req.query;
    const Model = type === 'guest' ? GuestOrder : Order;
    const order = await Model.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    await order.update(req.body);
    res.json({ success: true, data: order });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
