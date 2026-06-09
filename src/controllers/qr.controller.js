const { Order, GuestOrder, QrScanLog } = require('../models');

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

    // Log the scan
    await QrScanLog.create({
      admin_id: req.admin.id,
      qr_code,
      order_id: order?.id || null,
      order_type,
      status,
    });

    // Mark as used if valid
    if (status === 'valid' && order) {
      await order.update({ order_status: 'arrived' });
    }

    res.json({ success: true, status, order: order ? { order_number: order.order_number, total: order.total, items: order.items } : null });
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
