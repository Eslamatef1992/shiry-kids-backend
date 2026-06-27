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
      const c = await Coupon.findByPk(it.id, { include: ['vendor'] });
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
      resolved.push({ id: c.id, type: 'coupon', name: c.title, image: c.image, vendor_name: c.vendor?.name || null, price, quantity: qty, total: lineTotal });
    } else {
      const p = await Product.findByPk(it.id, { include: ['vendor'] });
      if (!p) continue;
      const price = parseFloat(p.price);
      const lineTotal = price * qty;
      subtotal += lineTotal;
      resolved.push({ id: p.id, type: 'product', name: p.name, image: (p.images && p.images[0]) || null, vendor_name: p.vendor?.name || null, price, quantity: qty, total: lineTotal });
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
    // Delivery only applies when the order contains a physical product —
    // coupon-only orders have nothing to ship, so no delivery fee.
    const delivery_fees = resolved.some(i => i.type === 'product') ? 1.5 : 0;
    const total = subtotal - discount + delivery_fees;
    const order_number = generateOrderNumber();
    const qr_data = `SHIRY-ORDER-${order_number}`;
    const qr_code = await generateQRCode(qr_data);
    const order = await Order.create({
      order_number, user_id: req.user.id, items: resolved, subtotal, discount,
      delivery_fees, total, payment_method, discount_code, qr_code,
    });
    await assignCouponQrCodes(resolved, order.id, 'order');
    const coupon_qr_codes = await CouponQrCode.findAll({
      where: { order_id: order.id, order_type: 'order' },
      attributes: ['id', 'coupon_id', 'image', 'code', 'status', 'assigned_at'],
    });
    const orderData = order.toJSON();
    delete orderData.qr_code; // large base64 — not needed by Flutter
    res.status(201).json({ success: true, data: { ...orderData, qr_data, coupon_qr_codes } });

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
    // Delivery only applies when the order contains a physical product —
    // coupon-only orders have nothing to ship, so no delivery fee.
    const delivery_fees = resolved.some(i => i.type === 'product') ? 1.5 : 0;
    const total = subtotal - discount + delivery_fees;
    const order_number = generateOrderNumber();
    const qr_data = `SHIRY-ORDER-${order_number}`;
    const qr_code = await generateQRCode(qr_data);
    const order = await GuestOrder.create({
      order_number, name: name || 'Guest', phone: phone || 'N/A', address: address || 'N/A',
      items: resolved, subtotal, discount, delivery_fees, total, payment_method, discount_code, qr_code,
    });
    await assignCouponQrCodes(resolved, order.id, 'guest_order');
    const coupon_qr_codes = await CouponQrCode.findAll({
      where: { order_id: order.id, order_type: 'guest_order' },
      attributes: ['id', 'coupon_id', 'image', 'code', 'status', 'assigned_at'],
    });
    const orderData = order.toJSON();
    delete orderData.qr_code; // large base64 — not needed by Flutter
    res.status(201).json({ success: true, data: { ...orderData, qr_data, coupon_qr_codes } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'order' } = req.query;

    if (type === 'guest_order') {
      const o = await GuestOrder.findByPk(id);
      if (!o) return res.status(404).json({ success: false, message: 'Not found' });
      // Fetch QR codes explicitly (same method as createGuestOrder) for consistency
      const coupon_qr_codes = await CouponQrCode.findAll({
        where: { order_id: id, order_type: 'guest_order' },
        attributes: ['id', 'coupon_id', 'image', 'code', 'status', 'assigned_at'],
      });
      // Strip qr_code base64 (large field not needed by the app) to keep response small
      const data = o.toJSON();
      delete data.qr_code;
      return res.json({ success: true, data: { ...data, coupon_qr_codes } });
    }

    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const o = await Order.findOne({ where: { id, user_id: req.user.id } });
    if (!o) return res.status(404).json({ success: false, message: 'Not found' });
    const coupon_qr_codes = await CouponQrCode.findAll({
      where: { order_id: id, order_type: 'order' },
      attributes: ['id', 'coupon_id', 'image', 'code', 'status', 'assigned_at'],
    });
    const data = o.toJSON();
    delete data.qr_code;
    res.json({ success: true, data: { ...data, coupon_qr_codes } });
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
    const { page=1, limit=500, payment_status, order_status, search } = req.query;
    const where = {};
    if (payment_status) where.payment_status = payment_status;
    if (order_status) where.order_status = order_status;
    if (search) where.order_number = { [Op.like]: `%${search}%` };

    // Fetch registered orders + guest orders together
    const [{ rows: orderRows }, { rows: guestRows }] = await Promise.all([
      Order.findAndCountAll({ where, include: ['user'], ...paginate(page, limit), order: [['created_at','DESC']] }),
      GuestOrder.findAndCountAll({ where, ...paginate(page, limit), order: [['created_at','DESC']] }),
    ]);

    // Collect all unique coupon/product IDs from items to enrich with vendor names
    const allRows = [...orderRows.map(r => ({ ...r.toJSON(), is_guest: false })),
                     ...guestRows.map(r => ({ ...r.toJSON(), is_guest: true }))];

    const couponIds = new Set();
    const productIds = new Set();
    allRows.forEach(o => {
      (Array.isArray(o.items) ? o.items : []).forEach(it => {
        if (it.type === 'coupon') couponIds.add(it.id);
        else if (it.type === 'product') productIds.add(it.id);
      });
    });

    const [coupons, products] = await Promise.all([
      couponIds.size ? Coupon.findAll({ where: { id: [...couponIds] }, include: ['vendor'], attributes: ['id','title'] }) : [],
      productIds.size ? Product.findAll({ where: { id: [...productIds] }, include: ['vendor'], attributes: ['id','name'] }) : [],
    ]);
    const couponVendorMap = Object.fromEntries(coupons.map(c => [c.id, c.vendor?.name || null]));
    const productVendorMap = Object.fromEntries(products.map(p => [p.id, p.vendor?.name || null]));

    const enriched = allRows.map(o => ({
      ...o,
      items: (Array.isArray(o.items) ? o.items : []).map(it => ({
        ...it,
        vendor_name: it.vendor_name || (it.type === 'coupon' ? couponVendorMap[it.id] : productVendorMap[it.id]) || null,
      })),
    }));

    // Sort combined list by created_at desc
    enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, data: enriched });
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
