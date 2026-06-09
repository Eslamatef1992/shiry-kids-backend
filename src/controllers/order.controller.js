const { Order, GuestOrder, User, DiscountCoupon } = require('../models');
const { paginate, paginateResponse, generateOrderNumber, generateQRCode } = require('../utils/helpers');
const { Op } = require('sequelize');

exports.createOrder = async (req, res) => {
  try {
    const { items, payment_method, discount_code, address } = req.body;
    let discount = 0;
    if (discount_code) {
      const dc = await DiscountCoupon.findOne({ where: { code: discount_code, status: 'active' } });
      if (dc) {
        const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
        if (subtotal >= dc.min_order) {
          discount = dc.type === 'percentage' ? subtotal * dc.value / 100 : dc.value;
          await dc.increment('used_count');
        }
      }
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const delivery_fees = 1.5;
    const total = subtotal - discount + delivery_fees;
    const order_number = generateOrderNumber();
    const qr_data = `SHIRY-ORDER-${order_number}`;
    const qr_code = await generateQRCode(qr_data);
    const order = await Order.create({
      order_number, user_id: req.user.id, items, subtotal, discount,
      delivery_fees, total, payment_method, discount_code, qr_code,
    });
    res.status(201).json({ success: true, data: { ...order.toJSON(), qr_data } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createGuestOrder = async (req, res) => {
  try {
    const { name, phone, address, items, payment_method, discount_code } = req.body;
    let discount = 0;
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const delivery_fees = 1.5;
    const total = subtotal - discount + delivery_fees;
    const order_number = generateOrderNumber();
    const qr_code = await generateQRCode(`SHIRY-ORDER-${order_number}`);
    const order = await GuestOrder.create({ order_number, name, phone, address, items, subtotal, discount, delivery_fees, total, payment_method, discount_code, qr_code });
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
