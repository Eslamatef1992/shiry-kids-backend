const { Order, GuestOrder, QrScanLog, CouponQrCode, Coupon } = require('../models');

exports.scan = async (req, res) => {
  try {
    const { qr_code } = req.body;
    let order = null, order_type = null, status = 'not_found';

    // Extract order number from QR data: SHIRY-ORDER-ORD-XXXX
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

    // If it's not a regular order QR, check if it matches an admin-uploaded
    // coupon QR code (the QR the buyer/user sees after payment).
    let couponQr = null;
    if (!order) {
      couponQr = await CouponQrCode.findOne({ where: { code: qr_code }, include: [{ model: Coupon, as: 'coupon' }] });
      if (couponQr) {
        if (couponQr.status === 'used') {
          status = 'used';
        } else if (couponQr.status === 'assigned') {
          status = 'valid';
        } else {
          // unassigned — this QR hasn't been sold/assigned to an order yet
          status = 'not_found';
        }
      }
    }

    // Log the scan
    await QrScanLog.create({
      admin_id: req.admin.id,
      qr_code,
      order_id: order?.id || couponQr?.order_id || null,
      order_type: order_type || couponQr?.order_type || null,
      status,
    });

    // Mark as used if valid
    if (status === 'valid' && order) {
      await order.update({ order_status: 'arrived' });
    } else if (status === 'valid' && couponQr) {
      await couponQr.update({ status: 'used' });
    }

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

exports.history = async (req, res) => {
  try {
    const { page=1, limit=50, status } = req.query;
    const where = {};
    if (status) where.status = status;
    // Super admin sees all, scanner sees own
    const isSuper = req.admin.role?.permissions?.includes('*');
    if (!isSuper) where.admin_id = req.admin.id;
    const logs = await QrScanLog.findAll({ where, include: ['admin'], order: [['created_at','DESC']], limit: parseInt(limit), offset: (parseInt(page)-1)*parseInt(limit) });
    res.json({ success: true, data: logs });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
