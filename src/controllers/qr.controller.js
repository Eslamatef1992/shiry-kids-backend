const { Order, GuestOrder, QrScanLog, QrRedemption, CouponQrCode, Coupon, Admin } = require('../models');

exports.scan = async (req, res) => {
  try {
    const { qr_code } = req.body;
    let order = null, order_type = null, status = 'not_found';

    const orderNumber = qr_code.replace('SHIRY-ORDER-', '');

    order = await Order.findOne({ where: { order_number: orderNumber } });
    if (order) {
      order_type = 'order';
      status = order.payment_status === 'paid' ? (order.order_status === 'arrived' ? 'used' : 'valid') : 'not_found';
    } else {
      order = await GuestOrder.findOne({ where: { order_number: orderNumber } });
      if (order) {
        order_type = 'guest_order';
        status = order.payment_status === 'paid' ? (order.order_status === 'arrived' ? 'used' : 'valid') : 'not_found';
      }
    }

    let couponQr = null;
    if (!order) {
      couponQr = await CouponQrCode.findOne({ where: { code: qr_code }, include: [{ model: Coupon, as: 'coupon' }] });
      if (couponQr) {
        if (couponQr.status === 'used') status = 'used';
        else if (couponQr.status === 'assigned') status = 'valid';
        else status = 'not_found';
      }
    }

    await QrScanLog.create({
      admin_id: req.admin.id,
      qr_code,
      order_id: order?.id || couponQr?.order_id || null,
      order_type: order_type || couponQr?.order_type || null,
      status,
    });

    if (status === 'valid' && order) await order.update({ order_status: 'arrived' });
    else if (status === 'valid' && couponQr) await couponQr.update({ status: 'used' });

    let orderData = null;
    if (order) {
      orderData = { order_number: order.order_number, total: order.total, items: order.items };
    } else if (couponQr) {
      orderData = {
        coupon: couponQr.coupon ? { id: couponQr.coupon.id, title: couponQr.coupon.title, price: couponQr.coupon.price } : null,
        qr_status: couponQr.status,
      };
    }

    res.json({ success: true, status, order: orderData });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── One-time scan enforcement + redeemed detection ────────────────────────────
exports.check = async (req, res) => {
  try {
    const { qr_code } = req.body;
    let order = null, order_type = null, status = 'not_found';
    let couponQr = null;

    const orderNumber = qr_code.replace('SHIRY-ORDER-', '');
    order = await Order.findOne({ where: { order_number: orderNumber } });
    if (order) {
      order_type = 'order';
      status = order.payment_status === 'paid'
        ? (order.order_status === 'arrived' ? 'used' : 'valid')
        : 'not_found';
    } else {
      order = await GuestOrder.findOne({ where: { order_number: orderNumber } });
      if (order) {
        order_type = 'guest_order';
        status = order.payment_status === 'paid'
          ? (order.order_status === 'arrived' ? 'used' : 'valid')
          : 'not_found';
      }
    }

    if (!order) {
      couponQr = await CouponQrCode.findOne({
        where: { code: qr_code },
        include: [{ model: Coupon, as: 'coupon' }],
      });
      if (couponQr) {
        status = couponQr.status === 'used'     ? 'used'
               : couponQr.status === 'assigned' ? 'valid'
               : 'not_found';
      }
    }

    // Check if already redeemed — highest priority
    if (status === 'used') {
      const redemption = await QrRedemption.findOne({
        where: { qr_code },
        include: [{ model: Admin, as: 'admin', attributes: ['id', 'name'] }],
      });
      if (redemption) {
        const redeemedAt = redemption.created_at || redemption.createdAt;
        await QrScanLog.create({
          admin_id: req.admin.id, qr_code,
          order_id: order?.id || couponQr?.order_id || null,
          order_type: order_type || couponQr?.order_type || null,
          status: 'used',
        });
        return res.json({
          success: true,
          status: 'redeemed',
          message: 'This QR code has already been scanned and redeemed',
          redemption: {
            redeemed_at:     redeemedAt,
            redeemed_day:    new Date(redeemedAt).toLocaleDateString('en-US', { weekday: 'long' }),
            redeemed_by:     redemption.admin?.name || null,
            coupon_name:     redemption.coupon_name,
            purchase_amount: redemption.purchase_amount,
          },
        });
      }
    }

    // Mark as used on first valid scan
    if (status === 'valid' && order)    await order.update({ order_status: 'arrived' });
    if (status === 'valid' && couponQr) await couponQr.update({ status: 'used' });

    // Log scan
    await QrScanLog.create({
      admin_id:   req.admin.id,
      qr_code,
      order_id:   order?.id || couponQr?.order_id || null,
      order_type: order_type || couponQr?.order_type || null,
      status,
    });

    const message = status === 'valid'    ? 'QR code scanned successfully'
                  : status === 'used'     ? 'This QR code has already been scanned'
                  : 'QR code not found';

    let orderData = null;
    if (order) {
      orderData = { order_number: order.order_number, total: order.total, items: order.items };
    } else if (couponQr) {
      orderData = {
        coupon: couponQr.coupon
          ? { id: couponQr.coupon.id, title: couponQr.coupon.title, price: couponQr.coupon.price }
          : null,
        qr_status: couponQr.status,
      };
    }

    res.json({ success: true, status, message, order: orderData });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Redeem a used QR code (super admin only) ──────────────────────────────────
exports.redeem = async (req, res) => {
  try {
    const { qr_code } = req.body;
    if (!qr_code) return res.status(400).json({ success: false, message: 'qr_code is required' });

    // Must not already be redeemed
    const existing = await QrRedemption.findOne({ where: { qr_code } });
    if (existing) return res.status(409).json({ success: false, message: 'QR code already redeemed', status: 'already_redeemed' });

    // Validate the code exists and has been scanned (used) first
    const orderNumber = qr_code.replace('SHIRY-ORDER-', '');
    const order = await Order.findOne({ where: { order_number: orderNumber } }) ||
                  await GuestOrder.findOne({ where: { order_number: orderNumber } });
    const couponQr = !order
      ? await CouponQrCode.findOne({ where: { code: qr_code }, include: [{ model: Coupon, as: 'coupon' }] })
      : null;

    if (!order && !couponQr)
      return res.status(404).json({ success: false, message: 'QR code not found', status: 'not_found' });

    // Must be in used state — cannot redeem a code that hasn't been scanned yet
    const isUsed = order
      ? (order.order_status === 'arrived' && order.payment_status === 'paid')
      : couponQr.status === 'used';
    if (!isUsed)
      return res.status(400).json({ success: false, message: 'QR code has not been scanned yet', status: 'not_used' });

    // Resolve coupon name + purchase amount
    let coupon_name = null, purchase_amount = null, order_id = null, order_type = null;

    if (order) {
      purchase_amount = order.total;
      order_id = order.id;
      order_type = order.order_number ? (order.name ? 'guest_order' : 'order') : null;
      // Coupon name from items if available
      const items = order.items || [];
      const couponItem = items.find(i => i.type === 'coupon' || i.coupon_id);
      if (couponItem) coupon_name = couponItem.title || couponItem.name || null;
    } else if (couponQr) {
      coupon_name     = couponQr.coupon?.title || null;
      purchase_amount = couponQr.coupon?.price || null;
      order_id        = couponQr.order_id;
      order_type      = couponQr.order_type;
    }

    const redemption = await QrRedemption.create({
      qr_code,
      admin_id: req.admin.id,
      coupon_name,
      purchase_amount,
      order_id,
      order_type,
    });

    const redeemedAt = redemption.created_at || redemption.createdAt;

    res.status(201).json({
      success: true,
      message: 'QR code redeemed successfully',
      redemption: {
        id:              redemption.id,
        redeemed_at:     redeemedAt,
        redeemed_day:    new Date(redeemedAt).toLocaleDateString('en-US', { weekday: 'long' }),
        redeemed_by:     req.admin.name,
        coupon_name,
        purchase_amount,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── List all redemptions ──────────────────────────────────────────────────────
exports.redemptions = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const rows = await QrRedemption.findAll({
      include: [{ model: Admin, as: 'admin', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    const data = rows.map(r => {
      const redeemedAt = r.created_at || r.createdAt;
      return {
        id:              r.id,
        qr_code:         r.qr_code,
        redeemed_at:     redeemedAt,
        redeemed_day:    new Date(redeemedAt).toLocaleDateString('en-US', { weekday: 'long' }),
        redeemed_by:     r.admin?.name || null,
        coupon_name:     r.coupon_name,
        purchase_amount: r.purchase_amount,
      };
    });

    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.history = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const where = {};
    if (status) where.status = status;
    const isSuper = req.admin.role?.permissions?.includes('*');
    if (!isSuper) where.admin_id = req.admin.id;
    const logs = await QrScanLog.findAll({
      where, include: ['admin'], order: [['created_at', 'DESC']],
      limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({ success: true, data: logs });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
