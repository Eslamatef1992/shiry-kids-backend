const { Order, GuestOrder, User, DiscountCoupon, Product, Coupon, CouponQrCode } = require('../models');
const { paginate, paginateResponse, generateOrderNumber, generateQRCode } = require('../utils/helpers');
const { sendOrderConfirmationEmail } = require('../utils/email');
const { Op } = require('sequelize');

// Resolve client-supplied items ({id, type, qty}) into priced line items using
// authoritative DB prices (Product or Coupon), and compute the subtotal.
// Also checks per-unit QR-code stock for coupons that use the QR system
// (i.e. have at least one CouponQrCode uploaded) and returns any stock errors.
async function resolveOrderItems(items) {
  const resolved = [];
  const errors = [];
  let subtotal = 0;
  for (const it of (Array.isArray(items) ? items : [])) {
    const qty = Math.max(1, parseInt(it.qty ?? it.quantity ?? 1, 10) || 1);
    if (it.type === 'coupon') {
      const c = await Coupon.findByPk(it.id);
      if (!c) continue;
      const totalQr = await CouponQrCode.count({ where: { coupon_id: c.id } });
      if (totalQr > 0) {
        const availableQr = await CouponQrCode.count({ where: { coupon_id: c.id, status: 'unassigned' } });
        if (availableQr < qty) {
          errors.push(`Not enough QR codes available for "${c.title}" (only ${availableQr} left)`);
          continue;
        }
      }
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
  return { resolved, subtotal, errors };
}

// Assign the next available (unassigned, ordered by upload order) QR codes to
// each coupon line item in a newly-created order. Coupons without any
// uploaded QR codes are left untouched (backward compatible).
async function assignCouponQrCodes(resolved, orderId, orderType) {
  for (const item of resolved) {
    if (item.type !== 'coupon') continue;
    const totalQr = await CouponQrCode.count({ where: { coupon_id: item.id } });
    if (totalQr === 0) continue;
    const codes = await CouponQrCode.findAll({
      where: { coupon_id: item.id, status: 'unassigned' },
      order: [['id', 'ASC']],
      limit: item.quantity,
    });
    for (const code of codes) {
      await code.update({ status: 'assigned', order_id: orderId, order_type: orderType, assigned_at: new Date() });
    }
  }
}

exports.createOrder = async (req, res) => {
  try {
    const { items, payment_method, discount_code, address } = req.body;
    const { resolved, subtotal, errors } = await resolveOrderItems(items);
    if (resolved.length === 0) {
      return res.status(400).json({ success: false, message: errors[0] || 'No valid items found in order' });
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
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
    await assignCouponQrCodes(resolved, order.id, 'order');
    const coupon_qr_codes = await CouponQrCode.findAll({ where: { order_id: order.id, order_type: 'order' } });
    res.status(201).json({ success: true, data: { ...order.toJSON(), qr_data, coupon_qr_codes } });

    // For Cash on Delivery there's no online payment step, so the order is
    // confirmed immediately — send the confirmation email now.
    // For online methods (knet/visa) the email is sent later, once Tap
    // confirms the payment (see payment.controller.js applyChargeResult),
    // so we don't email customers about orders they never actually paid for.
    // sendOrderConfirmationEmail never throws — failures are logged only.
    if (payment_method === 'cod') {
      sendOrderConfirmationEmail(req.user, order, coupon_qr_codes);
    }
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createGuestOrder = async (req, res) => {
  try {
    const { name, phone, address, items, payment_method, discount_code } = req.body;
    const { resolved, subtotal, errors } = await resolveOrderItems(items);
    if (resolved.length === 0) {
      return res.status(400).json({ success: false, message: errors[0] || 'No valid items found in order' });
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
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
    const order = await GuestOrder.create({
      order_number, name: name || 'Guest', phone: phone || 'N/A', address: address || 'N/A',
      items: resolved, subtotal, discount, delivery_fees, total, payment_method, discount_code, qr_code,
    });
    await assignCouponQrCodes(resolved, order.id, 'guest_order');
    const coupon_qr_codes = await CouponQrCode.findAll({ where: { order_id: order.id, order_type: 'guest_order' } });
    res.status(201).json({ success: true, data: { ...order.toJSON(), qr_data, coupon_qr_codes } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.myOrders = async (req, res) => {
  try {
    const { page=1, limit=20, payment_status } = req.query;
    const where = { user_id: req.user.id };
    if (payment_status) where.payment_status = payment_status;
    const { count, rows } = await Order.findAndCountAll({ where, include: ['coupon_qr_codes'], ...paginate(page, limit), order: [['created_at','DESC']] });
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
